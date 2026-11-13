import { describe, expect, it } from 'vitest';
import { usersFind, usersGet } from './users.js';
import { fakeContext } from './testkit.js';

const IVAN = { ID: '5', NAME: 'Иван', LAST_NAME: 'Петров', WORK_POSITION: 'Инженер', UF_DEPARTMENT: [3], ACTIVE: true, EMAIL: 'x@y.ru' };

describe('users', () => {
  it('find ищет по FIND и отдаёт только нужные поля', async () => {
    const { ctx, calls } = fakeContext({ 'user.search': () => ({ json: { result: [IVAN], total: 1 } }) });
    const out = await usersFind(ctx, 'Петров', '10');
    expect(calls[0]?.body).toEqual({ FILTER: { FIND: 'Петров' } });
    expect(out.data).toEqual([{ id: 5, name: 'Иван Петров', position: 'Инженер', departmentIds: [3], active: true }]);
  });

  it('get — номера, которых Битрикс не отдал, названы в пометке', async () => {
    const { ctx } = fakeContext({ 'user.get': () => ({ json: { result: [IVAN] } }) });
    const out = await usersGet(ctx, '5,402,999');
    expect((out.data as unknown[]).length).toBe(1);
    expect(out.notes.join(' ')).toContain('402, 999');
    const all = fakeContext({ 'user.get': () => ({ json: { result: [IVAN] } }) });
    expect((await usersGet(all.ctx, '5')).notes).toEqual([]);
  });

  it('get принимает список id через запятую и не больше 50', async () => {
    const { ctx, calls } = fakeContext({ 'user.get': () => ({ json: { result: [IVAN] } }) });
    await usersGet(ctx, '5, 6');
    expect(calls[0]?.body).toEqual({ filter: { ID: [5, 6] } });
    await expect(usersGet(ctx, Array.from({ length: 51 }, (_, i) => i + 1).join(','))).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
    await expect(usersGet(ctx, '5,abc')).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
  });
});
