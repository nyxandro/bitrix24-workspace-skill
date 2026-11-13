/**
 * mail boxes|list|get|thread — почта сотрудника (REST 3.0).
 *
 * В списке тело письма не выводим (оно приходит у каждого письма целиком), url
 * и привязки — тоже. Даты почта отдаёт без смещения («ГГГГ-ММ-ДД чч:мм:сс»):
 * показываем их как есть, без выдуманной зоны (шаг 0, V12).
 */
import { MAX_TEXT_CHARS } from '../config/config.js';
import { parseInputDate } from '../render/dates.js';
import { mailBodyToText } from '../render/html.js';
import type { Envelope } from '../render/output.js';
import { truncate } from '../render/text.js';
import { asArray, type CommandContext, decodeCursor, encodeCursor, envelope, isObject, type Json, num, parseId, parseLimit, str } from './common.js';

const PREVIEW_CHARS = 300;
const isPageCursor = (v: unknown): v is { p: number } => isObject(v) && typeof v.p === 'number' && Number.isSafeInteger(v.p) && v.p >= 1;

function mailDate(raw: unknown): string {
  const value = str(raw);
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(' ', 'T') : value;
}

function address(raw: unknown): string {
  return Array.isArray(raw) ? raw.map((a) => (isObject(a) ? `${str(a.name)} <${str(a.email)}>`.trim() : str(a))).join(', ') : str(raw);
}

function header(m: Json) {
  return {
    id: num(m.id),
    mailboxId: num(m.mailboxId),
    subject: str(m.subject),
    from: address(m.from),
    to: address(m.to),
    cc: address(m.cc),
    date: mailDate(m.date),
    seen: m.isSeen === true,
    hasAttachments: m.hasAttachments === true,
  };
}

export async function mailBoxes(ctx: CommandContext): Promise<Envelope> {
  const resp = await ctx.client.callV3<Json>('mail.mailbox.list');
  const data = asArray(resp.items).filter(isObject).map((b) => ({ id: num(b.id), email: str(b.email), name: str(b.name) }));
  return envelope(data, null, data.length === 0 ? ['Почтовых ящиков нет.'] : []);
}

export async function mailList(
  ctx: CommandContext,
  opts: { box?: string; search?: string; since?: string; until?: string; unread?: boolean; folder?: string; withAttachments?: boolean; limit?: string; page?: string },
): Promise<Envelope> {
  const limit = parseLimit(opts.limit, 20, 50);
  const page = opts.page ? decodeCursor(opts.page, '--page', isPageCursor).p : 1;
  const params: Json = {};
  if (opts.box) params.mailboxId = parseId(opts.box, '--box');
  if (opts.search?.trim()) params.searchQuery = opts.search.trim();
  if (opts.since) params.dateFrom = parseInputDate(opts.since, 'start', '--since', ctx.tz);
  if (opts.until) params.dateTo = parseInputDate(opts.until, 'end', '--until', ctx.tz);
  if (opts.unread) params.isSeen = false;
  if (opts.withAttachments) params.hasAttachments = true;
  if (opts.folder?.trim()) params.folder = opts.folder.trim();
  params.pagination = { limit, page };
  const resp = await ctx.client.callV3<Json>('mail.message.list', params);
  const items = asArray(resp.items).filter(isObject);
  const next = items.length >= limit ? encodeCursor({ p: page + 1 }) : null;
  const notes = items.length === 0 ? ['Писем не найдено.'] : next ? ['Есть ещё письма: --page <next>.'] : [];
  return envelope(items.map(header), next, notes);
}

export async function mailGet(ctx: CommandContext, idRaw: string, opts: { full?: boolean }): Promise<Envelope> {
  const resp = await ctx.client.callV3<Json>('mail.message.get', { id: parseId(idRaw, 'id') });
  const item = isObject(resp.item) ? resp.item : resp;
  const text = mailBodyToText(str(item.body));
  const cut = opts.full ? { text, truncated: false } : truncate(text, MAX_TEXT_CHARS);
  return envelope(
    { ...header(item), text: cut.text, ...(cut.truncated ? { truncated: true } : {}) },
    null,
    cut.truncated ? [`Текст обрезан на ${MAX_TEXT_CHARS} знаков, полностью — --full.`] : [],
  );
}

export async function mailThread(ctx: CommandContext, idRaw: string, opts: { limit?: string }): Promise<Envelope> {
  const limit = parseLimit(opts.limit, 20, 50);
  // Цепочку Битрикс отдаёт просто массивом писем, а не объектом {items} (проверено на портале).
  const resp = await ctx.client.callV3<unknown>('mail.message.thread', { id: parseId(idRaw, 'id'), limit });
  const data = (Array.isArray(resp) ? resp : asArray(isObject(resp) ? resp.items : []))
    .filter(isObject)
    .map((m) => ({ id: num(m.id), subject: str(m.subject), from: address(m.from), date: mailDate(m.date), preview: truncate(mailBodyToText(str(m.body)), PREVIEW_CHARS).text }));
  return envelope(data);
}
