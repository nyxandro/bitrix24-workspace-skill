import { describe, expect, it } from 'vitest';
import { notifications } from './notifications.js';
import { fakeContext } from './testkit.js';

describe('notifications', () => {
  it('отдаёт уведомления и курсор по последнему', async () => {
    const items = [
      { id: 30, notify_type: 1, author_id: 5, date: '2026-11-10T10:00:00+03:00', text: '[USER=5]Иван[/USER] поручил задачу', notify_module: 'tasks', notify_title: '', notify_read: 'N' },
      { id: 29, notify_type: 2, author_id: 0, date: '2026-11-09T10:00:00+03:00', text: 'Системное', notify_module: 'im', notify_title: '', notify_read: 'Y' },
    ];
    const { ctx, calls } = fakeContext({ 'im.notify.get': () => ({ json: { result: { notifications: items, users: [{ id: 5, name: 'Иван Петров' }] } } }) });
    const out = await notifications(ctx, { limit: '2' });
    expect(calls[0]?.body).toEqual({ LIMIT: 2 });
    const data = out.data as Record<string, unknown>[];
    expect(data[0]).toMatchObject({ id: 30, from: { id: 5, name: 'Иван Петров' }, text: '@Иван поручил задачу', read: false });
    expect(data[1]).toMatchObject({ from: null, read: true });
    expect(out.next).not.toBeNull();
    const { calls: calls2, ctx: ctx2 } = fakeContext({ 'im.notify.get': () => ({ json: { result: { notifications: [] } } }) });
    await notifications(ctx2, { before: String(out.next) });
    expect(calls2[0]?.body).toEqual({ LIMIT: 20, LAST_ID: 29, LAST_TYPE: 3 });
  });
});
