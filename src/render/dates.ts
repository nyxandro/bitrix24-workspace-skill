/**
 * Даты: в выводе — ISO 8601 со смещением; на входе — дата или дата-время.
 *
 * - formatInZone(epochMs, tz) — мгновение в часовом поясе, «2024-12-11T17:59:00+03:00»;
 * - calendarDate(event, 'FROM'|'TO') — время события календаря из *_TS_UTC и TZ_*
 *   (сами DATE_FROM/DATE_TO приходят в виде «12/11/2024 05:59:00 pm» без зоны);
 * - parseInputDate(raw, edge, option, tz) — ввод агента: дата без времени —
 *   начало или конец дня в зоне машины.
 */
import { AppError } from '../api/errors.js';

const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, '0');

function zoneParts(epochMs: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(epochMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

// Смещение зоны в минутах для данного мгновения (учитывает переход на летнее время).
function offsetMinutes(epochMs: number, tz: string): number {
  const p = zoneParts(epochMs, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - Math.floor(epochMs / 1000) * 1000) / 60000);
}

export function formatInZone(epochMs: number, tz: string): string {
  const p = zoneParts(epochMs, tz);
  const off = offsetMinutes(epochMs, tz);
  const sign = off >= 0 ? '+' : '-';
  return `${pad(p.y, 4)}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

function formatDateInZone(epochMs: number, tz: string): string {
  const p = zoneParts(epochMs, tz);
  return `${pad(p.y, 4)}-${pad(p.m)}-${pad(p.d)}`;
}

// Настенное время в зоне → мгновение. Две итерации покрывают переход на летнее время.
function wallTimeToEpoch(y: number, m: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, h, mi, s);
  let epoch = guess - offsetMinutes(guess, tz) * 60000;
  epoch = guess - offsetMinutes(epoch, tz) * 60000;
  return epoch;
}

export function machineTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function isValidZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function calendarDate(event: Record<string, unknown>, edge: 'FROM' | 'TO'): string {
  const ts = Number(event[`DATE_${edge}_TS_UTC`]);
  if (!Number.isFinite(ts) || event[`DATE_${edge}_TS_UTC`] === undefined || event[`DATE_${edge}_TS_UTC`] === '') {
    throw new AppError({
      code: 'APP_B24_UNEXPECTED_RESPONSE',
      userMessage: 'Битрикс24 вернул данные в неожиданном виде — команда не может их разобрать.',
      details: { field: `DATE_${edge}_TS_UTC` },
    });
  }
  const rawTz = event[`TZ_${edge}`];
  // Без зоны показываем то же мгновение в UTC — время не выдумываем.
  const tz = typeof rawTz === 'string' && rawTz !== '' && isValidZone(rawTz) ? rawTz : 'UTC';
  return event.DT_SKIP_TIME === 'Y' ? formatDateInZone(ts * 1000, tz) : formatInZone(ts * 1000, tz);
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const ZONED_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

function invalidDate(option: string, raw: string): AppError {
  return new AppError({
    code: 'APP_CLI_INVALID_ARGUMENT',
    userMessage: `Параметр ${option}: ожидается дата ГГГГ-ММ-ДД или дата со временем ГГГГ-ММ-ДДTчч:мм, получено «${raw}».`,
  });
}

function checkCalendarDay(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function parseInputDate(raw: string, edge: 'start' | 'end', option: string, tz: string = machineTimeZone()): string {
  const value = raw.trim();
  const dateOnly = DATE_ONLY_RE.exec(value);
  if (dateOnly) {
    const [y, m, d] = [Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3])];
    if (!checkCalendarDay(y, m, d)) {
      throw invalidDate(option, raw);
    }
    const epoch = edge === 'start' ? wallTimeToEpoch(y, m, d, 0, 0, 0, tz) : wallTimeToEpoch(y, m, d, 23, 59, 59, tz);
    return formatInZone(epoch, tz);
  }
  const local = LOCAL_DATETIME_RE.exec(value);
  if (local) {
    const [y, m, d, h, mi, s] = [1, 2, 3, 4, 5, 6].map((i) => Number(local[i] ?? 0)) as [number, number, number, number, number, number];
    if (!checkCalendarDay(y, m, d) || h > 23 || mi > 59 || s > 59) {
      throw invalidDate(option, raw);
    }
    return formatInZone(wallTimeToEpoch(y, m, d, h, mi, s, tz), tz);
  }
  if (ZONED_DATETIME_RE.test(value)) {
    const epoch = Date.parse(value);
    const day = value.slice(0, 10).split('-').map(Number) as [number, number, number];
    if (!Number.isFinite(epoch) || !checkCalendarDay(...day)) {
      throw invalidDate(option, raw);
    }
    return formatInZone(epoch, tz);
  }
  throw invalidDate(option, raw);
}
