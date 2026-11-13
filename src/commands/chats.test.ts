import { describe, expect, it } from 'vitest';
import { chatsCounters, chatsFind, chatsInfo, chatsMessages, chatsRecent, chatsSearch } from './chats.js';
import { decodeCursor } from './common.js';
import { fakeContext } from './testkit.js';

type M = Record<string, unknown>;
const msg = (id: number, date = '2026-11-10T10:00:00+03:00', extra: M = {}) => ({ id, chat_id: 987, author_id: 5, date, text: `сообщение ${id}`, params: {}, ...extra });
const USERS = [{ id: 5, name: 'Иван Петров' }];
// Битрикс отдаёт сообщения по убыванию id, не больше LIMIT, строго меньше LAST_ID.
function history(total: number, dateOf: (id: number) => string = () => '2026-11-10T10:00:00+03:00') {
  return (body: M) => {
    const lastId = Number(body.LAST_ID);
    const limit = Number(body.LIMIT);
    const ids = Array.from({ length: total }, (_, i) => total - i).filter((id) => id < lastId).slice(0, limit);
    return { json: { result: { messages: ids.map((id) => msg(id, dateOf(id))), users: USERS, files: [] } } };
  };
}

describe('chats messages', () => {
  it('без курсора — последние 30 по возрастанию, next на более ранние', async () => {
    const { ctx, calls } = fakeContext({
      'im.dialog.get': () => ({ json: { result: { id: 987, last_message_id: 100 } } }),
      'im.dialog.messages.get': history(100),
    });
    const out = await chatsMessages(ctx, 'chat987', {});
    const data = out.data as { id: number; author: { name: string }; text: string }[];
    expect(calls[1]?.body).toEqual({ DIALOG_ID: 'chat987', LAST_ID: 101, LIMIT: 30 });
    expect(data.map((m) => m.id)).toEqual(Array.from({ length: 30 }, (_, i) => 71 + i));
    expect(data[0]?.author.name).toBe('Иван Петров');
    expect(out.next).toBe('71');
  });

  it('--limit 120 — три запроса с убывающим LAST_ID', async () => {
    const { ctx, calls } = fakeContext({
      'im.dialog.get': () => ({ json: { result: { last_message_id: 300 } } }),
      'im.dialog.messages.get': history(300),
    });
    const out = await chatsMessages(ctx, 'chat987', { limit: '120' });
    const lastIds = calls.filter((c) => c.method === 'im.dialog.messages.get').map((c) => c.body.LAST_ID);
    expect(lastIds).toEqual([301, 251, 201]);
    expect((out.data as unknown[]).length).toBe(120);
  });

  it('много непрочитанных: Битрикс вернул больше LIMIT — обрезаем, ничего не теряя в next', async () => {
    const { ctx } = fakeContext({
      'im.dialog.get': () => ({ json: { result: { last_message_id: 73 } } }),
      'im.dialog.messages.get': () => ({ json: { result: { messages: Array.from({ length: 73 }, (_, i) => msg(73 - i)), users: USERS } } }),
    });
    const out = await chatsMessages(ctx, 'chat987', {});
    const ids = (out.data as { id: number }[]).map((m) => m.id);
    expect(ids).toEqual(Array.from({ length: 30 }, (_, i) => 44 + i));
    expect(out.next).toBe('44');
  });

  it('--since листает до даты и останавливается', async () => {
    const dateOf = (id: number) => (id > 60 ? '2026-11-10T10:00:00+03:00' : '2026-11-01T10:00:00+03:00');
    const { ctx, calls } = fakeContext({
      'im.dialog.get': () => ({ json: { result: { last_message_id: 100 } } }),
      'im.dialog.messages.get': history(100, dateOf),
    });
    const out = await chatsMessages(ctx, 'chat987', { since: '2026-11-06' });
    const ids = (out.data as { id: number }[]).map((m) => m.id);
    expect(ids[0]).toBe(61);
    expect(ids).toHaveLength(40);
    expect(out.next).toBeNull();
    expect(calls.filter((c) => c.method === 'im.dialog.messages.get')).toHaveLength(1);
  });

  it('--since не зацикливается, если Битрикс вернул ту же порцию', async () => {
    const { ctx, calls } = fakeContext({
      'im.dialog.get': () => ({ json: { result: { last_message_id: 10 } } }),
      'im.dialog.messages.get': () => ({ json: { result: { messages: [msg(10), msg(9)], users: USERS } } }),
    });
    await chatsMessages(ctx, 'chat987', { since: '2020-01-01' });
    expect(calls.filter((c) => c.method === 'im.dialog.messages.get').length).toBeLessThanOrEqual(2);
  });

  it('--since упирается в 500 — пометка и next', async () => {
    const { ctx } = fakeContext({
      'im.dialog.get': () => ({ json: { result: { last_message_id: 2000 } } }),
      'im.dialog.messages.get': history(2000),
    });
    const out = await chatsMessages(ctx, 'chat987', { since: '2020-01-01' });
    expect((out.data as unknown[]).length).toBe(500);
    expect(out.next).toBe('1501');
    expect(out.notes.join(' ')).toContain('500');
  });

  it('файлы — без ссылок, системные помечены, длинный текст обрезан', async () => {
    const { ctx } = fakeContext({
      'im.dialog.get': () => ({ json: { result: { last_message_id: 3 } } }),
      'im.dialog.messages.get': () => ({
        json: {
          result: {
            messages: [
              msg(3, undefined, { text: 'а'.repeat(5000) }),
              msg(2, undefined, { params: { FILE_ID: [77] }, text: '' }),
              msg(1, undefined, { author_id: 0, text: 'Иван вошёл в чат' }),
            ],
            users: { 5: { id: 5, name: 'Иван Петров' } },
            files: [{ id: 77, name: 'Договор.pdf', size: 1000, type: 'file', urlDownload: 'https://x/disk/downloadFile/77/', urlShow: 'https://x/show', viewerAttrs: { src: 'https://x/?token=a' } }],
          },
        },
      }),
    });
    const out = await chatsMessages(ctx, 'chat987', {});
    const data = out.data as M[];
    expect(data[0]).toMatchObject({ id: 1, system: true, author: { id: 0, name: 'система' } });
    expect(data[1]?.files).toEqual([{ fileId: 77, name: 'Договор.pdf', size: 1000, type: 'file' }]);
    expect(data[2]).toMatchObject({ truncated: true });
    expect(String(data[2]?.text)).toHaveLength(4000);
    expect(JSON.stringify(out)).not.toMatch(/urlDownload|urlShow|viewerAttrs|token=/);
  });

  it('--after — более новые сообщения по возрастанию, next для --after', async () => {
    const { ctx, calls } = fakeContext({
      'im.dialog.messages.get': (b) => ({
        json: { result: { messages: Array.from({ length: Number(b.LIMIT) }, (_, i) => msg(Number(b.FIRST_ID) + i + 1)), users: USERS } },
      }),
    });
    const out = await chatsMessages(ctx, 'chat987', { after: '100', limit: '60' });
    expect(calls.map((c) => c.body.FIRST_ID)).toEqual([100, 150]);
    expect((out.data as { id: number }[]).map((m) => m.id)).toEqual(Array.from({ length: 60 }, (_, i) => 101 + i));
    expect(out.next).toBe('160');
    await expect(chatsMessages(ctx, 'chat987', { after: '100', since: '2026-11-01' })).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
  });

  it('403 — APP_B24_ACCESS_DENIED; неверный dialogId — APP_CLI_INVALID_ARGUMENT', async () => {
    const { ctx } = fakeContext({ 'im.dialog.get': () => ({ status: 403, json: { error: 'ACCESS_ERROR', error_description: 'x' } }) });
    await expect(chatsMessages(ctx, 'chat987', {})).rejects.toMatchObject({ code: 'APP_B24_ACCESS_DENIED' });
    await expect(chatsMessages(ctx, 'группа', {})).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
    await expect(chatsMessages(ctx, 'chat1', { before: '5', after: '3' })).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
  });
});

describe('chats recent', () => {
  const item = (id: string, type: string, counter: number, unread = false) => ({
    id,
    type,
    title: `диалог ${id}`,
    counter,
    unread,
    date_update: '2026-11-10T10:00:00+03:00',
    message: { text: '[B]привет[/B]', date: '2026-11-10T10:00:00+03:00', author_id: 5 },
    chat: type === 'chat' ? { type: 'open', entity_type: 'TASKS_TASK', entity_id: '15' } : {},
  });

  it('нормализует dialogId, убирает дубли, непрочитанное — по counter', async () => {
    const { ctx, calls } = fakeContext({
      'im.recent.list': () => ({
        json: { result: { items: [item('chat10', 'chat', 2), item('chat10', 'chat', 2), item('5', 'user', 0, true), item('chat11', 'chat', 0)], hasMore: true } },
      }),
    });
    const out = await chatsRecent(ctx, { unread: true });
    expect(calls[0]?.body).toMatchObject({ SKIP_OPENLINES: 'Y', UNREAD_ONLY: 'Y', LIMIT: 20, OFFSET: 0 });
    const data = out.data as M[];
    expect(data.map((d) => d.dialogId)).toEqual(['chat10']);
    expect(data[0]).toMatchObject({ unreadCount: 2, markedUnread: false, entity: { type: 'TASKS_TASK', id: '15' } });
    expect((data[0]?.lastMessage as M).text).toBe('привет');
    expect(decodeCursor(String(out.next), '--page', (v): v is { o: number } => typeof (v as { o?: unknown }).o === 'number')).toEqual({ o: 20 });
  });

  it('диалог неизвестного вида пропускается с пометкой, а не роняет весь список', async () => {
    const { ctx } = fakeContext({ 'im.recent.list': () => ({ json: { result: { items: [item('chat10', 'chat', 0), { id: 'странный', title: 'x' }], hasMore: false } } }) });
    const out = await chatsRecent(ctx, {});
    expect((out.data as M[]).map((d) => d.dialogId)).toEqual(['chat10']);
    expect(out.notes.join(' ')).toContain('Пропущено');
  });

  it('--type private пропускает групповые', async () => {
    const { ctx, calls } = fakeContext({ 'im.recent.list': () => ({ json: { result: { items: [], hasMore: false } } }) });
    const out = await chatsRecent(ctx, { type: 'private' });
    expect(calls[0]?.body).toMatchObject({ SKIP_CHAT: 'Y' });
    expect(out.next).toBeNull();
    expect(out.notes[0]).toContain('Ничего не найдено');
  });
});

describe('chats find, info, counters, search', () => {
  it('find — короче 2 символов отказ; иначе dialogId chat<N>', async () => {
    const { ctx } = fakeContext({ 'im.search.chat.list': () => ({ json: { result: [{ id: 42, name: 'Проект', type: 'open', entity_type: '', message_count: 3 }], total: 1 } }) });
    await expect(chatsFind(ctx, 'а')).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
    expect((await chatsFind(ctx, 'Проект')).data).toEqual([{ dialogId: 'chat42', title: 'Проект', type: 'open', entity: null, messageCount: 3 }]);
  });

  it('find — запись без номера чата пропускается, а не превращается в chatnull', async () => {
    const { ctx } = fakeContext({ 'im.search.chat.list': () => ({ json: { result: [{ name: 'Без номера' }, { id: 7, name: 'С номером', type: 'chat' }] } }) });
    expect(((await chatsFind(ctx, 'номер')).data as { dialogId: string }[]).map((c) => c.dialogId)).toEqual(['chat7']);
  });

  it('info — участники до 50 и общее число', async () => {
    const members = Array.from({ length: 300 }, (_, i) => ({ id: i + 1, name: `Сотрудник ${i + 1}`, work_position: 'Инженер' }));
    const { ctx, calls } = fakeContext({
      'im.dialog.get': () => ({ json: { result: { id: 42, name: 'Общий', type: 'open', owner: 1, user_counter: 300, message_count: 10, last_message_id: 99, entity_type: '' } } }),
      'im.dialog.users.list': (b) => ({ json: { result: members.slice(0, Number(b.LIMIT)), total: 300 } }),
    });
    const data = (await chatsInfo(ctx, 'chat42')).data as M;
    expect(calls[1]?.body).toMatchObject({ DIALOG_ID: 'chat42', LIMIT: 50 });
    expect((data.members as unknown[]).length).toBe(50);
    expect(data.membersTotal).toBe(300);
  });

  it('counters — только числа', async () => {
    const { ctx } = fakeContext({ 'im.counters.get': () => ({ json: { result: { TYPE: { ALL: 5, CHAT: 2, DIALOG: 3 }, CHAT_UNREAD: [1] } } }) });
    expect((await chatsCounters(ctx)).data).toEqual({ total: 5, byType: { ALL: 5, CHAT: 2, DIALOG: 3 } });
  });

  it('search — CHAT_ID числом из im.dialog.get, текст ≤2 символов — отказ', async () => {
    const { ctx, calls } = fakeContext({
      'im.dialog.get': () => ({ json: { result: { id: 987 } } }),
      'im.dialog.messages.search': () => ({ json: { result: { messages: [{ id: 5, authorId: 5, date: '2026-11-10T10:00:00+03:00', text: 'договор', isSystem: false, params: {} }], users: [{ id: 5, firstName: 'Иван', lastName: 'Петров' }] } } }),
    });
    await expect(chatsSearch(ctx, 'chat987', 'ок', {})).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
    const out = await chatsSearch(ctx, 'sg15', 'договор', { since: '2026-11-01' });
    expect(calls.find((c) => c.method === 'im.dialog.messages.search')?.body).toMatchObject({ CHAT_ID: 987, SEARCH_MESSAGE: 'договор', DATE_FROM: expect.stringMatching(/^2026-11-01T00:00:00/) });
    expect((out.data as M[])[0]).toMatchObject({ id: 5, author: { id: 5, name: 'Иван Петров' }, text: 'договор' });
  });
});
