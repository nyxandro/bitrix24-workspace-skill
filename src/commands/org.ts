/**
 * org me|find|department — оргструктура: отделы, руководители, коллеги.
 */
import { AppError } from '../api/errors.js';
import { MAX_MEMBERS } from '../config/config.js';
import type { Envelope } from '../render/output.js';
import { asArray, type CommandContext, envelope, isObject, type Json, num, parseId, parseLimit, personName, str } from './common.js';

function people(raw: unknown) {
  return asArray(raw)
    .filter(isObject)
    .map((u) => ({ id: num(u.id ?? u.ID), name: personName(u), position: str(u.work_position ?? u.WORK_POSITION) }));
}

// managers.get / employees.get отдают объект «номер отдела → список людей».
function byDepartment(result: unknown, id: number) {
  return isObject(result) ? people(result[String(id)]) : [];
}

function department(d: Json) {
  return { id: num(d.id), name: str(d.name), path: str(d.full_name) };
}

export async function orgMe(ctx: CommandContext, opts: { limit?: string }): Promise<Envelope> {
  const limit = parseLimit(opts.limit, MAX_MEMBERS, MAX_MEMBERS);
  const me = await ctx.client.call<Json>('user.current');
  const ids = asArray(isObject(me.result) ? me.result.UF_DEPARTMENT : []).map((d) => num(d)).filter((d): d is number => d !== null);
  let departments: unknown[] = [];
  if (ids.length > 0) {
    const deps = await ctx.client.call<unknown>('im.department.get', { ID: ids, USER_DATA: 'N' });
    const managers = await ctx.client.call<unknown>('im.department.managers.get', { ID: ids, USER_DATA: 'Y' });
    departments = asArray(deps.result)
      .filter(isObject)
      .map((d) => ({ ...department(d), managers: byDepartment(managers.result, num(d.id) ?? 0) }));
  }
  const colleagues = await ctx.client.call<unknown>('im.department.colleagues.list', { LIMIT: limit, USER_DATA: 'Y' });
  const list = people(colleagues.result).slice(0, limit);
  const total = colleagues.total ?? list.length;
  return envelope({ departments, colleagues: list, colleaguesTotal: total }, null, total > list.length ? [`Показаны ${list.length} коллег из ${total}.`] : []);
}

export async function orgFind(ctx: CommandContext, text: string, opts: { limit?: string }): Promise<Envelope> {
  if (text.trim().length < 3) {
    throw new AppError({ code: 'APP_CLI_INVALID_ARGUMENT', userMessage: 'Параметр текст: нужно не меньше 3 символов.' });
  }
  const resp = await ctx.client.call<unknown>('im.search.department.list', { FIND: text.trim(), LIMIT: parseLimit(opts.limit, 10, 50), USER_DATA: 'N' });
  const data = asArray(resp.result)
    .filter(isObject)
    .map((d) => ({ ...department(d), managerId: num(d.manager_user_id) }));
  return envelope(data, null, data.length === 0 ? ['Отделы не найдены.'] : []);
}

export async function orgDepartment(ctx: CommandContext, idRaw: string, opts: { limit?: string }): Promise<Envelope> {
  const id = parseId(idRaw, 'id');
  const limit = parseLimit(opts.limit, MAX_MEMBERS, MAX_MEMBERS);
  const deps = await ctx.client.call<unknown>('im.department.get', { ID: [id], USER_DATA: 'N' });
  const d = asArray(deps.result).filter(isObject)[0];
  if (!d) {
    throw new AppError({ code: 'APP_B24_NOT_FOUND', userMessage: 'Не найдено: такого отдела нет или он удалён. Проверьте номер.' });
  }
  const managers = await ctx.client.call<unknown>('im.department.managers.get', { ID: [id], USER_DATA: 'Y' });
  const employees = await ctx.client.call<unknown>('im.department.employees.get', { ID: [id], USER_DATA: 'Y' });
  const staff = byDepartment(employees.result, id);
  return envelope(
    { ...department(d), managers: byDepartment(managers.result, id), employees: staff.slice(0, limit), employeesTotal: staff.length },
    null,
    staff.length > limit ? [`Показаны ${limit} сотрудников из ${staff.length}.`] : [],
  );
}
