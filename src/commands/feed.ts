/**
 * feed list|post — живая лента (новости компании) и комментарии.
 */
import { MAX_TEXT_CHARS } from '../config/config.js';
import { parseInputDate } from '../render/dates.js';
import { htmlToText, looksLikeHtml } from '../render/html.js';
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
  lookupNames,
  nameOf,
  num,
  parseId,
  parseLimit,
  str,
  unexpected,
} from './common.js';

const PREVIEW_CHARS = 1000;
// Страница ленты всегда 50 записей (log-blogpost-get.md); курсор помнит, сколько
// уже показано с текущей страницы, чтобы при --limit меньше 50 ничего не терялось.
const isFeedCursor = (v: unknown): v is { s: number; k: number } =>
  isObject(v) && Number.isSafeInteger(v.s) && Number.isSafeInteger(v.k) && (v.s as number) >= 0 && (v.k as number) >= 0;

function plain(raw: string, tz: string): string {
  const text = bbToText(raw, new Map(), tz);
  return looksLikeHtml(text) ? htmlToText(text) : text;
}

export async function feedList(ctx: CommandContext, opts: { since?: string; until?: string; limit?: string; page?: string }): Promise<Envelope> {
  const limit = parseLimit(opts.limit, 20, 50);
  const cursor = opts.page ? decodeCursor(opts.page, '--page', isFeedCursor) : { s: 0, k: 0 };
  const params: Json = {};
  if (opts.since) params.LOG_DATE_FROM = parseInputDate(opts.since, 'start', '--since', ctx.tz);
  if (opts.until) params.LOG_DATE_TO = parseInputDate(opts.until, 'end', '--until', ctx.tz);
  params.start = cursor.s;
  const resp = await ctx.client.call<unknown>('log.blogpost.get', params);
  const page = asArray(resp.result).filter(isObject);
  const posts = page.slice(cursor.k, cursor.k + limit);
  const names = await lookupNames(ctx, posts.map((p) => num(p.AUTHOR_ID) ?? 0));
  const data = posts.map((p) => {
    const authorId = num(p.AUTHOR_ID) ?? 0;
    const cut = truncate(plain(str(p.DETAIL_TEXT), ctx.tz), PREVIEW_CHARS);
    return {
      id: num(p.ID),
      date: str(p.DATE_PUBLISH),
      author: { id: authorId, name: nameOf(names, authorId) },
      title: str(p.TITLE),
      text: cut.text,
      ...(cut.truncated ? { truncated: true } : {}),
      comments: num(p.NUM_COMMENTS) ?? 0,
    };
  });
  let next: { s: number; k: number } | null = null;
  if (cursor.k + limit < page.length) next = { s: cursor.s, k: cursor.k + limit };
  else if (typeof resp.next === 'number') next = { s: resp.next, k: 0 };
  const notes = data.length === 0 ? ['Постов нет за этот период.'] : ['Полный текст поста и комментарии — feed post <id>.'];
  if (next) notes.push('Есть ещё посты: --page <next>.');
  return envelope(data, next ? encodeCursor(next) : null, notes);
}

export async function feedPost(ctx: CommandContext, idRaw: string, opts: { full?: boolean; comments?: string }): Promise<Envelope> {
  const id = parseId(idRaw, 'id');
  const limit = parseLimit(opts.comments, 20, 50, '--comments');
  const resp = await ctx.client.call<unknown>('log.blogpost.get', { POST_ID: id });
  const p = asArray(resp.result).filter(isObject)[0];
  if (!p) throw unexpected('log.blogpost.get.result');
  const commentsResp = await ctx.client.call<Json>('log.blogcomment.get', { POST_ID: id, LIMIT: limit });
  const comments = isObject(commentsResp.result) ? asArray(commentsResp.result.COMMENTS).filter(isObject) : [];
  const names = await lookupNames(ctx, [num(p.AUTHOR_ID) ?? 0, ...comments.map((c) => num(c.author_id) ?? 0)]);
  const authorId = num(p.AUTHOR_ID) ?? 0;
  const text = plain(str(p.DETAIL_TEXT), ctx.tz);
  const cut = opts.full ? { text, truncated: false } : truncate(text, MAX_TEXT_CHARS);
  return envelope({
    id,
    date: str(p.DATE_PUBLISH),
    author: { id: authorId, name: nameOf(names, authorId) },
    title: str(p.TITLE),
    text: cut.text,
    ...(cut.truncated ? { truncated: true } : {}),
    comments: comments.map((c) => {
      const cid = num(c.author_id) ?? 0;
      return { id: num(c.id), author: { id: cid, name: nameOf(names, cid) }, date: str(c.date), text: truncate(plain(str(c.text), ctx.tz), MAX_TEXT_CHARS).text };
    }),
  });
}
