import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { summarizeByTask, tasksTime, type TimeRecord } from './task-time.js';
import { fakeContext } from './testkit.js';

type M = Record<string, unknown>;
const METHOD = 'task.elapseditem.getlist';

const rec = (id: number, taskId: number, seconds: number, created: string, entered: string, userId = 1, comment = `Сделано ${id}`) => ({
  ID: String(id),
  TASK_ID: String(taskId),
  USER_ID: String(userId),
  COMMENT_TEXT: comment,
  SECONDS: String(seconds),
  MINUTES: String(Math.floor(seconds / 60)),
  SOURCE: '2',
  CREATED_DATE: created,
  DATE_START: entered,
  DATE_STOP: entered,
});
const taskRow = (id: number, title: string) => ({ id: String(id), title, status: '5', groupId: '15', group: { id: '15', name: 'Проект' } });
const tasksList = (...rows: ReturnType<typeof taskRow>[]) => () => ({ json: { result: { tasks: rows } } });
const NOV = { from: '2026-11-01', to: '2026-11-30' };

describe('tasks time: мои записи по дню работы', () => {
  it('фильтр по мне и по дню работы, группы по задачам с названиями, итоги', async () => {
    const { ctx, calls } = fakeContext({
      [METHOD]: () => ({
        json: {
          result: [
            rec(1, 20, 3600, '2026-11-03T10:00:00+03:00', '2026-11-03T19:00:00+03:00'),
            rec(2, 10, 1800, '2026-11-05T10:00:00+03:00', '2026-11-05T19:00:00+03:00'),
            rec(3, 20, 5100, '2026-11-07T10:00:00+03:00', '2026-11-08T12:00:00+03:00'),
          ],
          total: 3,
        },
      }),
      'tasks.task.list': tasksList(taskRow(10, 'Задача десять'), taskRow(20, 'Задача двадцать')),
    });
    const out = await tasksTime(ctx, NOV);

    const body = calls.find((c) => c.method === METHOD)?.body as M;
    expect(body).toEqual({
      ORDER: { ID: 'asc' },
      FILTER: { USER_ID: 1, '>ID': 0, '>=CREATED_DATE': '2026-11-01T00:00:00+03:00', '<=CREATED_DATE': '2026-11-30T23:59:59+03:00' },
      SELECT: expect.arrayContaining(['ID', 'TASK_ID', 'USER_ID', 'COMMENT_TEXT', 'SECONDS', 'SOURCE', 'CREATED_DATE', 'DATE_START']),
      PARAMS: { NAV_PARAMS: { nPageSize: 50, iNumPage: 1 } },
    });
    const lookup = calls.find((c) => c.method === 'tasks.task.list')?.body as M;
    expect((lookup.filter as M).ID).toEqual(expect.arrayContaining([10, 20]));

    const data = out.data as M;
    expect(data).toMatchObject({ period: { from: '2026-11-01T00:00:00+03:00', to: '2026-11-30T23:59:59+03:00', by: 'work' }, totalSeconds: 10_500, total: '2 ч 55 мин' });
    const tasks = data.tasks as M[];
    expect(tasks.map((t) => t.id)).toEqual([20, 10]);
    expect(tasks[0]).toMatchObject({ title: 'Задача двадцать', status: 'завершена', project: { id: 15, name: 'Проект' }, totalSeconds: 8700, total: '2 ч 25 мин' });
    expect(tasks[0]?.records).toEqual([
      { id: 1, workDate: '2026-11-03T10:00:00+03:00', enteredDate: '2026-11-03T19:00:00+03:00', seconds: 3600, time: '1 ч', comment: 'Сделано 1', source: 'вручную' },
      { id: 3, workDate: '2026-11-07T10:00:00+03:00', enteredDate: '2026-11-08T12:00:00+03:00', seconds: 5100, time: '1 ч 25 мин', comment: 'Сделано 3', source: 'вручную' },
    ]);
    expect(data).not.toHaveProperty('authors');
    expect(out.notes.join(' ')).toContain('--by entered');
    expect(out.notes.join(' ')).not.toContain('поясе');
  });

  it('листает по номеру записи: следующая страница — после последнего номера, сумма по всем страницам', async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => rec(i + 1, 10, 60, '2026-11-02T10:00:00+03:00', '2026-11-02T10:00:00+03:00'));
    const page2 = [51, 52, 53].map((id) => rec(id, 10, 60, '2026-11-03T10:00:00+03:00', '2026-11-03T10:00:00+03:00'));
    const { ctx, calls } = fakeContext({
      [METHOD]: [() => ({ json: { result: page1, next: 50, total: 53 } }), () => ({ json: { result: page2, total: 3 } })],
      'tasks.task.list': tasksList(taskRow(10, 'Задача')),
    });
    const data = (await tasksTime(ctx, NOV)).data as M;
    const bodies = calls.filter((c) => c.method === METHOD).map((c) => c.body);
    expect(bodies.map((b) => (b.FILTER as M)['>ID'])).toEqual([0, 50]);
    expect(bodies.every((b) => ((b.PARAMS as M).NAV_PARAMS as M).iNumPage === 1)).toBe(true);
    expect(data.totalSeconds).toBe(53 * 60);
    expect(((data.tasks as M[])[0]?.records as M[]).length).toBe(53);
  });

  it('Битрикс не применил курсор и вернул уже прочитанные записи — ошибка, а не двойной счёт', async () => {
    const page = Array.from({ length: 50 }, (_, i) => rec(i + 1, 10, 60, '2026-11-02T10:00:00+03:00', '2026-11-02T10:00:00+03:00'));
    const { ctx } = fakeContext({ [METHOD]: () => ({ json: { result: page, next: 50 } }) });
    await expect(tasksTime(ctx, NOV)).rejects.toMatchObject({ code: 'APP_B24_UNEXPECTED_RESPONSE' });
  });

  it('пустая страница при next — ошибка, а не бесконечное листание', async () => {
    const { ctx, calls } = fakeContext({ [METHOD]: () => ({ json: { result: [], next: 50 } }) });
    await expect(tasksTime(ctx, NOV)).rejects.toMatchObject({ code: 'APP_B24_UNEXPECTED_RESPONSE' });
    expect(calls).toHaveLength(1);
  });

  it('больше 40 страниц — ошибка APP_B24_TOO_MANY_RECORDS, а не неполная сумма', async () => {
    const endless = () => {
      let id = 0;
      const page = () => Array.from({ length: 50 }, () => rec(++id, 10, 60, '2026-11-02T10:00:00+03:00', '2026-11-02T10:00:00+03:00'));
      return () => ({ json: { result: page(), next: 50 } });
    };
    const work = fakeContext({ [METHOD]: endless() });
    const workError = await tasksTime(work.ctx, NOV).catch((e: unknown) => e);
    expect(workError).toMatchObject({ code: 'APP_B24_TOO_MANY_RECORDS' });
    expect(work.calls.filter((c) => c.method === METHOD)).toHaveLength(40);
    expect(work.calls.some((c) => c.method === 'tasks.task.list')).toBe(false);
    expect(String((workError as { userMessage: string }).userMessage)).toContain('Сузьте период');

    const entered = fakeContext({ [METHOD]: endless() });
    const enteredError = await tasksTime(entered.ctx, { ...NOV, by: 'entered' }).catch((e: unknown) => e);
    expect(String((enteredError as { userMessage: string }).userMessage)).toContain('без --by entered');
  });

  it('пустой период — итог 0 и пометка, задачи не запрашиваются', async () => {
    const { ctx, calls } = fakeContext({ [METHOD]: () => ({ json: { result: [], total: 0 } }) });
    const out = await tasksTime(ctx, NOV);
    expect(out.data).toMatchObject({ totalSeconds: 0, total: '0 мин', tasks: [] });
    expect(out.notes.join(' ')).toContain('Записей времени нет');
    expect(calls.map((c) => c.method)).toEqual([METHOD]);
  });

  it('задачу не удалось найти — время посчитано, название null и пометка с номером', async () => {
    const { ctx } = fakeContext({
      [METHOD]: () => ({ json: { result: [rec(1, 10, 600, '2026-11-02T10:00:00+03:00', '2026-11-02T10:00:00+03:00'), rec(2, 99, 1200, '2026-11-03T10:00:00+03:00', '2026-11-03T10:00:00+03:00')] } }),
      'tasks.task.list': tasksList(taskRow(10, 'Есть')),
    });
    const out = await tasksTime(ctx, NOV);
    const tasks = (out.data as M).tasks as M[];
    expect(tasks[1]).toMatchObject({ id: 99, title: null, project: null, status: null, totalSeconds: 1200 });
    expect((out.data as M).totalSeconds).toBe(1800);
    expect(out.notes.join(' ')).toContain('99');
  });

  it.each<[string, Record<string, unknown>]>([
    ['чужая запись', { USER_ID: '5' }],
    ['день работы вне периода', { CREATED_DATE: '2026-12-01T10:00:00+03:00' }],
    ['дата не в ISO со смещением', { CREATED_DATE: '05.11.2026 10:00:00' }],
    ['день внесения не в ISO', { DATE_START: '2026-11-05 10:00:00' }],
  ])('%s в ответе — APP_B24_UNEXPECTED_RESPONSE: Битрикс не выполнил условие или сменил формат', async (_name, patch) => {
    const raw = { ...rec(1, 10, 600, '2026-11-02T10:00:00+03:00', '2026-11-02T10:00:00+03:00'), ...patch };
    const { ctx } = fakeContext({ [METHOD]: () => ({ json: { result: [raw] } }), 'tasks.task.list': tasksList(taskRow(10, 'Задача')) });
    await expect(tasksTime(ctx, NOV)).rejects.toMatchObject({ code: 'APP_B24_UNEXPECTED_RESPONSE' });
  });

  it('названия ищутся порциями по 50 задач', async () => {
    const records = Array.from({ length: 51 }, (_, i) => rec(i + 1, 1000 + i, 60, '2026-11-02T10:00:00+03:00', '2026-11-02T10:00:00+03:00'));
    const { ctx, calls } = fakeContext({ [METHOD]: () => ({ json: { result: records } }), 'tasks.task.list': () => ({ json: { result: { tasks: [] } } }) });
    await tasksTime(ctx, NOV);
    const chunks = calls.filter((c) => c.method === 'tasks.task.list').map((c) => ((c.body.filter as M).ID as number[]).length);
    expect(chunks).toEqual([50, 1]);
  });

  it('ответ поиска задач не в том виде — APP_B24_UNEXPECTED_RESPONSE, а не «задача не найдена»', async () => {
    const { ctx } = fakeContext({
      [METHOD]: () => ({ json: { result: [rec(1, 10, 600, '2026-11-02T10:00:00+03:00', '2026-11-02T10:00:00+03:00')] } }),
      'tasks.task.list': () => ({ json: { result: [] } }),
    });
    await expect(tasksTime(ctx, NOV)).rejects.toMatchObject({ code: 'APP_B24_UNEXPECTED_RESPONSE' });
  });

  it('пояс машины не совпадает с поясом портала — пометка с подсказкой про смещение', async () => {
    const { ctx } = fakeContext({
      [METHOD]: () => ({ json: { result: [rec(1, 10, 600, '2026-11-02T10:00:00+03:00', '2026-11-02T10:00:00+03:00')] } }),
      'tasks.task.list': tasksList(taskRow(10, 'Задача')),
    });
    const out = await tasksTime({ ...ctx, tz: 'UTC' }, NOV);
    expect(out.notes.join(' ')).toContain('--from 2026-11-01T00:00:00+03:00 --to 2026-11-30T23:59:59+03:00');
    expect(((out.data as M).period as M).from).toBe('2026-11-01T00:00:00+00:00');

    const exact = await tasksTime({ ...ctx, tz: 'UTC' }, { from: '2026-11-01T00:00:00+03:00', to: '2026-11-30T23:59:59+03:00' });
    expect(exact.notes.join(' ')).not.toContain('поясе');
  });

  it('запись без длительности — APP_B24_UNEXPECTED_RESPONSE, без итога', async () => {
    const broken = { ...rec(1, 10, 600, '2026-11-02T10:00:00+03:00', '2026-11-02T10:00:00+03:00'), SECONDS: null };
    const { ctx } = fakeContext({ [METHOD]: () => ({ json: { result: [broken] } }) });
    await expect(tasksTime(ctx, NOV)).rejects.toMatchObject({ code: 'APP_B24_UNEXPECTED_RESPONSE' });
  });
});

describe('tasks time --by entered', () => {
  it('Битрикс не фильтрует по дате; отбор по дню внесения записи', async () => {
    const { ctx, calls } = fakeContext({
      [METHOD]: () => ({
        json: {
          result: [
            rec(1, 10, 3600, '2026-09-21T10:00:00+03:00', '2026-11-11T15:00:00+03:00'),
            rec(2, 20, 3600, '2026-11-28T10:00:00+03:00', '2026-12-02T09:00:00+03:00'),
            rec(3, 30, 3600, '2026-10-07T10:00:00+03:00', '2026-10-07T18:00:00+03:00'),
          ],
        },
      }),
      'tasks.task.list': tasksList(taskRow(10, 'Сентябрьская работа')),
    });
    const out = await tasksTime(ctx, { ...NOV, by: 'entered' });
    expect((calls[0]?.body as M).FILTER).toEqual({ USER_ID: 1, '>ID': 0 });
    const data = out.data as M;
    expect(data).toMatchObject({ period: { by: 'entered' }, totalSeconds: 3600 });
    expect((data.tasks as M[]).map((t) => t.id)).toEqual([10]);
    expect(out.notes.join(' ')).not.toContain('--by entered');
  });

  it('границы периода включены, внесённое в другом поясе сравнивается по мгновению', async () => {
    const { ctx } = fakeContext({
      [METHOD]: () => ({
        json: {
          result: [
            rec(1, 10, 60, '2026-10-01T10:00:00+03:00', '2026-11-01T00:00:00+03:00'),
            rec(2, 10, 60, '2026-10-01T10:00:00+03:00', '2026-11-30T23:59:59+03:00'),
            rec(3, 10, 60, '2026-10-01T10:00:00+03:00', '2026-10-31T21:30:00+00:00'),
            rec(4, 10, 60, '2026-10-01T10:00:00+03:00', '2026-10-31T20:59:59+00:00'),
            rec(5, 10, 60, '2026-10-01T10:00:00+03:00', '2026-12-01T00:00:00+03:00'),
          ],
        },
      }),
      'tasks.task.list': tasksList(taskRow(10, 'Задача')),
    });
    const data = (await tasksTime(ctx, { ...NOV, by: 'entered' })).data as M;
    expect(((data.tasks as M[])[0]?.records as M[]).map((r) => r.id)).toEqual([1, 3, 2]);
  });

  it('запись без дня внесения — APP_B24_UNEXPECTED_RESPONSE, а не тихий пропуск', async () => {
    const raw = { ...rec(1, 10, 60, '2026-11-02T10:00:00+03:00', ''), DATE_START: '' };
    const { ctx } = fakeContext({ [METHOD]: () => ({ json: { result: [raw] } }) });
    await expect(tasksTime(ctx, { ...NOV, by: 'entered' })).rejects.toMatchObject({ code: 'APP_B24_UNEXPECTED_RESPONSE' });
  });
});

describe('tasks time --task', () => {
  it('записи всех участников задачи, имена авторов и итоги по людям', async () => {
    const { ctx, calls } = fakeContext({
      [METHOD]: () => ({
        json: {
          result: [
            rec(1, 77, 1800, '2026-10-01T10:00:00+03:00', '2026-10-01T10:00:00+03:00', 1),
            rec(2, 77, 7200, '2026-10-02T10:00:00+03:00', '2026-10-02T10:00:00+03:00', 5),
          ],
        },
      }),
      'tasks.task.list': tasksList(taskRow(77, 'Общая задача')),
      'user.get': () => ({ json: { result: [{ ID: '1', NAME: 'Иван', LAST_NAME: 'Петров' }, { ID: '5', NAME: 'Анна', LAST_NAME: 'Смирнова' }] } }),
    });
    const out = await tasksTime(ctx, { task: '77' });
    expect((calls[0]?.body as M).FILTER).toEqual({ TASK_ID: 77, '>ID': 0 });
    expect(calls[0]?.body).not.toHaveProperty('TASKID');
    const data = out.data as M;
    expect(data).toMatchObject({ period: null, totalSeconds: 9000, total: '2 ч 30 мин' });
    expect(data.authors).toEqual([
      { id: 5, name: 'Анна Смирнова', totalSeconds: 7200, total: '2 ч' },
      { id: 1, name: 'Иван Петров', totalSeconds: 1800, total: '30 мин' },
    ]);
    const records = ((data.tasks as M[])[0]?.records as M[]) ?? [];
    expect(records.map((r) => r.author)).toEqual([{ id: 1, name: 'Иван Петров' }, { id: 5, name: 'Анна Смирнова' }]);
  });

  it('с периодом — тот же отбор по дню работы, но без условия на автора', async () => {
    const { ctx, calls } = fakeContext({
      [METHOD]: () => ({ json: { result: [] } }),
      'tasks.task.list': tasksList(taskRow(77, 'Общая задача')),
    });
    const out = await tasksTime(ctx, { task: '77', ...NOV });
    expect((calls[0]?.body as M).FILTER).toEqual({ TASK_ID: 77, '>ID': 0, '>=CREATED_DATE': '2026-11-01T00:00:00+03:00', '<=CREATED_DATE': '2026-11-30T23:59:59+03:00' });
    expect(out.notes.join(' ')).toContain('Записей времени нет');
  });

  it('с --by entered — отбор по дню внесения после чтения, итоги по людям только из отобранного', async () => {
    const { ctx, calls } = fakeContext({
      [METHOD]: () => ({
        json: {
          result: [
            rec(1, 77, 1800, '2026-09-01T10:00:00+03:00', '2026-11-03T10:00:00+03:00', 1),
            rec(2, 77, 7200, '2026-11-02T10:00:00+03:00', '2026-12-02T10:00:00+03:00', 5),
          ],
        },
      }),
      'tasks.task.list': tasksList(taskRow(77, 'Общая задача')),
      'user.get': () => ({ json: { result: [{ ID: '1', NAME: 'Иван', LAST_NAME: 'Петров' }] } }),
    });
    const data = (await tasksTime(ctx, { task: '77', ...NOV, by: 'entered' })).data as M;
    expect((calls[0]?.body as M).FILTER).toEqual({ TASK_ID: 77, '>ID': 0 });
    expect(data.authors).toEqual([{ id: 1, name: 'Иван Петров', totalSeconds: 1800, total: '30 мин' }]);
  });

  it('запись чужой задачи в ответе по --task — APP_B24_UNEXPECTED_RESPONSE', async () => {
    const { ctx } = fakeContext({ [METHOD]: () => ({ json: { result: [rec(1, 78, 60, '2026-11-02T10:00:00+03:00', '2026-11-02T10:00:00+03:00')] } }) });
    await expect(tasksTime(ctx, { task: '77' })).rejects.toMatchObject({ code: 'APP_B24_UNEXPECTED_RESPONSE' });
  });

  it('задача скрыта, а записи есть, но вне периода — «записей нет», а не «не найдено»', async () => {
    const { ctx } = fakeContext({
      [METHOD]: () => ({ json: { result: [rec(1, 77, 60, '2026-09-01T10:00:00+03:00', '2026-09-01T10:00:00+03:00')] } }),
      'tasks.task.list': tasksList(),
    });
    const out = await tasksTime(ctx, { task: '77', ...NOV, by: 'entered' });
    expect((out.data as M).totalSeconds).toBe(0);
    expect(out.notes.join(' ')).toContain('Записей времени нет');
  });

  it('нет ни записей, ни доступа к задаче — APP_B24_NOT_FOUND', async () => {
    const { ctx } = fakeContext({ [METHOD]: () => ({ json: { result: [] } }), 'tasks.task.list': tasksList() });
    await expect(tasksTime(ctx, { task: '999' })).rejects.toMatchObject({ code: 'APP_B24_NOT_FOUND' });
  });
});

describe('tasks time: параметры', () => {
  it.each<[string, Record<string, string>]>([
    ['без периода и без задачи', {}],
    ['только --from', { from: '2026-11-01' }],
    ['начало позже конца', { from: '2026-11-30', to: '2026-11-01' }],
    ['неизвестный --by', { ...NOV, by: 'month' }],
    ['--by без периода', { task: '77', by: 'entered' }],
    ['кривой номер задачи', { task: 'abc' }],
  ])('%s — APP_CLI_INVALID_ARGUMENT без запросов в Битрикс', async (_name, opts) => {
    const { ctx, calls } = fakeContext({});
    await expect(tasksTime(ctx, opts)).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
    expect(calls).toHaveLength(0);
  });
});

describe('summarizeByTask', () => {
  const record = fc.record({
    id: fc.nat(),
    taskId: fc.integer({ min: 1, max: 6 }),
    authorId: fc.integer({ min: 1, max: 3 }),
    seconds: fc.integer({ min: 0, max: 24 * 3600 }),
    day: fc.integer({ min: 1, max: 28 }),
  });

  it('property: каждая запись ровно в одной группе своей задачи, суммы групп дают общий итог', () => {
    fc.assert(
      fc.property(fc.uniqueArray(record, { selector: (r) => r.id, maxLength: 60 }), (raw) => {
        const records: TimeRecord[] = raw.map((r) => ({
          id: r.id,
          taskId: r.taskId,
          authorId: r.authorId,
          seconds: r.seconds,
          workDate: `2026-11-${String(r.day).padStart(2, '0')}T10:00:00+03:00`,
          enteredDate: null,
          comment: '',
          source: 'вручную',
        }));
        const groups = summarizeByTask(records, 'work');
        const seen = groups.flatMap((g) => g.records.map((r) => r.id));
        expect([...seen].sort((a, b) => a - b)).toEqual(records.map((r) => r.id).sort((a, b) => a - b));
        for (const g of groups) {
          expect(g.records.every((r) => r.taskId === g.taskId)).toBe(true);
          expect(g.seconds).toBe(g.records.reduce((s, r) => s + r.seconds, 0));
        }
        expect(new Set(groups.map((g) => g.taskId)).size).toBe(groups.length);
        expect(groups.reduce((s, g) => s + g.seconds, 0)).toBe(records.reduce((s, r) => s + r.seconds, 0));
      }),
      { examples: [[[]], [[{ id: 1, taskId: 1, authorId: 1, seconds: 0, day: 1 }]]] },
    );
  });
});
