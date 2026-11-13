import { describe, expect, it } from 'vitest';
import { mailBoxes, mailGet, mailList, mailThread } from './mail.js';
import { fakeContext } from './testkit.js';

type M = Record<string, unknown>;
const letter = (id: number, body = 'текст') => ({ id, mailboxId: 1, mailboxEmail: 'me@x.ru', subject: `Письмо ${id}`, from: 'Поставщик <s@x.ru>', to: 'me@x.ru', cc: '', date: '2026-11-10 10:00:00', isSeen: false, hasAttachments: true, url: 'https://x/mail/1', bindings: [], body });

describe('mail', () => {
  it('boxes', async () => {
    const { ctx } = fakeContext({ 'mail.mailbox.list': () => ({ json: { result: { items: [{ id: 1, name: 'Рабочий', email: 'me@x.ru', senderName: 'Я' }] } } }) });
    expect((await mailBoxes(ctx)).data).toEqual([{ id: 1, email: 'me@x.ru', name: 'Рабочий' }]);
  });

  it('list — фильтры, тела в списке нет, лимит до 50, курсор по странице', async () => {
    const { ctx, calls } = fakeContext({ 'mail.message.list': () => ({ json: { result: { items: [letter(1), letter(2)] } } }) });
    await expect(mailList(ctx, { limit: '60' })).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
    const out = await mailList(ctx, { box: '1', search: 'поставщик', since: '2026-11-01', unread: true, withAttachments: true, limit: '2' });
    expect(calls[0]?.body).toEqual({
      mailboxId: 1,
      searchQuery: 'поставщик',
      dateFrom: '2026-11-01T00:00:00+03:00',
      isSeen: false,
      hasAttachments: true,
      pagination: { limit: 2, page: 1 },
    });
    const data = out.data as M[];
    expect(data[0]).toEqual({ id: 1, mailboxId: 1, subject: 'Письмо 1', from: 'Поставщик <s@x.ru>', to: 'me@x.ru', cc: '', date: '2026-11-10T10:00:00', seen: false, hasAttachments: true });
    expect(JSON.stringify(out)).not.toMatch(/"body"|"url"/);
    expect(out.next).not.toBeNull();
  });

  it('get — HTML в текст с обрезкой, обычный текст как есть, --full целиком', async () => {
    const html = `<html><body><p>Добрый день</p>${'<p>строка</p>'.repeat(2000)}</body></html>`;
    const { ctx } = fakeContext({ 'mail.message.get': [() => ({ json: { result: { item: letter(15, html) } } }), () => ({ json: { result: { item: letter(15, html) } } }), () => ({ json: { result: { item: letter(16, 'строка 1\nстрока 2') } } })] });
    const cut = (await mailGet(ctx, '15', {})).data as M;
    expect(cut.truncated).toBe(true);
    expect(String(cut.text)).toHaveLength(4000);
    expect(String(cut.text).startsWith('Добрый день')).toBe(true);
    const full = (await mailGet(ctx, '15', { full: true })).data as M;
    expect(String(full.text).length).toBeGreaterThan(4000);
    expect(((await mailGet(ctx, '16', {})).data as M).text).toBe('строка 1\nстрока 2');
  });

  it('thread — цепочка с началом текста', async () => {
    const { ctx, calls } = fakeContext({ 'mail.message.thread': () => ({ json: { result: { items: [letter(1, 'а'.repeat(1000)), letter(2)] } } }) });
    const data = (await mailThread(ctx, '1', {})).data as M[];
    expect(calls[0]?.body).toEqual({ id: 1, limit: 20 });
    expect(String(data[0]?.preview)).toHaveLength(300);
  });

  it('thread — писем столько же, сколько --limit: пометка, что цепочка может быть длиннее', async () => {
    const { ctx } = fakeContext({ 'mail.message.thread': () => ({ json: { result: [letter(1), letter(2)] } }) });
    expect((await mailThread(ctx, '1', { limit: '2' })).notes.join(' ')).toContain('--limit');
    expect((await mailThread(ctx, '1', { limit: '3' })).notes).toEqual([]);
  });

  it('thread — Битрикс отдаёт цепочку просто массивом', async () => {
    const { ctx } = fakeContext({ 'mail.message.thread': () => ({ json: { result: [letter(1), letter(2)] } }) });
    expect(((await mailThread(ctx, '1', {})).data as M[]).map((m) => m.id)).toEqual([1, 2]);
  });

  it('нет права — APP_B24_SCOPE_MISSING', async () => {
    const { ctx } = fakeContext({ 'mail.mailbox.list': () => ({ status: 403, json: { error: { code: 'BITRIX_REST_V3_EXCEPTION_INSUFFICIENTSCOPEEXCEPTION', message: 'x' } } }) });
    await expect(mailBoxes(ctx)).rejects.toMatchObject({ code: 'APP_B24_SCOPE_MISSING' });
  });
});
