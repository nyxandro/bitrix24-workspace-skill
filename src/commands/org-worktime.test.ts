import { describe, expect, it } from 'vitest';
import { orgDepartment, orgFind, orgMe } from './org.js';
import { worktimeRecords, worktimeStatus } from './worktime.js';
import { fakeContext } from './testkit.js';

type M = Record<string, unknown>;
const person = (id: number) => ({ id, name: `Сотрудник ${id}`, work_position: 'Инженер' });

describe('org', () => {
  it('me — мои отделы с руководителями и коллеги', async () => {
    const { ctx, calls } = fakeContext({
      'user.current': () => ({ json: { result: { ID: '1', UF_DEPARTMENT: [3, 4] } } }),
      'im.department.get': () => ({ json: { result: [{ id: 3, name: 'Разработка', full_name: 'Компания / Разработка', manager_user_id: 9 }, { id: 4, name: 'Продажи', full_name: 'Компания / Продажи', manager_user_id: 8 }] } }),
      'im.department.managers.get': () => ({ json: { result: { 3: [person(9)], 4: [person(8)] } } }),
      'im.department.colleagues.list': () => ({ json: { result: [person(2), person(5)], total: 60 } }),
    });
    const data = (await orgMe(ctx, {})).data as M;
    expect(calls.find((c) => c.method === 'im.department.get')?.body).toEqual({ ID: [3, 4], USER_DATA: 'N' });
    expect(data.departments).toEqual([
      { id: 3, name: 'Разработка', path: 'Компания / Разработка', managers: [{ id: 9, name: 'Сотрудник 9', position: 'Инженер' }] },
      { id: 4, name: 'Продажи', path: 'Компания / Продажи', managers: [{ id: 8, name: 'Сотрудник 8', position: 'Инженер' }] },
    ]);
    expect(data).toMatchObject({ colleagues: [{ id: 2, name: 'Сотрудник 2', position: 'Инженер' }, { id: 5, name: 'Сотрудник 5', position: 'Инженер' }], colleaguesTotal: 60 });
  });

  it('find — от 3 символов', async () => {
    const { ctx } = fakeContext({ 'im.search.department.list': () => ({ json: { result: [{ id: 3, name: 'Разработка', full_name: 'Компания / Разработка', manager_user_id: 9 }] } }) });
    await expect(orgFind(ctx, 'от', {})).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
    expect((await orgFind(ctx, 'разраб', {})).data).toEqual([{ id: 3, name: 'Разработка', path: 'Компания / Разработка', managerId: 9 }]);
  });

  it('department — руководители и сотрудники до 50 с общим числом', async () => {
    const staff = Array.from({ length: 70 }, (_, i) => person(i + 10));
    const { ctx } = fakeContext({
      'im.department.get': () => ({ json: { result: [{ id: 3, name: 'Разработка', full_name: 'Компания / Разработка', manager_user_id: 9 }] } }),
      'im.department.managers.get': () => ({ json: { result: { 3: [person(9)] } } }),
      'im.department.employees.get': () => ({ json: { result: { 3: staff } } }),
    });
    const data = (await orgDepartment(ctx, '3', {})).data as M;
    expect((data.employees as M[]).length).toBe(50);
    expect(data).toMatchObject({ id: 3, employeesTotal: 70, managers: [{ id: 9 }] });
  });
});

describe('worktime', () => {
  it('status — Битрикс вернул не объект: APP_B24_UNEXPECTED_RESPONSE, а не пустой статус', async () => {
    const { ctx } = fakeContext({ 'timeman.status': () => ({ json: { result: null } }) });
    await expect(worktimeStatus(ctx)).rejects.toMatchObject({ code: 'APP_B24_UNEXPECTED_RESPONSE' });
  });

  it('records — состояние записи приходит объектом: показываем его статус, а не [object Object]', async () => {
    const { ctx } = fakeContext({
      'timeman.record.list': () => ({ json: { result: { items: [{ id: 1, startTime: '2026-03-17T13:31:14+03:00', endTime: '2026-03-17T13:45:25+03:00', duration: 851, breakLength: 0, state: { status: 'closed', recommendedCloseTime: null }, isApproved: true }] } } }),
    });
    const data = (await worktimeRecords(ctx, { from: '2026-03-01', to: '2026-03-31' })).data as M;
    expect((data.records as M[])[0]).toMatchObject({ state: 'закрыт', approved: true });
    expect(JSON.stringify(data)).not.toContain('[object');
  });

  it('status — по-русски', async () => {
    const { ctx } = fakeContext({ 'timeman.status': () => ({ json: { result: { STATUS: 'CLOSED', TIME_START: '2026-11-13T09:00:00+03:00', TIME_FINISH: '2026-11-13T18:00:00+03:00', DURATION: '08:00:00', TIME_LEAKS: '01:00:00' } } }) });
    expect((await worktimeStatus(ctx)).data).toEqual({ status: 'закрыт', start: '2026-11-13T09:00:00+03:00', finish: '2026-11-13T18:00:00+03:00', duration: '08:00:00', breaks: '01:00:00' });
  });

  it('records — обязательный период, фильтр по владельцу вебхука, сумма', async () => {
    const { ctx, calls } = fakeContext({
      'timeman.record.list': () => ({ json: { result: { items: [{ id: 1, startTime: '2026-11-10T09:00:00+03:00', endTime: '2026-11-10T18:00:00+03:00', duration: 28800, breakLength: 3600, state: 'CLOSED' }, { id: 2, startTime: '2026-11-11T09:00:00+03:00', endTime: '2026-11-11T17:00:00+03:00', duration: 25200, breakLength: 3600, state: 'CLOSED' }] } } }),
    });
    await expect(worktimeRecords(ctx, { from: '2026-11-01' })).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
    const data = (await worktimeRecords(ctx, { from: '2026-11-01', to: '2026-11-30' })).data as M;
    expect(calls[0]?.body).toMatchObject({ filter: [['userId', 1], ['startTime', 'between', ['2026-11-01T00:00:00+03:00', '2026-11-30T23:59:59+03:00']]] });
    expect(data.totalSeconds).toBe(54000);
    expect((data.records as M[])[0]).toEqual({ id: 1, start: '2026-11-10T09:00:00+03:00', end: '2026-11-10T18:00:00+03:00', durationSeconds: 28800, breakSeconds: 3600, state: 'закрыт', approved: null });
  });
});
