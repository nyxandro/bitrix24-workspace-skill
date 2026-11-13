/**
 * Общее для команд: контекст вызова, конверт ответа, курсоры, лимиты, люди.
 */
import type { B24Client } from '../api/client.js';
import { AppError } from '../api/errors.js';
import type { Webhook } from '../config/webhook.js';
import type { Envelope } from '../render/output.js';
import { parsePositiveInt } from '../cli/runtime.js';

export interface CommandContext {
  client: B24Client;
  webhook: Webhook;
  tz: string;
}

export type Json = Record<string, unknown>;

export function envelope(data: unknown, next: string | null = null, notes: string[] = []): Envelope {
  return { data, next, notes };
}

export function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return isObject(value) ? Object.values(value) : [];
}

export function str(value: unknown): string {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

export function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function parseLimit(raw: string | undefined, def: number, max: number, option = '--limit'): number {
  return raw === undefined ? def : parsePositiveInt(raw, option, max);
}

export function parseId(raw: string, option: string): number {
  return parsePositiveInt(raw, option);
}

// Курсор — непрозрачная для агента строка: base64url от JSON.
export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCursor<T>(raw: string, option: string, check: (v: unknown) => v is T): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw.trim(), 'base64url').toString('utf8'));
  } catch {
    parsed = undefined;
  }
  if (!check(parsed)) {
    throw new AppError({
      code: 'APP_CLI_INVALID_ARGUMENT',
      userMessage: `Параметр ${option}: курсор не распознан. Передайте значение поля next из предыдущего ответа как есть.`,
    });
  }
  return parsed;
}

export interface Person {
  id: number;
  name: string;
}

// Имя человека из ответов разных разделов Битрикса: NAME/LAST_NAME, name,
// first_name/last_name, firstName/lastName.
export function personName(raw: Json): string {
  const full = str(raw.name ?? raw.NAME_FORMATTED ?? raw.FULL_NAME).trim();
  if (full !== '' && raw.NAME === undefined) {
    return full;
  }
  const first = str(raw.NAME ?? raw.first_name ?? raw.firstName).trim();
  const last = str(raw.LAST_NAME ?? raw.last_name ?? raw.lastName).trim();
  const joined = `${first} ${last}`.trim();
  return joined !== '' ? joined : full;
}

// Список пользователей из ответа чата: приходит то массивом, то объектом по id.
export function peopleMap(users: unknown): Map<number, string> {
  const map = new Map<number, string>();
  for (const item of asArray(users)) {
    if (isObject(item)) {
      const id = num(item.id ?? item.ID);
      if (id !== null) {
        map.set(id, personName(item));
      }
    }
  }
  return map;
}

export function unexpected(field: string): AppError {
  return new AppError({
    code: 'APP_B24_UNEXPECTED_RESPONSE',
    userMessage: 'Битрикс24 вернул данные в неожиданном виде — команда не может их разобрать.',
    details: { field },
  });
}

const USER_GET_PAGE = 50; // user.get отдаёт не больше 50 человек за раз
const MAX_NAME_LOOKUP = 200;

// Имена сотрудников по номерам: порциями по 50, не больше 200 за команду.
// Кого Битрикс не отдал (уволен, внешний), остаются без имени.
export async function lookupNames(ctx: CommandContext, ids: Iterable<number>): Promise<Map<number, string>> {
  const wanted = [...new Set(ids)].filter((id) => id > 0).slice(0, MAX_NAME_LOOKUP);
  const names = new Map<number, string>();
  for (let i = 0; i < wanted.length; i += USER_GET_PAGE) {
    const resp = await ctx.client.call<unknown>('user.get', { filter: { ID: wanted.slice(i, i + USER_GET_PAGE) } });
    for (const u of asArray(resp.result).filter(isObject)) {
      const id = num(u.ID);
      if (id !== null) names.set(id, personName(u));
    }
  }
  return names;
}

export function nameOf(names: Map<number, string>, id: number): string {
  return names.get(id) ?? `сотрудник ${id}`;
}

export function notFound(): AppError {
  return new AppError({ code: 'APP_B24_NOT_FOUND', userMessage: 'Не найдено: такого объекта нет или он удалён. Проверьте номер.' });
}
