/**
 * projects list|get — группы, проекты, скрамы и коллабы.
 */
import { AppError } from '../api/errors.js';
import { MAX_MEMBERS, MAX_TEXT_CHARS } from '../config/config.js';
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
  parseId,
  parseLimit,
  personName,
  str,
} from './common.js';

const GROUP_TYPES = ['group', 'project', 'scrum', 'collab'];
const PAGE = 50;
const MAX_PAGES = 10; // тип Битрикс не фильтрует — листаем, но не бесконечно
const ROLE_NAMES: Readonly<Record<string, string>> = { A: 'владелец', E: 'модератор', K: 'участник', Z: 'запрос на вступление' };

// start у списка групп — только кратный 50 (номер страницы); курсор помнит начало
// страницы и сколько записей с неё уже просмотрено.
const isPageCursor = (v: unknown): v is { s: number; k: number } =>
  isObject(v) && Number.isSafeInteger(v.s) && Number.isSafeInteger(v.k) && (v.s as number) >= 0 && (v.k as number) >= 0;

// Поле из ответа: разные методы раздела отдают то camelCase, то ВЕРХНИЙ_РЕГИСТР.
function pick(obj: Json, camel: string, upper: string): unknown {
  return obj[camel] !== undefined ? obj[camel] : obj[upper];
}

async function myGroupIds(ctx: CommandContext): Promise<Set<number>> {
  const resp = await ctx.client.call<unknown>('sonet_group.user.groups');
  return new Set(asArray(resp.result).filter(isObject).map((g) => num(g.GROUP_ID)).filter((id): id is number => id !== null));
}

export async function projectsList(
  ctx: CommandContext,
  opts: { search?: string; type?: string; mine?: boolean; limit?: string; page?: string },
): Promise<Envelope> {
  const limit = parseLimit(opts.limit, 20, 50);
  if (opts.type && !GROUP_TYPES.includes(opts.type)) {
    throw new AppError({ code: 'APP_CLI_INVALID_ARGUMENT', userMessage: `Параметр --type: ожидается ${GROUP_TYPES.join(' | ')}, получено «${opts.type}».` });
  }
  const mine = await myGroupIds(ctx);
  const filter: Json = {};
  if (opts.search?.trim()) filter['%NAME'] = opts.search.trim();
  if (opts.mine) {
    if (mine.size === 0) return envelope([], null, ['Вы не состоите ни в одной группе.']);
    filter.ID = [...mine];
  }
  const cursor = opts.page ? decodeCursor(opts.page, '--page', isPageCursor) : { s: 0, k: 0 };
  let start = cursor.s;
  let skip = cursor.k;
  const collected: Json[] = [];
  let next: { s: number; k: number } | null = null;
  let stoppedByPages = false;
  for (let pages = 0; ; pages++) {
    if (pages >= MAX_PAGES) {
      stoppedByPages = true;
      next = { s: start, k: 0 };
      break;
    }
    const resp = await ctx.client.call<Json>('socialnetwork.api.workgroup.list', {
      filter,
      select: ['ID', 'NAME', 'TYPE', 'NUMBER_OF_MEMBERS', 'CLOSED'],
      params: { shouldSelectDialogId: 'Y' },
      start,
    });
    const groups = isObject(resp.result) ? asArray(resp.result.workgroups).filter(isObject) : [];
    let i = skip;
    for (; i < groups.length && collected.length < limit; i++) {
      const g = groups[i]!;
      if (!opts.type || str(pick(g, 'type', 'TYPE')) === opts.type) collected.push(g);
    }
    const morePages = typeof resp.next === 'number' && groups.length > 0;
    if (collected.length >= limit) {
      if (i < groups.length) next = { s: start, k: i };
      else if (morePages) next = { s: resp.next as number, k: 0 };
      break;
    }
    if (!morePages) break;
    start = resp.next as number;
    skip = 0;
  }
  const data = collected.map((g) => {
    const id = num(pick(g, 'id', 'ID')) ?? 0;
    return {
      id,
      name: str(pick(g, 'name', 'NAME')),
      type: str(pick(g, 'type', 'TYPE')),
      isMember: mine.has(id),
      members: num(pick(g, 'numberOfMembers', 'NUMBER_OF_MEMBERS')),
      dialogId: str(g.dialogId) || `sg${id}`,
    };
  });
  const notes: string[] = [];
  if (data.length === 0) notes.push('Ничего не найдено.');
  if (stoppedByPages) notes.push(`Просмотрено ${MAX_PAGES * PAGE} групп; продолжить поиск — --page <next>.`);
  else if (next !== null) notes.push('Есть ещё: --page <next>.');
  return envelope(data, next !== null ? encodeCursor(next) : null, notes);
}

export async function projectsGet(ctx: CommandContext, idRaw: string): Promise<Envelope> {
  const id = parseId(idRaw, 'id');
  const resp = await ctx.client.call<Json>('socialnetwork.api.workgroup.get', { params: { groupId: id } });
  const g = isObject(resp.result) ? resp.result : {};
  const memberRows = await ctx.client.call<unknown>('sonet_group.user.get', { ID: id });
  const rows = asArray(memberRows.result).filter(isObject);
  const shown = rows.slice(0, MAX_MEMBERS);
  const ids = shown.map((r) => num(r.USER_ID)).filter((u): u is number => u !== null);
  const names = new Map<number, string>();
  if (ids.length > 0) {
    const users = await ctx.client.call<unknown>('user.get', { filter: { ID: ids } });
    for (const u of asArray(users.result).filter(isObject)) {
      const uid = num(u.ID);
      if (uid !== null) names.set(uid, personName(u));
    }
  }
  const description = truncate(bbToText(str(pick(g, 'description', 'DESCRIPTION')), new Map(), ctx.tz), MAX_TEXT_CHARS);
  const total = Math.max(num(pick(g, 'numberOfMembers', 'NUMBER_OF_MEMBERS')) ?? 0, rows.length);
  return envelope(
    {
      id,
      name: str(pick(g, 'name', 'NAME')),
      description: description.text,
      ...(description.truncated ? { descriptionTruncated: true } : {}),
      type: str(pick(g, 'type', 'TYPE')),
      ownerId: num(pick(g, 'ownerId', 'OWNER_ID')),
      dialogId: `sg${id}`,
      members: shown.map((r) => {
        const uid = num(r.USER_ID) ?? 0;
        return { id: uid, name: names.get(uid) ?? `сотрудник ${uid}`, role: ROLE_NAMES[str(r.ROLE)] ?? str(r.ROLE) };
      }),
      membersTotal: total,
    },
    null,
    total > shown.length ? [`Показаны первые ${shown.length} участников из ${total}.`] : [],
  );
}
