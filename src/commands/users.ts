/**
 * users find|get — найти сотрудника по имени или назвать людей по номерам.
 */
import { AppError } from '../api/errors.js';
import { asArray, type CommandContext, envelope, isObject, type Json, num, parseLimit, personName, str } from './common.js';
import type { Envelope } from '../render/output.js';

const MAX_IDS = 50;

export function toUser(raw: Json) {
  return {
    id: num(raw.ID) ?? 0,
    name: personName(raw),
    position: str(raw.WORK_POSITION),
    departmentIds: asArray(raw.UF_DEPARTMENT).map((d) => num(d)).filter((d): d is number => d !== null),
    active: raw.ACTIVE === true || raw.ACTIVE === 'Y',
  };
}

export async function usersFind(ctx: CommandContext, text: string, limitRaw?: string): Promise<Envelope> {
  const limit = parseLimit(limitRaw, 10, 50);
  const query = text.trim();
  if (query.length < 2) {
    throw new AppError({ code: 'APP_CLI_INVALID_ARGUMENT', userMessage: 'Параметр текст: нужно не меньше 2 символов.' });
  }
  const resp = await ctx.client.call<unknown>('user.search', { FILTER: { FIND: query } });
  const all = asArray(resp.result).filter(isObject).map(toUser);
  const notes = all.length > limit ? [`Показаны первые ${limit} из ${resp.total ?? all.length}. Уточните запрос.`] : [];
  return envelope(all.slice(0, limit), null, notes);
}

export async function usersGet(ctx: CommandContext, idsRaw: string): Promise<Envelope> {
  const parts = idsRaw.split(',').map((p) => p.trim()).filter((p) => p !== '');
  const ids = parts.map((p) => num(p));
  if (parts.length === 0 || parts.length > MAX_IDS || ids.some((id) => id === null || !Number.isSafeInteger(id) || id <= 0)) {
    throw new AppError({
      code: 'APP_CLI_INVALID_ARGUMENT',
      userMessage: `Параметр id: ожидается от 1 до ${MAX_IDS} номеров сотрудников через запятую, получено «${idsRaw}».`,
    });
  }
  const resp = await ctx.client.call<unknown>('user.get', { filter: { ID: ids } });
  const found = asArray(resp.result).filter(isObject).map(toUser);
  const missing = ids.filter((id) => !found.some((user) => user.id === id));
  return envelope(found, null, missing.length > 0 ? [`Битрикс24 не отдал сотрудников с номерами: ${missing.join(', ')} — таких нет, либо это внешние участники.`] : []);
}
