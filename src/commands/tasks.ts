/**
 * tasks list|get — задачи сотрудника и их чаты.
 *
 * Администратор без фильтра получил бы все задачи компании, а фильтра «любая
 * моя роль» у tasks.task.list нет — поэтому по умолчанию четыре запроса по
 * ролям владельца вебхука и объединение без повторов.
 */
import { AppError } from '../api/errors.js';
import { MAX_TEXT_CHARS } from '../config/config.js';
import type { Envelope } from '../render/output.js';
import { bbToText, truncate } from '../render/text.js';
import {
  asArray,
  type CommandContext,
  decodeCursor,
  encodeCursor,
  envelope,
  isObject,
  type Json,
  num,
  parseId,
  parseLimit,
  str,
} from './common.js';

const STATUS: Readonly<Record<string, string>> = {
  '1': 'новая',
  '2': 'ждёт выполнения',
  '3': 'выполняется',
  '4': 'ждёт контроля',
  '5': 'завершена',
  '6': 'отложена',
  '7': 'отклонена',
};
const ROLE_FIELDS: Readonly<Record<string, string>> = {
  responsible: 'RESPONSIBLE_ID',
  creator: 'CREATED_BY',
  accomplice: 'ACCOMPLICE',
  auditor: 'AUDITOR',
};
const ROLE_NAMES: Readonly<Record<string, string>> = {
  responsible: 'ответственный',
  creator: 'постановщик',
  accomplice: 'соисполнитель',
  auditor: 'наблюдатель',
};
const LIST_SELECT = ['ID', 'TITLE', 'STATUS', 'DEADLINE', 'CHANGED_DATE', 'RESPONSIBLE_ID', 'CREATED_BY', 'GROUP_ID'];
const GET_SELECT = [
  'ID', 'TITLE', 'DESCRIPTION', 'STATUS', 'DEADLINE', 'CREATED_BY', 'RESPONSIBLE_ID', 'ACCOMPLICES', 'AUDITORS',
  'GROUP_ID', 'CHAT_ID', 'CREATED_DATE', 'CHANGED_DATE', 'CLOSED_DATE',
];
const PAGE = 50;
const IM_DIALOG_RE = /IM_DIALOG=(chat\d+|\d+)/g;

const isStartCursor = (v: unknown): v is { s: number } => isObject(v) && typeof v.s === 'number' && Number.isSafeInteger(v.s) && v.s >= 0;

function invalid(message: string): AppError {
  return new AppError({ code: 'APP_CLI_INVALID_ARGUMENT', userMessage: message });
}

function person(raw: unknown): { id: number; name: string } | null {
  if (!isObject(raw)) return null;
  const id = num(raw.id);
  return id === null ? null : { id, name: str(raw.name) };
}

function statusName(raw: unknown): string {
  return STATUS[str(raw)] ?? str(raw);
}

function summary(t: Json, roles: string[]) {
  return {
    id: num(t.id) ?? 0,
    title: str(t.title),
    status: statusName(t.status),
    deadline: str(t.deadline) || null,
    changedDate: str(t.changedDate) || null,
    responsible: person(t.responsible),
    project: person(t.group),
    myRoles: roles.map((r) => ROLE_NAMES[r] ?? r),
  };
}

export async function tasksList(
  ctx: CommandContext,
  opts: { role?: string; project?: string; status?: string; search?: string; limit?: string; page?: string },
): Promise<Envelope> {
  const role = opts.role ?? 'any';
  const status = opts.status ?? 'active';
  if (role !== 'any' && !ROLE_FIELDS[role]) {
    throw invalid(`Параметр --role: ожидается responsible | creator | accomplice | auditor | any, получено «${role}».`);
  }
  if (!['active', 'done', 'all'].includes(status)) {
    throw invalid(`Параметр --status: ожидается active | done | all, получено «${status}».`);
  }
  if (opts.page && role === 'any') {
    throw invalid('Параметр --page работает только с одной ролью: укажите --role.');
  }
  const limit = parseLimit(opts.limit, 20, PAGE);
  const base: Json = {};
  if (status === 'active') base['<REAL_STATUS'] = 5;
  if (status === 'done') base.REAL_STATUS = 5;
  if (opts.project) base.GROUP_ID = parseId(opts.project, '--project');
  if (opts.search?.trim()) base['%TITLE'] = opts.search.trim();
  const start = opts.page ? decodeCursor(opts.page, '--page', isStartCursor).s : 0;

  const roles = role === 'any' ? Object.keys(ROLE_FIELDS) : [role];
  const merged = new Map<number, { task: Json; roles: string[] }>();
  let next: number | undefined;
  let anyFull = false;
  for (const r of roles) {
    const resp = await ctx.client.call<Json>('tasks.task.list', {
      filter: { [ROLE_FIELDS[r]!]: ctx.webhook.userId, ...base },
      select: LIST_SELECT,
      order: { CHANGED_DATE: 'desc' },
      start,
    });
    const tasks = isObject(resp.result) ? asArray(resp.result.tasks).filter(isObject) : [];
    anyFull ||= tasks.length >= PAGE;
    next = resp.next;
    for (const t of tasks) {
      const id = num(t.id);
      if (id === null) continue;
      const entry = merged.get(id) ?? { task: t, roles: [] };
      entry.roles.push(r);
      merged.set(id, entry);
    }
  }
  const sorted = [...merged.values()]
    .sort((a, b) => (Date.parse(str(b.task.changedDate)) || 0) - (Date.parse(str(a.task.changedDate)) || 0))
    .slice(0, limit)
    .map((e) => summary(e.task, e.roles));
  const notes: string[] = [];
  if (sorted.length === 0) notes.push('Задач не найдено.');
  let cursor: string | null = null;
  if (role !== 'any' && typeof next === 'number') {
    cursor = encodeCursor({ s: next });
    notes.push('Есть ещё задачи: --page <next>.');
  } else if (role === 'any' && (anyFull || merged.size > limit)) {
    notes.push('Показаны последние изменённые задачи по всем вашим ролям; полный список — с --role и --page.');
  }
  return envelope(sorted, cursor, notes);
}

export async function tasksGet(ctx: CommandContext, idRaw: string, opts: { full?: boolean }): Promise<Envelope> {
  const id = parseId(idRaw, 'id');
  const resp = await ctx.client.call<Json>('tasks.task.get', { taskId: id, select: GET_SELECT });
  const t = isObject(resp.result) && isObject(resp.result.task) ? resp.result.task : {};
  const rawDescription = str(t.description);
  const text = bbToText(rawDescription, new Map(), ctx.tz);
  const description = opts.full ? { text, truncated: false } : truncate(text, MAX_TEXT_CHARS);
  const linkedDialogs = [...new Set([...rawDescription.matchAll(IM_DIALOG_RE)].map((m) => m[1] as string))];
  const chatId = num(t.chatId);
  const checklistResp = await ctx.client.call<unknown>('task.checklistitem.getlist', { TASKID: id });
  const checklist = asArray(checklistResp.result)
    .filter(isObject)
    .map((c) => ({ id: num(c.ID), parentId: num(c.PARENT_ID), title: str(c.TITLE), done: c.IS_COMPLETE === 'Y' }));
  const notes = chatId === null ? ['У задачи нет чата — обсуждения нет или задача в старом формате.'] : [];
  if (linkedDialogs.length > 0) notes.push('В описании есть ссылки на другие чаты (linkedDialogs) — их тоже можно прочитать.');
  return envelope(
    {
      id: num(t.id) ?? id,
      title: str(t.title),
      status: statusName(t.status),
      deadline: str(t.deadline) || null,
      creator: person(t.creator),
      responsible: person(t.responsible),
      accomplices: asArray(t.accomplicesData).map(person).filter((p) => p !== null),
      auditors: asArray(t.auditorsData).map(person).filter((p) => p !== null),
      project: person(t.group),
      description: description.text,
      ...(description.truncated ? { descriptionTruncated: true } : {}),
      dialogId: chatId === null ? null : `chat${chatId}`,
      linkedDialogs,
      checklist,
      createdDate: str(t.createdDate) || null,
      changedDate: str(t.changedDate) || null,
      closedDate: str(t.closedDate) || null,
    },
    null,
    notes,
  );
}
