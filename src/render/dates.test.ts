import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calendarDate, formatInZone, parseInputDate } from './dates.js';

describe('formatInZone', () => {
  it('Москва', () => {
    expect(formatInZone(Date.UTC(2024, 11, 11, 14, 59, 0), 'Europe/Moscow')).toBe('2024-12-11T17:59:00+03:00');
  });
  it('UTC', () => {
    expect(formatInZone(Date.UTC(2026, 0, 1, 0, 0, 0), 'UTC')).toBe('2026-01-01T00:00:00+00:00');
  });
});

describe('calendarDate', () => {
  it('время события — из DATE_FROM_TS_UTC и TZ_FROM', () => {
    const event = { DATE_FROM: '12/11/2024 05:59:00 pm', DATE_FROM_TS_UTC: '1733929140', TZ_FROM: 'Europe/Moscow', DT_SKIP_TIME: 'N' };
    expect(calendarDate(event, 'FROM')).toBe('2024-12-11T17:59:00+03:00');
  });

  it('событие на весь день — только дата', () => {
    const event = { DATE_TO: '12/11/2024', DATE_TO_TS_UTC: '1733864400', TZ_TO: 'Europe/Moscow', DT_SKIP_TIME: 'Y' };
    expect(calendarDate(event, 'TO')).toBe('2024-12-11');
  });

  it('без зоны — то же мгновение в UTC', () => {
    expect(calendarDate({ DATE_FROM_TS_UTC: '1733929140', TZ_FROM: '' }, 'FROM')).toBe('2024-12-11T14:59:00+00:00');
  });

  it('без метки времени — APP_B24_UNEXPECTED_RESPONSE', () => {
    expect(() => calendarDate({ DATE_FROM: '12/11/2024' }, 'FROM')).toThrowError(
      expect.objectContaining({ code: 'APP_B24_UNEXPECTED_RESPONSE' }),
    );
  });
});

describe('parseInputDate', () => {
  it('дата без времени → начало и конец дня в зоне машины', () => {
    expect(parseInputDate('2026-11-01', 'start', '--since', 'Europe/Moscow')).toBe('2026-11-01T00:00:00+03:00');
    expect(parseInputDate('2026-11-01', 'end', '--until', 'Europe/Moscow')).toBe('2026-11-01T23:59:59+03:00');
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

  it('property: начало и конец дня — та же дата, 00:00:00 и 23:59:59, начало раньше конца', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1990-01-01T00:00:00Z'), max: new Date('2090-12-31T00:00:00Z'), noInvalidDate: true }),
        fc.constantFrom('Europe/Moscow', 'Europe/Berlin', 'America/New_York', 'Asia/Kolkata', 'UTC', 'Australia/Lord_Howe'),
        (date, tz) => {
          const day = date.toISOString().slice(0, 10);
          const start = parseInputDate(day, 'start', '--since', tz);
          const end = parseInputDate(day, 'end', '--until', tz);
          expect(start.slice(0, 19)).toBe(`${day}T00:00:00`);
          expect(end.slice(0, 19)).toBe(`${day}T23:59:59`);
          expect(Date.parse(start)).toBeLessThan(Date.parse(end));
          expect(formatInZone(Date.parse(start), tz)).toBe(start);
        },
      ),
    );
  });
});
