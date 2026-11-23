/**
 * tasks time — учтённое время в задачах: сколько потрачено и что сделано (записи
 * «Учёт времени» в карточке задачи).
 *
 * Как вызывается task.elapseditem.getlist (проверено на портале 2026-11-23):
 * - параметры — по именам заглавными (ORDER, FILTER, SELECT, PARAMS). TASKID не передаём:
 *   вместе с ним Битрикс отклоняет именованный вызов, а без него отдаёт записи по всем
 *   задачам — нужная задача задаётся условием TASK_ID;
 * - без условия USER_ID администратору приходят записи всех сотрудников, поэтому без
 *   --task показываются только записи владельца вебхука;
 * - страница — не больше 50 записей (NAV_PARAMS), продолжение есть, пока в ответе есть next.
 *   Листаем по номеру записи (условие >ID), а не по номеру страницы: удалённая во время
 *   чтения запись иначе сдвинула бы следующие страницы, и одна запись пропала бы из суммы;
 * - вызов именованными параметрами в документации не описан, поэтому каждая запись
 *   сверяется с условиями запроса: чужая запись или дата вне периода — ошибка, а не сумма.
 *
 * У записи две даты (task-elapsed-item-get-list.md): CREATED_DATE — день работы (его
 * выбирают при ручном внесении), DATE_START — когда запись внесена. Битрикс фильтрует
 * только по CREATED_DATE, поэтому «по дню внесения» — перебор всех записей и отбор здесь.
 */
import { AppError } from '../api/errors.js';
import { isZonedDateTime, parseInputDate, toZone } from '../render/dates.js';
import { formatDuration } from '../render/duration.js';
import type { Envelope } from '../render/output.js';
import { bbToText } from '../render/text.js';
import {
  asArray,
  type CommandContext,
  envelope,
  isObject,
  type Json,
  lookupNames,
  nameOf,
  notFound,
  num,
  parseId,
  str,
  unexpected,
} from './common.js';
import { person, statusName } from './tasks.js';

const METHOD = 'task.elapseditem.getlist';
const SELECT = ['ID', 'TASK_ID', 'USER_ID', 'COMMENT_TEXT', 'SECONDS', 'SOURCE', 'CREATED_DATE', 'DATE_START'];
const PAGE_SIZE = 50; // больше NAV_PARAMS.nPageSize Битрикс не принимает
// 2000 записей. Дальше программа останавливается с ошибкой: неполная сумма часов хуже, чем никакой.
const MAX_PAGES = 40;
const MAX_RECORDS = PAGE_SIZE * MAX_PAGES;
const TASK_LOOKUP_CHUNK = 50; // tasks.task.list отдаёт не больше 50 задач за раз
const SOURCE: Readonly<Record<string, string>> = { '1': 'не указан', '2': 'вручную', '3': 'автоматически' };
const BY_VALUES = ['work', 'entered'] as const;
type By = (typeof BY_VALUES)[number];

export interface TimeRecord {
  id: number;
  taskId: number;
  authorId: number;
  seconds: number;
  workDate: string;
  enteredDate: string | null;
  comment: string;
  source: string;
}

export interface TaskGroup {
  taskId: number;
  seconds: number;
  records: TimeRecord[];
}

interface TaskInfo {
  title: string;
  status: string;
  project: { id: number; name: string } | null;
}

function invalid(message: string): AppError {
  return new AppError({ code: 'APP_CLI_INVALID_ARGUMENT', userMessage: message });
}

function isBy(value: string): value is By {
  return (BY_VALUES as readonly string[]).includes(value);
}

interface Query {
  filter: Json;
  // Условия, которые запись обязана выполнять: Битрикс мог молча не применить фильтр.
  authorId: number | null;
  taskId: number | null;
  workBetween: { fromMs: number; toMs: number } | null;
}

// Смещение в конце даты-времени Битрикса: «+03:00» или «Z».
function offsetOf(zoned: string): string {
  return /(Z|[+-]\d{2}:\d{2})$/.exec(zoned)?.[1] ?? '';
}

function parseRecord(raw: Json, tz: string): { record: TimeRecord; portalOffset: string } {
  const id = num(raw.ID);
  const taskId = num(raw.TASK_ID);
  const authorId = num(raw.USER_ID);
  const seconds = num(raw.SECONDS);
  const workDate = str(raw.CREATED_DATE);
  const entered = str(raw.DATE_START);
  if (id === null) throw unexpected(`${METHOD}.ID`);
  if (taskId === null) throw unexpected(`${METHOD}.TASK_ID`);
  if (authorId === null) throw unexpected(`${METHOD}.USER_ID`);
  if (seconds === null || !Number.isSafeInteger(seconds) || seconds < 0) throw unexpected(`${METHOD}.SECONDS`);
  // Только ISO со смещением: «05.11.2026» Date.parse прочёл бы как 11 мая, а строку без
  // смещения — в поясе машины.
  if (!isZonedDateTime(workDate)) throw unexpected(`${METHOD}.CREATED_DATE`);
  if (entered !== '' && !isZonedDateTime(entered)) throw unexpected(`${METHOD}.DATE_START`);
  const record: TimeRecord = {
    id,
    taskId,
    authorId,
    seconds,
    workDate: toZone(workDate, tz),
    enteredDate: entered === '' ? null : toZone(entered, tz),
    comment: bbToText(str(raw.COMMENT_TEXT), new Map(), tz).trim(),
    source: SOURCE[str(raw.SOURCE)] ?? str(raw.SOURCE),
  };
  return { record, portalOffset: offsetOf(workDate) };
}

function checkMatches(record: TimeRecord, query: Query): void {
  if (query.authorId !== null && record.authorId !== query.authorId) throw unexpected(`${METHOD}.FILTER.USER_ID`);
  if (query.taskId !== null && record.taskId !== query.taskId) throw unexpected(`${METHOD}.FILTER.TASK_ID`);
  const work = Date.parse(record.workDate);
  if (query.workBetween && (work < query.workBetween.fromMs || work > query.workBetween.toMs)) {
    throw unexpected(`${METHOD}.FILTER.CREATED_DATE`);
  }
}

async function fetchRecords(
  ctx: CommandContext,
  query: Query,
  tooManyHint: string,
): Promise<{ records: TimeRecord[]; portalOffsets: Set<string> }> {
  const records: TimeRecord[] = [];
  const portalOffsets = new Set<string>();
  let lastId = 0;
  for (let page = 1; ; page++) {
    const resp = await ctx.client.call<unknown>(METHOD, {
      ORDER: { ID: 'asc' },
      FILTER: { ...query.filter, '>ID': lastId },
      SELECT,
      PARAMS: { NAV_PARAMS: { nPageSize: PAGE_SIZE, iNumPage: 1 } },
    });
    if (!Array.isArray(resp.result)) throw unexpected(`${METHOD}.result`);
    for (const raw of resp.result) {
      if (!isObject(raw)) throw unexpected(`${METHOD}.result[]`);
      const { record, portalOffset } = parseRecord(raw, ctx.tz);
      // Номера растут: запись не дальше прочитанного значит, что курсор не сработал и сумма задвоится.
      if (record.id <= lastId) throw unexpected(`${METHOD}.FILTER.ID`);
      checkMatches(record, query);
      lastId = record.id;
      records.push(record);
      portalOffsets.add(portalOffset);
    }
    if (resp.next === undefined) return { records, portalOffsets };
    if (resp.result.length === 0) throw unexpected(`${METHOD}.next`);
    if (page >= MAX_PAGES) {
      throw new AppError({
        code: 'APP_B24_TOO_MANY_RECORDS',
        userMessage: `Записей времени больше ${MAX_RECORDS} — неполную сумму программа не считает. ${tooManyHint}`,
      });
    }
  }
}

function sortKey(record: TimeRecord, by: By): number {
  return Date.parse(by === 'entered' && record.enteredDate !== null ? record.enteredDate : record.workDate);
}

// Группы по задачам в порядке первой записи; записи внутри — по выбранной дате.
export function summarizeByTask(records: readonly TimeRecord[], by: By): TaskGroup[] {
  const sorted = [...records].sort((a, b) => sortKey(a, by) - sortKey(b, by) || a.id - b.id);
  const groups = new Map<number, TaskGroup>();
  for (const record of sorted) {
    const group = groups.get(record.taskId) ?? { taskId: record.taskId, seconds: 0, records: [] };
    group.seconds += record.seconds;
    group.records.push(record);
    groups.set(record.taskId, group);
  }
  return [...groups.values()];
}

async function lookupTasks(ctx: CommandContext, ids: readonly number[]): Promise<Map<number, TaskInfo>> {
  const infos = new Map<number, TaskInfo>();
  for (let i = 0; i < ids.length; i += TASK_LOOKUP_CHUNK) {
    const resp = await ctx.client.call<Json>('tasks.task.list', {
      filter: { ID: ids.slice(i, i + TASK_LOOKUP_CHUNK) },
      select: ['ID', 'TITLE', 'STATUS', 'GROUP_ID'],
    });
    if (!isObject(resp.result)) throw unexpected('tasks.task.list.result');
    for (const t of asArray(resp.result.tasks).filter(isObject)) {
      const id = num(t.id);
      if (id !== null) infos.set(id, { title: str(t.title), status: statusName(t.status), project: person(t.group) });
    }
  }
  return infos;
}

function authorTotals(records: readonly TimeRecord[], names: Map<number, string>) {
  const seconds = new Map<number, number>();
  for (const r of records) seconds.set(r.authorId, (seconds.get(r.authorId) ?? 0) + r.seconds);
  return [...seconds.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([id, total]) => ({ id, name: nameOf(names, id), totalSeconds: total, total: formatDuration(total) }));
}

export async function tasksTime(
  ctx: CommandContext,
  opts: { from?: string; to?: string; by?: string; task?: string },
): Promise<Envelope> {
  const taskId = opts.task === undefined ? null : parseId(opts.task, '--task');
  const hasPeriod = opts.from !== undefined || opts.to !== undefined;
  if (hasPeriod && (!opts.from || !opts.to)) {
    throw invalid('Укажите период целиком: --from ГГГГ-ММ-ДД и --to ГГГГ-ММ-ДД.');
  }
  if (!hasPeriod && taskId === null) {
    throw invalid('Укажите период (--from ГГГГ-ММ-ДД и --to ГГГГ-ММ-ДД) или задачу (--task <номер>).');
  }
  if (opts.by !== undefined && !hasPeriod) {
    throw invalid('Параметр --by работает только вместе с --from и --to.');
  }
  const by = opts.by ?? 'work';
  if (!isBy(by)) {
    throw invalid(`Параметр --by: ожидается work | entered, получено «${by}».`);
  }
  let period: { from: string; to: string; by: By } | null = null;
  if (opts.from && opts.to) {
    period = { from: parseInputDate(opts.from, 'start', '--from', ctx.tz), to: parseInputDate(opts.to, 'end', '--to', ctx.tz), by };
    if (Date.parse(period.from) > Date.parse(period.to)) {
      throw invalid('Начало периода (--from) позже его конца (--to).');
    }
  }

  const query: Query = {
    filter: taskId === null ? { USER_ID: ctx.webhook.userId } : { TASK_ID: taskId },
    authorId: taskId === null ? ctx.webhook.userId : null,
    taskId,
    workBetween: null,
  };
  if (period?.by === 'work') {
    query.filter['>=CREATED_DATE'] = period.from;
    query.filter['<=CREATED_DATE'] = period.to;
    query.workBetween = { fromMs: Date.parse(period.from), toMs: Date.parse(period.to) };
  }
  const tooManyHint =
    period?.by === 'entered'
      ? 'По дню внесения программа перебирает все записи — посчитайте по дню работы (без --by entered).'
      : 'Сузьте период: --from и --to.';
  const fetched = await fetchRecords(ctx, query, tooManyHint);
  let records = fetched.records;
  if (period?.by === 'entered') {
    const [fromMs, toMs] = [Date.parse(period.from), Date.parse(period.to)];
    records = records.filter((r) => {
      if (r.enteredDate === null) throw unexpected(`${METHOD}.DATE_START`);
      const entered = Date.parse(r.enteredDate);
      return entered >= fromMs && entered <= toMs;
    });
  }

  const groups = summarizeByTask(records, period?.by ?? 'work');
  const taskIds = taskId === null ? groups.map((g) => g.taskId) : [taskId];
  const infos = taskIds.length === 0 ? new Map<number, TaskInfo>() : await lookupTasks(ctx, taskIds);
  if (taskId !== null && fetched.records.length === 0 && !infos.has(taskId)) {
    throw notFound();
  }
  const names = taskId === null ? null : await lookupNames(ctx, records.map((r) => r.authorId));

  const totalSeconds = records.reduce((sum, r) => sum + r.seconds, 0);
  const tasks = groups.map((g) => {
    const info = infos.get(g.taskId);
    return {
      id: g.taskId,
      title: info?.title ?? null,
      project: info?.project ?? null,
      status: info?.status ?? null,
      totalSeconds: g.seconds,
      total: formatDuration(g.seconds),
      records: g.records.map((r) => ({
        id: r.id,
        workDate: r.workDate,
        enteredDate: r.enteredDate,
        seconds: r.seconds,
        time: formatDuration(r.seconds),
        comment: r.comment,
        source: r.source,
        ...(names ? { author: { id: r.authorId, name: nameOf(names, r.authorId) } } : {}),
      })),
    };
  });

  const notes: string[] = [];
  if (records.length === 0) notes.push(period ? 'Записей времени нет за этот период.' : 'Записей времени в задаче нет.');
  const missing = groups.map((g) => g.taskId).filter((id) => !infos.has(id));
  if (missing.length > 0) {
    notes.push(`Задачи ${missing.join(', ')} не найдены или недоступны: время по ним посчитано, названия нет.`);
  }
  if (period?.by === 'work') {
    notes.push('Период считан по дню работы. Часы, внесённые в этот период за прошлые дни, — с --by entered.');
  }
  // Границы, заданные со смещением, уже точные; иначе сутки считаются в поясе машины.
  if (period && opts.from && opts.to && !(isZonedDateTime(opts.from) && isZonedDateTime(opts.to))) {
    const machineOffsets = new Set([offsetOf(period.from), offsetOf(period.to)]);
    const foreign = [...fetched.portalOffsets].filter((o) => !machineOffsets.has(o));
    if (foreign.length > 0) {
      notes.push(
        `Границы периода и даты в ответе — в поясе этой машины (${[...machineOffsets].join(', ')}), а Битрикс хранит время в ${foreign.join(', ')}: ` +
          `записи у самой границы суток могут попасть в соседний период. Точные границы — со смещением портала: ` +
          `--from ${opts.from.slice(0, 10)}T00:00:00${foreign[0]} --to ${opts.to.slice(0, 10)}T23:59:59${foreign[0]}.`,
      );
    }
  }
  return envelope(
    { period, totalSeconds, total: formatDuration(totalSeconds), tasks, ...(names ? { authors: authorTotals(records, names) } : {}) },
    null,
    notes,
  );
}
