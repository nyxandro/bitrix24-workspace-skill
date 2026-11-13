/**
 * chats recent|counters|find|info|messages|search — переписка сотрудника.
 */
import { AppError } from '../api/errors.js';
import { MAX_MEMBERS } from '../config/config.js';
import { parsePositiveInt } from '../cli/runtime.js';
import { parseInputDate } from '../render/dates.js';
import { normalizeDialogId, parseDialogIdArg } from '../render/dialog-id.js';
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
  num,
  parseLimit,
  personName,
  str,
  unexpected,
} from './common.js';
import { type ChatMessage, toMessages } from './messages.js';

const PAGE = 50; // im.dialog.messages.get отдаёт не больше 50 за раз
const SINCE_CAP = 500; // --since: предел, чтобы не вычерпать огромный чат
const LAST_MESSAGE_PREVIEW = 300;

function invalid(message: string): AppError {
  return new AppError({ code: 'APP_CLI_INVALID_ARGUMENT', userMessage: message });
}

function entityOf(chat: unknown): { type: string; id: string } | null {
  if (!isObject(chat) || str(chat.entity_type) === '') {
    return null;
  }
  return { type: str(chat.entity_type), id: str(chat.entity_id) };
}

const isOffsetCursor = (v: unknown): v is { o: number } => isObject(v) && typeof v.o === 'number' && Number.isSafeInteger(v.o) && v.o >= 0;

export async function chatsRecent(
  ctx: CommandContext,
  opts: { unread?: boolean; type?: string; limit?: string; page?: string },
): Promise<Envelope> {
  const limit = parseLimit(opts.limit, 20, 50);
  const offset = opts.page ? decodeCursor(opts.page, '--page', isOffsetCursor).o : 0;
  const type = opts.type ?? 'all';
  if (!['all', 'private', 'chat'].includes(type)) {
    throw invalid(`Параметр --type: ожидается private, chat или all, получено «${type}».`);
  }
  const params: Json = { SKIP_OPENLINES: 'Y', LIMIT: limit, OFFSET: offset };
  if (type === 'private') params.SKIP_CHAT = 'Y';
  if (type === 'chat') params.SKIP_DIALOG = 'Y';
  if (opts.unread) params.UNREAD_ONLY = 'Y';
  const resp = await ctx.client.call<Json>('im.recent.list', params);
  if (!isObject(resp.result)) {
    throw unexpected('im.recent.list.result');
  }
  const seen = new Set<string>();
  const data = [];
  let skipped = 0;
  for (const it of asArray(resp.result.items).filter(isObject)) {
    let dialogId: string;
    try {
      dialogId = normalizeDialogId(str(it.id), str(it.type) || undefined);
    } catch (err) {
      // Один диалог незнакомого вида не должен прятать весь список — пропускаем и говорим об этом.
      if (err instanceof AppError && err.code === 'APP_B24_UNEXPECTED_RESPONSE') {
        skipped += 1;
        continue;
      }
      throw err;
    }
    const unreadCount = num(it.counter) ?? 0;
    // Страницы пересекаются (im-recent-list.md); непрочитанное — по counter, а unread — ручная пометка.
    if (seen.has(dialogId) || (opts.unread && unreadCount === 0)) {
      continue;
    }
    seen.add(dialogId);
    const message = isObject(it.message) ? it.message : null;
    data.push({
      dialogId,
      title: str(it.title),
      type: isObject(it.chat) && str(it.chat.type) !== '' ? str(it.chat.type) : str(it.type),
      entity: entityOf(it.chat),
      unreadCount,
      markedUnread: it.unread === true,
      lastMessage: message
        ? { text: truncate(bbToText(str(message.text), new Map(), ctx.tz), LAST_MESSAGE_PREVIEW).text, date: str(message.date), authorId: num(message.author_id) }
        : null,
      date: str(it.date_update ?? it.date_last_activity),
    });
  }
  const hasMore = resp.result.hasMore === true || resp.result.hasMorePages === true;
  const notes = data.length === 0 ? ['Ничего не найдено на этой странице.'] : [];
  if (skipped > 0) notes.push(`Пропущено диалогов незнакомого вида: ${skipped}.`);
  if (hasMore) notes.push('Есть ещё диалоги: --page <next>.');
  return envelope(data, hasMore ? encodeCursor({ o: offset + limit }) : null, notes);
}

export async function chatsCounters(ctx: CommandContext): Promise<Envelope> {
  const resp = await ctx.client.call<Json>('im.counters.get');
  const type = isObject(resp.result) && isObject(resp.result.TYPE) ? resp.result.TYPE : null;
  if (!type) {
    throw unexpected('im.counters.get.TYPE');
  }
  const byType = Object.fromEntries(Object.entries(type).filter(([, v]) => typeof v === 'number'));
  return envelope({ total: num(type.ALL), byType });
}

export async function chatsFind(ctx: CommandContext, text: string, limitRaw?: string): Promise<Envelope> {
  const limit = parseLimit(limitRaw, 10, 50);
  if (text.trim().length < 2) {
    throw invalid('Параметр текст: нужно не меньше 2 символов.');
  }
  const resp = await ctx.client.call<unknown>('im.search.chat.list', { FIND: text.trim(), LIMIT: limit });
  const data = asArray(resp.result)
    .filter(isObject)
    .filter((c) => num(c.id) !== null)
    .map((c) => ({ dialogId: `chat${num(c.id)}`, title: str(c.name), type: str(c.type), entity: entityOf(c), messageCount: num(c.message_count) }));
  // Чаты проектов и коллаб этот поиск не находит (проверено на портале) — у них свой путь.
  const notes = data.length === 0 ? ['Чаты не найдены. Чат проекта или коллабы — через projects list --search, чат задачи — через tasks get.'] : [];
  return envelope(data, null, notes);
}

export async function chatsInfo(ctx: CommandContext, dialogArg: string): Promise<Envelope> {
  const dialogId = parseDialogIdArg(dialogArg);
  const d = await ctx.client.call<Json>('im.dialog.get', { DIALOG_ID: dialogId });
  if (!isObject(d.result)) {
    throw unexpected('im.dialog.get.result');
  }
  const users = await ctx.client.call<unknown>('im.dialog.users.list', { DIALOG_ID: dialogId, LIMIT: MAX_MEMBERS });
  const members = asArray(users.result)
    .filter(isObject)
    .slice(0, MAX_MEMBERS)
    .map((u) => ({ id: num(u.id), name: personName(u), position: str(u.work_position) }));
  // user_counter и total списка участников у Битрикса расходятся (бот, внешние) — берём больший.
  const total = Math.max(num(d.result.user_counter) ?? 0, users.total ?? 0, members.length);
  // У лички названия нет — называем её по собеседнику.
  const peer = members.find((member) => member.id !== ctx.webhook.userId);
  const title = str(d.result.name) || (str(d.result.type) === 'private' && peer ? peer.name : '');
  return envelope(
    {
      dialogId,
      title,
      type: str(d.result.type),
      ownerId: num(d.result.owner),
      entity: entityOf(d.result),
      messageCount: num(d.result.message_count),
      lastMessageId: num(d.result.last_message_id),
      members,
      membersTotal: total,
    },
    null,
    total > members.length ? [`Показаны первые ${members.length} участников из ${total}.`] : [],
  );
}

interface MessagesOpts {
  limit?: string;
  before?: string;
  after?: string;
  since?: string;
  full?: boolean;
}

async function readForward(ctx: CommandContext, dialogId: string, after: number, limit: number, full: boolean) {
  const collected: ChatMessage[] = [];
  let cursor = after;
  let hasMore = false;
  while (collected.length < limit) {
    const want = Math.min(PAGE, limit - collected.length);
    const page = await ctx.client.call<Json>('im.dialog.messages.get', { DIALOG_ID: dialogId, FIRST_ID: cursor, LIMIT: want });
    const msgs = toMessages(isObject(page.result) ? page.result : {}, ctx.tz, full).filter((m) => m.id > cursor);
    if (msgs.length === 0) break;
    collected.push(...msgs);
    const maxId = Math.max(...msgs.map((m) => m.id));
    hasMore = msgs.length >= want;
    if (maxId <= cursor) break;
    cursor = maxId;
    if (!hasMore) break;
  }
  const sorted = collected.sort((a, b) => a.id - b.id).slice(0, limit);
  const next = hasMore && sorted.length > 0 ? String(sorted[sorted.length - 1]!.id) : null;
  return envelope(sorted, next, next ? ['Есть более новые сообщения: --after <next>.'] : []);
}

export async function chatsMessages(ctx: CommandContext, dialogArg: string, opts: MessagesOpts): Promise<Envelope> {
  const dialogId = parseDialogIdArg(dialogArg);
  const limit = parseLimit(opts.limit, 30, 200);
  if (opts.before && opts.after) {
    throw invalid('Параметры --before и --after вместе не используются: выберите одно направление.');
  }
  if (opts.after && opts.since) {
    throw invalid('Параметры --after и --since вместе не используются: --since листает назад до даты.');
  }
  const full = opts.full === true;
  if (opts.after) {
    return readForward(ctx, dialogId, parsePositiveInt(opts.after, '--after'), limit, full);
  }
  const since = opts.since ? Date.parse(parseInputDate(opts.since, 'start', '--since', ctx.tz)) : null;
  let cursor: number;
  if (opts.before) {
    cursor = parsePositiveInt(opts.before, '--before');
  } else {
    // Без курсора Битрикс при многих непрочитанных начинает со старого
    // непрочитанного — берём последний id и читаем от него назад.
    const d = await ctx.client.call<Json>('im.dialog.get', { DIALOG_ID: dialogId });
    const last = isObject(d.result) ? num(d.result.last_message_id) : null;
    if (last === null) throw unexpected('im.dialog.get.last_message_id');
    cursor = last + 1;
  }
  const target = since !== null ? SINCE_CAP : limit;
  const collected = new Map<number, ChatMessage>();
  let hasMore = false;
  let reachedSince = false;
  while (collected.size < target) {
    const want = Math.min(PAGE, target - collected.size);
    const page = await ctx.client.call<Json>('im.dialog.messages.get', { DIALOG_ID: dialogId, LAST_ID: cursor, LIMIT: want });
    const msgs = toMessages(isObject(page.result) ? page.result : {}, ctx.tz, full).filter((m) => m.id < cursor);
    if (msgs.length === 0) {
      hasMore = false;
      break;
    }
    for (const m of msgs) {
      if (since !== null && Date.parse(m.date) < since) {
        reachedSince = true;
      } else {
        collected.set(m.id, m);
      }
    }
    hasMore = msgs.length >= want;
    cursor = Math.min(...msgs.map((m) => m.id));
    if (reachedSince || !hasMore) break;
  }
  const kept = [...collected.values()].sort((a, b) => b.id - a.id).slice(0, target);
  const more = !reachedSince && (hasMore || collected.size > kept.length) && kept.length > 0;
  const next = more ? String(kept[kept.length - 1]!.id) : null;
  const notes: string[] = [];
  if (kept.length === 0) notes.push('Сообщений нет за этот период.');
  if (next && since !== null) notes.push(`Показаны последние ${SINCE_CAP} сообщений с указанной даты; более ранние — --before <next>.`);
  else if (next) notes.push('Есть более ранние сообщения: --before <next>.');
  return envelope(kept.reverse(), next, notes);
}

export async function chatsSearch(
  ctx: CommandContext,
  dialogArg: string,
  text: string,
  opts: { since?: string; until?: string; limit?: string; before?: string },
): Promise<Envelope> {
  const dialogId = parseDialogIdArg(dialogArg);
  const limit = parseLimit(opts.limit, 30, 200);
  // Короче 3 символов Битрикс не ищет, а молча отдаёт все сообщения.
  if (text.trim().length <= 2) {
    throw invalid('Параметр текст: нужно больше 2 символов.');
  }
  const d = await ctx.client.call<Json>('im.dialog.get', { DIALOG_ID: dialogId });
  const chatId = isObject(d.result) ? num(d.result.id) : null;
  if (chatId === null) throw unexpected('im.dialog.get.id');
  const params: Json = { CHAT_ID: chatId, SEARCH_MESSAGE: text.trim(), LIMIT: limit, ORDER: { ID: 'DESC' } };
  if (opts.since) params.DATE_FROM = parseInputDate(opts.since, 'start', '--since', ctx.tz);
  if (opts.until) params.DATE_TO = parseInputDate(opts.until, 'end', '--until', ctx.tz);
  if (opts.before) params.LAST_ID = parsePositiveInt(opts.before, '--before');
  const resp = await ctx.client.call<Json>('im.dialog.messages.search', params);
  const msgs = toMessages(isObject(resp.result) ? resp.result : {}, ctx.tz, false).sort((a, b) => a.id - b.id);
  const next = msgs.length >= limit ? String(msgs[0]!.id) : null;
  const notes = msgs.length === 0 ? ['Ничего не найдено.'] : next ? ['Есть ещё совпадения: --before <next>.'] : [];
  return envelope(msgs, next, notes);
}
