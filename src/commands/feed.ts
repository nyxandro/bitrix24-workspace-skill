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
  notFound,
  num,
  parseId,
  parseLimit,
  str,
} from './common.js';

const PREVIEW_CHARS = 1000;
const MAX_COMMENTS = 50;
// Курсорный режим ленты (LAST_ID + LIMIT): записи по номеру, без повторов и пропусков.
// В режиме start лента сортируется по дате обновления, и новый комментарий сдвигает пост
// между страницами (log-blogpost-get.md).
const isFeedCursor = (v: unknown): v is { l: number } => isObject(v) && Number.isSafeInteger(v.l) && (v.l as number) > 0;

function plain(raw: string, tz: string): string {
  const text = bbToText(raw, new Map(), tz);
  return looksLikeHtml(text) ? htmlToText(text) : text;
}

export async function feedList(ctx: CommandContext, opts: { since?: string; until?: string; limit?: string; page?: string }): Promise<Envelope> {
  const limit = parseLimit(opts.limit, 20, 50);
  const params: Json = {};
  if (opts.since) params.LOG_DATE_FROM = parseInputDate(opts.since, 'start', '--since', ctx.tz);
  if (opts.until) params.LOG_DATE_TO = parseInputDate(opts.until, 'end', '--until', ctx.tz);
  params.LAST_ID = opts.page ? decodeCursor(opts.page, '--page', isFeedCursor).l : 0;
  params.LIMIT = limit;
  const resp = await ctx.client.call<unknown>('log.blogpost.get', params);
  // По документации в курсорном режиме result — объект с постами под числовыми ключами и
  // полем next внутри; живой портал отдаёт посты массивом, а next — на верхнем уровне
  // ответа (проверено). Поддерживаем оба вида. next — номер записи ленты, не поста.
  const result = resp.result;
  const posts = Array.isArray(result)
    ? result.filter(isObject)
    : isObject(result)
      ? Object.keys(result)
          .filter((k) => /^\d+$/.test(k))
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => result[k])
          .filter(isObject)
      : [];
  const nextId = typeof resp.next === 'number' ? resp.next : isObject(result) ? num(result.next) : null;
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
  const next = nextId !== null && nextId > 0 ? encodeCursor({ l: nextId }) : null;
  const notes = data.length === 0 ? ['Постов нет на этой странице.'] : ['Полный текст поста и комментарии — feed post <id>.'];
  if (next) notes.push('Есть ещё посты: --page <next>.');
  return envelope(data, next, notes);
}

export async function feedPost(ctx: CommandContext, idRaw: string, opts: { full?: boolean; comments?: string }): Promise<Envelope> {
  const id = parseId(idRaw, 'id');
  const limit = parseLimit(opts.comments, 20, MAX_COMMENTS, '--comments');
  const resp = await ctx.client.call<unknown>('log.blogpost.get', { POST_ID: id });
  const p = asArray(resp.result).filter(isObject)[0];
  if (!p) throw notFound();
  const commentsResp = await ctx.client.call<Json>('log.blogcomment.get', { POST_ID: id, LIMIT: limit });
  const comments = (isObject(commentsResp.result) ? asArray(commentsResp.result.COMMENTS).filter(isObject) : []).sort(
    (a, b) => (num(a.id) ?? 0) - (num(b.id) ?? 0),
  );
  const names = await lookupNames(ctx, [num(p.AUTHOR_ID) ?? 0, ...comments.map((c) => num(c.author_id) ?? 0)]);
  const authorId = num(p.AUTHOR_ID) ?? 0;
  const text = plain(str(p.DETAIL_TEXT), ctx.tz);
  const cut = opts.full ? { text, truncated: false } : truncate(text, MAX_TEXT_CHARS);
  // Без курсора Битрикс отдаёт последние комментарии (log-blogcomment-get.md).
  const commentsTotal = Math.max(num(p.NUM_COMMENTS) ?? 0, comments.length);
  const more = limit < MAX_COMMENTS ? `больше — --comments (до ${MAX_COMMENTS})` : 'более ранние команда не показывает';
  const notes = commentsTotal > comments.length ? [`Показаны последние ${comments.length} комментариев из ${commentsTotal}; ${more}.`] : [];
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
    commentsTotal,
  }, null, notes);
}
