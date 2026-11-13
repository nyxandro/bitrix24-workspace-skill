import { describe, expect, it } from 'vitest';
import { calendarEvent, calendarEvents, calendarUpcoming } from './calendar.js';
import { fakeContext } from './testkit.js';

type M = Record<string, unknown>;
const ev = (id: string, from: string, extra: M = {}) => ({
  ID: id,
  NAME: `Встреча ${id}`,
  DATE_FROM: from,
  DATE_TO: from.replace('10:00', '11:00'),
  TZ_FROM: 'Europe/Moscow',
  TZ_TO: 'Europe/Moscow',
  DT_SKIP_TIME: 'N',
  LOCATION: 'Переговорная',
  IS_MEETING: true,
  MEETING_STATUS: 'Y',
  ATTENDEE_LIST: [{ id: 5, status: 'Y' }, { id: 6, status: 'Q' }],
  RRULE: '',
  DESCRIPTION: '[B]Повестка[/B]',
  ...extra,
});
const users = () => ({ json: { result: [{ ID: '5', NAME: 'Иван', LAST_NAME: 'Петров' }, { ID: '6', NAME: 'Анна', LAST_NAME: 'Сидорова' }] } });

describe('calendar', () => {
  it('upcoming — свой календарь через calendar.event.get, по времени начала, с участниками', async () => {
    const { ctx, calls } = fakeContext({
      'calendar.event.get': () => ({ json: { result: [ev('2', '21.11.2026 10:00:00'), ev('1', '20.11.2026 10:00:00')] } }),
      'user.get': users,
    });
    const out = await calendarUpcoming(ctx, { days: '7' }, new Date('2026-11-19T12:00:00Z'));
    expect(calls[0]?.body).toEqual({ type: 'user', ownerId: 1, from: '2026-11-19', to: '2026-11-26' });
    const data = out.data as M[];
    expect(data.map((e) => e.id)).toEqual([1, 2]);
    expect(data[0]).toMatchObject({
      title: 'Встреча 1',
      start: '2026-11-20T10:00:00+03:00',
      end: '2026-11-20T11:00:00+03:00',
      allDay: false,
      location: 'Переговорная',
      recurring: false,
      attendees: [{ id: 5, name: 'Иван Петров', response: 'принял' }, { id: 6, name: 'Анна Сидорова', response: 'не ответил' }],
    });
    expect(data[0]).not.toHaveProperty('description');
  });

  it('events — обязательны --from и --to; --owner company', async () => {
    const { ctx, calls } = fakeContext({ 'calendar.event.get': () => ({ json: { result: [] } }), 'user.get': users });
    await expect(calendarEvents(ctx, { from: '2026-11-01' })).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
    await calendarEvents(ctx, { from: '2026-11-01', to: '2026-11-30', owner: 'company' });
    expect(calls[0]?.body).toEqual({ type: 'company_calendar', ownerId: 0, from: '2026-11-01', to: '2026-11-30' });
    await expect(calendarEvents(ctx, { from: '2026-11-01', to: '2026-11-30', owner: 'boss' })).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
  });

  it('повторяющееся событие — запись на каждую дату', async () => {
    const { ctx } = fakeContext({
      'calendar.event.get': () => ({ json: { result: [ev('7', '20.11.2026 10:00:00', { RRULE: 'FREQ=WEEKLY' }), ev('7', '27.11.2026 10:00:00', { RRULE: 'FREQ=WEEKLY' })] } }),
      'user.get': users,
    });
    const data = (await calendarEvents(ctx, { from: '2026-11-19', to: '2026-11-30' })).data as M[];
    expect(data.map((e) => e.start)).toEqual(['2026-11-20T10:00:00+03:00', '2026-11-27T10:00:00+03:00']);
    expect(data.every((e) => e.recurring === true)).toBe(true);
  });

  it('имена участников подтягиваются порциями по 50', async () => {
    const many = Array.from({ length: 51 }, (_, i) => ({ id: i + 1, status: 'Y' }));
    const { ctx, calls } = fakeContext({
      'calendar.event.get': () => ({ json: { result: [ev('1', '20.11.2026 10:00:00', { ATTENDEE_LIST: many })] } }),
      'user.get': (b) => ({ json: { result: ((b.filter as M).ID as number[]).map((id) => ({ ID: String(id), NAME: `Имя${id}`, LAST_NAME: '' })) } }),
    });
    const data = (await calendarEvents(ctx, { from: '2026-11-19', to: '2026-11-30' })).data as M[];
    expect(calls.filter((c) => c.method === 'user.get').map((c) => ((c.body.filter as M).ID as number[]).length)).toEqual([50, 1]);
    expect((data[0]?.attendees as M[]).every((a) => !String(a.name).startsWith('сотрудник'))).toBe(true);
  });

  it('event — с описанием', async () => {
    const { ctx } = fakeContext({ 'calendar.event.getbyid': () => ({ json: { result: ev('1', '20.11.2026 10:00:00') } }), 'user.get': users });
    expect(((await calendarEvent(ctx, '1', {})).data as M).description).toBe('Повестка');
  });
});
