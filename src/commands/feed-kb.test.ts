import { describe, expect, it } from 'vitest';
import { feedList, feedPost } from './feed.js';
import { kbDoc, kbList, kbSearch, kbTree } from './kb.js';
import { fakeContext } from './testkit.js';

type M = Record<string, unknown>;
const post = (id: number, text = '[B]Новость[/B]') => ({ ID: String(id), AUTHOR_ID: '5', TITLE: `Пост ${id}`, DETAIL_TEXT: text, DATE_PUBLISH: '2026-11-10T10:00:00+03:00', NUM_COMMENTS: '2', UF_BLOG_POST_FILE: [1] });
const users = () => ({ json: { result: [{ ID: '5', NAME: 'Иван', LAST_NAME: 'Петров' }, { ID: '6', NAME: 'Анна', LAST_NAME: 'С' }] } });

describe('feed', () => {
  it('list — курсорный режим LAST_ID + LIMIT: посты по порядку записей, без повторов и пропусков', async () => {
    const { ctx, calls } = fakeContext({
      'log.blogpost.get': [
        () => ({ json: { result: { 0: post(2, 'а'.repeat(2000)), 1: post(1), next: 777 } } }),
        () => ({ json: { result: [] } }),
      ],
      'user.get': users,
    });
    const out = await feedList(ctx, { since: '2026-11-01', limit: '2' });
    expect(calls[0]?.body).toEqual({ LOG_DATE_FROM: '2026-11-01T00:00:00+03:00', LAST_ID: 0, LIMIT: 2 });
    const data = out.data as M[];
    expect(data.map((p) => p.id)).toEqual([2, 1]);
    expect(data[0]).toMatchObject({ author: { id: 5, name: 'Иван Петров' }, title: 'Пост 2', comments: 2, truncated: true });
    expect(String(data[0]?.text)).toHaveLength(1000);
    const last = await feedList(ctx, { since: '2026-11-01', limit: '2', page: String(out.next) });
    expect(calls.filter((c) => c.method === 'log.blogpost.get')[1]?.body).toMatchObject({ LAST_ID: 777, LIMIT: 2 });
    expect(last.next).toBeNull();
  });

  it('list — вид ответа живого портала: посты массивом, next на верхнем уровне', async () => {
    const { ctx, calls } = fakeContext({
      'log.blogpost.get': [() => ({ json: { result: [post(890), post(889)], next: 91164 } }), () => ({ json: { result: [post(888)] } })],
      'user.get': users,
    });
    const out = await feedList(ctx, { limit: '2' });
    expect((out.data as M[]).map((p) => p.id)).toEqual([890, 889]);
    await feedList(ctx, { limit: '2', page: String(out.next) });
    expect(calls.filter((c) => c.method === 'log.blogpost.get')[1]?.body).toEqual({ LAST_ID: 91164, LIMIT: 2 });
  });

  it('post — нет такого поста: APP_B24_NOT_FOUND; комментарии по порядку', async () => {
    const { ctx } = fakeContext({ 'log.blogpost.get': () => ({ json: { result: [] } }) });
    await expect(feedPost(ctx, '99', {})).rejects.toMatchObject({ code: 'APP_B24_NOT_FOUND' });
  });

  it('post — пост и комментарии, без ссылок на файлы', async () => {
    const { ctx, calls } = fakeContext({
      'log.blogpost.get': () => ({ json: { result: [post(42)] } }),
      'log.blogcomment.get': () => ({
        json: {
          result: {
            COMMENTS: [{ id: 1, author_id: 6, date: '2026-11-10T11:00:00+03:00', text: 'Согласна', attach: [] }],
            FILES: [{ id: 1, urlDownload: 'https://x/?token=1', urlShow: 'https://x' }],
          },
        },
      }),
      'user.get': users,
    });
    const data = (await feedPost(ctx, '42', { comments: '5' })).data as M;
    expect(calls.find((c) => c.method === 'log.blogcomment.get')?.body).toEqual({ POST_ID: 42, LIMIT: 5 });
    expect(data).toMatchObject({ id: 42, text: 'Новость', comments: [{ id: 1, author: { id: 6, name: 'Анна С' }, date: '2026-11-10T11:00:00+03:00', text: 'Согласна' }] });
    expect(JSON.stringify(data)).not.toMatch(/url|token/i);
  });
});

describe('feed: чистый текст', () => {
  it('в заголовке раскодируются сущности, переводы строк Windows приводятся к обычным', async () => {
    const raw = { ...post(7, 'Всем привет!\r\n\r\nПродукт &quot;Мониторинг&quot;'), TITLE: 'Всем привет! Продукт &quot;Мониторинг&quot; &#8470;5 &laquo;x&raquo; &mdash; a&copy=1' };
    const { ctx } = fakeContext({ 'log.blogpost.get': () => ({ json: { result: [raw] } }), 'log.blogcomment.get': () => ({ json: { result: { COMMENTS: [] } } }), 'user.get': users });
    const listed = ((await feedList(ctx, {})).data as M[])[0] as M;
    expect(listed).toMatchObject({ title: 'Всем привет! Продукт "Мониторинг" №5 «x» — a&copy=1', text: 'Всем привет!\n\nПродукт "Мониторинг"' });
    expect((await feedPost(ctx, '7', {})).data).toMatchObject({ title: 'Всем привет! Продукт "Мониторинг" №5 «x» — a&copy=1', text: 'Всем привет!\n\nПродукт "Мониторинг"' });
  });
});

describe('feed post: комментариев больше, чем показано', () => {
  it('commentsTotal и пометка, как дочитать', async () => {
    const { ctx } = fakeContext({
      'log.blogpost.get': () => ({ json: { result: [{ ...post(42), NUM_COMMENTS: '30' }] } }),
      'log.blogcomment.get': () => ({ json: { result: { COMMENTS: [{ id: 29, author_id: 6, date: 'd', text: 'a' }, { id: 30, author_id: 6, date: 'd', text: 'b' }] } } }),
      'user.get': users,
    });
    const out = await feedPost(ctx, '42', { comments: '2' });
    expect(out.data).toMatchObject({ commentsTotal: 30 });
    expect(out.notes.join(' ')).toContain('последние 2 комментариев из 30');
  });

  it('показаны все — пометки нет', async () => {
    const { ctx } = fakeContext({
      'log.blogpost.get': () => ({ json: { result: [{ ...post(42), NUM_COMMENTS: '1' }] } }),
      'log.blogcomment.get': () => ({ json: { result: { COMMENTS: [{ id: 1, author_id: 6, date: 'd', text: 'a' }] } } }),
      'user.get': users,
    });
    const out = await feedPost(ctx, '42', {});
    expect(out.data).toMatchObject({ commentsTotal: 1 });
    expect(out.notes).toEqual([]);
  });
});

describe('kb', () => {
  it('list — базы и курсор nextCursor', async () => {
    const { ctx, calls } = fakeContext({ 'note.collection.list': () => ({ json: { result: { items: [{ id: 1, name: 'База', isArchived: false, updatedAt: '2026-11-01T10:00:00+03:00' }], nextCursor: { position: 1, id: 1 } } } }) });
    const out = await kbList(ctx, {});
    expect(out.data).toEqual([{ id: 1, name: 'База', updatedAt: '2026-11-01T10:00:00+03:00', archived: false }]);
    await kbList(ctx, { page: String(out.next) });
    expect(calls[1]?.body).toEqual({ pagination: { limit: 20, afterCursor: { position: 1, id: 1 } } });
  });

  it('search — от 3 символов, находки с выдержкой', async () => {
    const { ctx, calls } = fakeContext({ 'note.document.search.list': () => ({ json: { result: { items: [{ documentId: 7, collectionId: 1, title: 'Отпуск', snippet: 'Как оформить [B]отпуск[/B]', score: 0.9 }], hasMore: true } } }) });
    await expect(kbSearch(ctx, 'от', {})).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
    const out = await kbSearch(ctx, 'отпуск', {});
    expect(calls[0]?.body).toEqual({ query: 'отпуск', pagination: { limit: 20 } });
    expect(out.data).toEqual([{ id: 7, collectionId: 1, title: 'Отпуск', snippet: 'Как оформить отпуск' }]);
    expect(out.notes.join(' ')).toContain('уточните');
  });

  it('tree — оглавление с уровнями', async () => {
    const { ctx } = fakeContext({
      'note.document.tree.list': () => ({ json: { result: { items: [{ id: 1, title: 'Раздел', children: [{ id: 2, title: 'Документ', children: [] }] }], truncated: false } } }),
    });
    expect((await kbTree(ctx, '1')).data).toEqual([
      { id: 1, title: 'Раздел', level: 0 },
      { id: 2, title: 'Документ', level: 1 },
    ]);
  });

  it('doc — нет документа: APP_B24_NOT_FOUND', async () => {
    const { ctx } = fakeContext({ 'note.document.get': () => ({ json: { result: {} } }) });
    await expect(kbDoc(ctx, '7', {})).rejects.toMatchObject({ code: 'APP_B24_NOT_FOUND' });
  });

  it('doc — Markdown как есть, обрезка и --full', async () => {
    const md = `# Отпуск\n\n${'текст '.repeat(1000)}`;
    const { ctx } = fakeContext({ 'note.document.get': () => ({ json: { result: { item: { id: 7, collectionId: 1, title: 'Отпуск', markdown: md, updatedAt: 'x', contentUpdatedAt: '2026-11-01T10:00:00+03:00' } } } }) });
    const cut = (await kbDoc(ctx, '7', {})).data as M;
    expect(String(cut.text).startsWith('# Отпуск')).toBe(true);
    expect(cut.truncated).toBe(true);
    expect(String(((await kbDoc(ctx, '7', { full: true })).data as M).text)).toBe(md);
  });
});
