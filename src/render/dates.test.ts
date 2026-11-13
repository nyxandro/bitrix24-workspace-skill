import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calendarDate, formatInZone, localDateKey, parseInputDate } from './dates.js';

describe('formatInZone', () => {
  it('Москва', () => {
    expect(formatInZone(Date.UTC(2024, 11, 11, 14, 59, 0), 'Europe/Moscow')).toBe('2024-12-11T17:59:00+03:00');
  });
  it('UTC', () => {
    expect(formatInZone(Date.UTC(2026, 0, 1, 0, 0, 0), 'UTC')).toBe('2026-01-01T00:00:00+00:00');
  });
});

describe('calendarDate: время из DATE_* и TZ_*, а не из *_TS_UTC', () => {
  it('американская запись с am/pm', () => {
    expect(calendarDate({ DATE_FROM: '12/11/2024 05:59:00 pm', DATE_FROM_TS_UTC: '999', TZ_FROM: 'Europe/Moscow' }, 'FROM')).toBe(
      '2024-12-11T17:59:00+03:00',
    );
    expect(calendarDate({ DATE_FROM: '11/20/2026 12:30:00 am', TZ_FROM: 'Europe/Moscow' }, 'FROM')).toBe('2026-11-20T00:30:00+03:00');
    expect(calendarDate({ DATE_FROM: '11/20/2026 12:30:00 pm', TZ_FROM: 'Europe/Moscow' }, 'FROM')).toBe('2026-11-20T12:30:00+03:00');
  });

  it('русская и ISO-запись', () => {
    expect(calendarDate({ DATE_TO: '20.11.2026 10:00:00', TZ_TO: 'Europe/Moscow' }, 'TO')).toBe('2026-11-20T10:00:00+03:00');
    expect(calendarDate({ DATE_TO: '2026-11-20 10:00:00', TZ_TO: 'Europe/Berlin' }, 'TO')).toBe('2026-11-20T10:00:00+01:00');
  });

  it('время события, пропущенное переходом на летнее, — сразу после разрыва', () => {
    expect(calendarDate({ DATE_FROM: '2026-03-29 02:30:00', TZ_FROM: 'Europe/Berlin' }, 'FROM')).toBe('2026-03-29T03:30:00+02:00');
  });

  it('нет зоны, но есть смещение в секундах', () => {
    expect(calendarDate({ DATE_FROM: '20.11.2026 10:00:00', TZ_FROM: '', TZ_OFFSET_FROM: '10800' }, 'FROM')).toBe('2026-11-20T10:00:00+03:00');
  });

  it('нет ни зоны, ни смещения — время без смещения, не выдумываем', () => {
    expect(calendarDate({ DATE_FROM: '20.11.2026 10:00:00' }, 'FROM')).toBe('2026-11-20T10:00:00');
  });

  it('событие на весь день — только дата', () => {
    expect(calendarDate({ DATE_FROM: '11/20/2026', DT_SKIP_TIME: 'Y', TZ_FROM: 'Europe/Moscow' }, 'FROM')).toBe('2026-11-20');
    expect(calendarDate({ DATE_FROM: '20.11.2026 00:00:00', DT_SKIP_TIME: 'Y' }, 'FROM')).toBe('2026-11-20');
  });

  it.each([[null], [''], [' '], [false], [[]], ['13/40/2026 10:00:00 am'], ['вчера']])('DATE_FROM=%j — APP_B24_UNEXPECTED_RESPONSE', (value) => {
    expect(() => calendarDate({ DATE_FROM: value, TZ_FROM: 'Europe/Moscow' }, 'FROM')).toThrowError(
      expect.objectContaining({ code: 'APP_B24_UNEXPECTED_RESPONSE' }),
    );
  });
});

describe('parseInputDate', () => {
  it('дата без времени → начало и конец дня в зоне машины', () => {
    expect(parseInputDate('2026-11-01', 'start', '--since', 'Europe/Moscow')).toBe('2026-11-01T00:00:00+03:00');
    expect(parseInputDate('2026-11-01', 'end', '--until', 'Europe/Moscow')).toBe('2026-11-01T23:59:59+03:00');
  });

  it('полночь, которой нет (переход на летнее время в полночь) — первое существующее мгновение дня', () => {
    expect(parseInputDate('2026-09-06', 'start', '--since', 'America/Santiago')).toBe('2026-09-06T01:00:00-03:00');
  });

  it('конец дня с повторившимся часом захватывает второй повтор', () => {
    const end = parseInputDate('2026-04-04', 'end', '--until', 'America/Santiago');
    expect(end).toBe('2026-04-04T23:59:59-04:00');
  });

  it('полная дата со смещением сохраняет мгновение', () => {
    expect(parseInputDate('2026-11-01T10:00:00Z', 'start', '--since', 'Europe/Moscow')).toBe('2026-11-01T13:00:00+03:00');
  });

  it('дата и время без смещения — в зоне машины', () => {
    expect(parseInputDate('2026-11-01T10:30', 'start', '--since', 'Europe/Moscow')).toBe('2026-11-01T10:30:00+03:00');
  });

  it.each(['2026-13-01', '01.11.2026', 'вчера', '2026-02-30'])('«%s» — APP_CLI_INVALID_ARGUMENT', (raw) => {
    expect(() => parseInputDate(raw, 'start', '--since', 'Europe/Moscow')).toThrowError(
      expect.objectContaining({ code: 'APP_CLI_INVALID_ARGUMENT' }),
    );
  });

  it('property: начало — первое мгновение дня, конец — последнее, в любой зоне', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1990-01-01T00:00:00Z'), max: new Date('2090-12-31T00:00:00Z'), noInvalidDate: true }),
        fc.constantFrom(
          'Europe/Moscow',
          'Europe/Berlin',
          'America/New_York',
          'Asia/Kolkata',
          'UTC',
          'Australia/Lord_Howe',
          'America/Santiago',
          'America/Havana',
          'Asia/Beirut',
        ),
        (date, tz) => {
          const day = date.toISOString().slice(0, 10);
          const start = Date.parse(parseInputDate(day, 'start', '--since', tz));
          const end = Date.parse(parseInputDate(day, 'end', '--until', tz));
          expect(localDateKey(start, tz)).toBe(day);
          expect(localDateKey(start - 1000, tz) < day).toBe(true);
          expect(localDateKey(end, tz)).toBe(day);
          expect(localDateKey(end + 1000, tz) > day).toBe(true);
          expect(start).toBeLessThan(end);
        },
      ),
    );
  });
});
