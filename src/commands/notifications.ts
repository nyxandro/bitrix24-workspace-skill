/**
 * notifications — уведомления сотрудника: упоминания, поручения, приглашения.
 */
import { MAX_TEXT_CHARS } from '../config/config.js';
import type { Envelope } from '../render/output.js';
import { bbToText, truncate } from '../render/text.js';
import { asArray, type CommandContext, decodeCursor, encodeCursor, envelope, isObject, type Json, num, parseLimit, peopleMap, str } from './common.js';

const isNotifyCursor = (v: unknown): v is { id: number; t: 1 | 3 } =>
  isObject(v) && typeof v.id === 'number' && Number.isSafeInteger(v.id) && (v.t === 1 || v.t === 3);

export async function notifications(ctx: CommandContext, opts: { limit?: string; before?: string }): Promise<Envelope> {
  const limit = parseLimit(opts.limit, 20, 50);
  const params: Json = { LIMIT: limit };
  if (opts.before) {
    // im.notify.get листается парой LAST_ID + LAST_TYPE последнего элемента (im-notify-get.md).
    const c = decodeCursor(opts.before, '--before', isNotifyCursor);
    params.LAST_ID = c.id;
    params.LAST_TYPE = c.t;
  }
  const resp = await ctx.client.call<Json>('im.notify.get', params);
  const result = isObject(resp.result) ? resp.result : {};
  const users = peopleMap(result.users);
  const items = asArray(result.notifications).filter(isObject);
  const data = items.map((n) => {
    const authorId = num(n.author_id) ?? 0;
    return {
      id: num(n.id),
      date: str(n.date),
      from: authorId === 0 ? null : { id: authorId, name: users.get(authorId) ?? `сотрудник ${authorId}` },
      title: str(n.notify_title),
      text: truncate(bbToText(str(n.text), users, ctx.tz), MAX_TEXT_CHARS).text,
      module: str(n.notify_module),
      read: n.notify_read === 'Y' || n.notify_read === true,
    };
  });
  const last = items[items.length - 1];
  const next = items.length >= limit && last ? encodeCursor({ id: num(last.id), t: num(last.notify_type) === 1 ? 1 : 3 }) : null;
  const notes = data.length === 0 ? ['Уведомлений нет.'] : next ? ['Есть более ранние уведомления: --before <next>.'] : [];
  return envelope(data, next, notes);
}
