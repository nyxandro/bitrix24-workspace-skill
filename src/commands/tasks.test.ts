import { describe, expect, it } from 'vitest';
import { tasksGet, tasksList } from './tasks.js';
import { fakeContext } from './testkit.js';

type M = Record<string, unknown>;
const task = (id: number, changed: string) => ({
  id: String(id),
  title: `Задача ${id}`,
  status: '3',
  deadline: '2026-11-20T18:00:00+03:00',
  changedDate: changed,
  responsibleId: '1',
  responsible: { id: '1', name: 'Иван Петров' },
  groupId: '15',
  group: { id: '15', name: 'Коллаба' },
  createdBy: '2',
});

describe('tasks list', () => {
  it('по умолчанию — 4 роли владельца вебхука, без повторов, по дате изменения', async () => {
    const { ctx, calls } = fakeContext({
      'tasks.task.list': [
        () => ({ json: { result: { tasks: [task(1, '2026-11-10T10:00:00+03:00'), task(2, '2026-11-12T10:00:00+03:00')] } } }),
        () => ({ json: { result: { tasks: [task(2, '2026-11-12T10:00:00+03:00')] } } }),
        () => ({ json: { result: { tasks: [] } } }),
        () => ({ json: { result: { tasks: [task(3, '2026-11-11T10:00:00+03:00')] } } }),
      ],
    });
    const out = await tasksList(ctx, {});
    const filters = calls.map((c) => c.body.filter as M);
    expect(filters.map((f) => Object.keys(f).find((k) => ['RESPONSIBLE_ID', 'CREATED_BY', 'ACCOMPLICE', 'AUDITOR'].includes(k)))).toEqual([
      'RESPONSIBLE_ID',
      'CREATED_BY',
      'ACCOMPLICE',
      'AUDITOR',
    ]);
    expect(filters.every((f) => Object.values(f).includes(1))).toBe(true);
    expect(filters[0]).toMatchObject({ '<REAL_STATUS': 5 });
    expect((out.data as M[]).map((t) => t.id)).toEqual([2, 3, 1]);
    expect((out.data as M[])[0]).toMatchObject({ status: 'выполняется', responsible: { id: 1, name: 'Иван Петров' }, project: { id: 15, name: 'Коллаба' } });
    expect(out.next).toBeNull();
  });

  it('одна роль — курсор по start; --page с any — ошибка', async () => {
    const { ctx, calls } = fakeContext({ 'tasks.task.list': () => ({ json: { result: { tasks: [task(1, 'x')] }, next: 50 } }) });
    const out = await tasksList(ctx, { role: 'responsible', project: '15', status: 'done', search: 'отчёт' });
    expect(calls[0]?.body).toMatchObject({ filter: { RESPONSIBLE_ID: 1, GROUP_ID: 15, REAL_STATUS: 5, '%TITLE': 'отчёт' }, start: 0 });
    expect(out.next).not.toBeNull();
    await expect(tasksList(ctx, { page: String(out.next) })).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
  });
});

describe('tasks list: листание при --limit меньше страницы Битрикса', () => {
  it('одна роль, --limit 20: страницы 1–20, 21–40, 41–50, потом следующая страница Битрикса', async () => {
    const page = (start: number) => Array.from({ length: 50 }, (_, i) => task(start + i + 1, '2026-11-10T10:00:00+03:00'));
    const { ctx, calls } = fakeContext({
      'tasks.task.list': (b) => ({ json: { result: { tasks: page(Number(b.start)) }, next: Number(b.start) + 50 } }),
    });
    const seen: number[] = [];
    let next: string | null = null;
    for (let i = 0; i < 4; i++) {
      const out = await tasksList(ctx, { role: 'responsible', limit: '20', ...(next ? { page: next } : {}) });
      seen.push(...(out.data as M[]).map((t) => t.id as number));
      next = out.next;
    }
    expect(seen).toEqual(Array.from({ length: 70 }, (_, i) => i + 1));
    expect(calls.map((c) => c.body.start)).toEqual([0, 0, 0, 50]);
  });
});

describe('tasks get', () => {
  it('карточка, dialogId чата, чаты из описания, чек-лист', async () => {
    const { ctx } = fakeContext({
      'tasks.task.get': () => ({
        json: {
          result: {
            task: {
              id: '4521',
              title: 'Сделать отчёт',
              description: 'Обсуждение тут: https://x/online/?IM_DIALOG=chat222222 и тут IM_DIALOG=chat333333, [B]важно[/B]',
              status: '2',
              deadline: '2026-11-20T18:00:00+03:00',
              creator: { id: '2', name: 'Пётр' },
              responsible: { id: '1', name: 'Иван' },
              accomplicesData: { 3: { id: '3', name: 'Анна' } },
              auditorsData: [],
              group: { id: '15', name: 'Коллаба' },
              chatId: 987,
            },
          },
        },
      }),
      'task.checklistitem.getlist': () => ({
        json: { result: [{ ID: '1', PARENT_ID: '0', TITLE: 'Чек-лист', IS_COMPLETE: 'N' }, { ID: '2', PARENT_ID: '1', TITLE: 'Пункт', IS_COMPLETE: 'Y', ATTACHMENTS: { a: { DOWNLOAD_URL: 'https://x/?token=1' } } }] },
      }),
    });
    const data = (await tasksGet(ctx, '4521', {})).data as M;
    expect(data).toMatchObject({
      id: 4521,
      status: 'ждёт выполнения',
      dialogId: 'chat987',
      linkedDialogs: ['chat222222', 'chat333333'],
      accomplices: [{ id: 3, name: 'Анна' }],
      auditors: [],
      project: { id: 15, name: 'Коллаба' },
    });
    expect(String(data.description)).toContain('важно');
    expect(data.checklist).toEqual([
      { id: 1, parentId: 0, title: 'Чек-лист', done: false },
      { id: 2, parentId: 1, title: 'Пункт', done: true },
    ]);
    expect(JSON.stringify(data)).not.toContain('DOWNLOAD_URL');
  });

  it('у задачи нет чата — dialogId null и пометка', async () => {
    const { ctx } = fakeContext({
      'tasks.task.get': () => ({ json: { result: { task: { id: '1', title: 'Старая', description: '', status: '5' } } } }),
      'task.checklistitem.getlist': () => ({ json: { result: [] } }),
    });
    const out = await tasksGet(ctx, '1', {});
    expect((out.data as M).dialogId).toBeNull();
    expect(out.notes.join(' ')).toContain('нет чата');
  });
});
