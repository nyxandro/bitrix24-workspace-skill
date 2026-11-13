/**
 * Даты: в выводе — ISO 8601 со смещением; на входе — дата или дата-время.
 *
 * - formatInZone(epochMs, tz) — мгновение в часовом поясе, «2024-12-11T17:59:00+03:00»;
 * - calendarDate(event, 'FROM'|'TO') — время события календаря из DATE_* и TZ_*.
 *   Поле *_TS_UTC вопреки имени сдвинуто на зону сервера, по документации его
 *   нельзя читать как UTC. DATE_* приходит в записи портала: «11/20/2026 10:00:00 am»,
 *   «20.11.2026 10:00:00» или «2026-11-20 10:00:00»;
 * - parseInputDate(raw, edge, option, tz) — ввод агента: дата без времени — первое
 *   или последнее мгновение этого дня в зоне машины.
 */
import { AppError } from '../api/errors.js';

const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, '0');
const HOUR_MS = 3_600_000;

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

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  return `${sign}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
}

function wall(y: number, m: number, d: number, h: number, mi: number, s: number): string {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}`;
}

export function formatInZone(epochMs: number, tz: string): string {
  const p = zoneParts(epochMs, tz);
  return `${wall(p.y, p.m, p.d, p.h, p.mi, p.s)}${formatOffset(offsetMinutes(epochMs, tz))}`;
}

export function localDateKey(epochMs: number, tz: string): string {
  const p = zoneParts(epochMs, tz);
  return `${pad(p.y, 4)}-${pad(p.m)}-${pad(p.d)}`;
}

// Настенное время в зоне → мгновение. Перебираем смещения, действующие рядом,
// и берём самое раннее мгновение с точно таким настенным временем.
// Если такого времени нет (пропущено при переходе на летнее), возвращаем null.
function wallTimeToEpoch(y: number, m: number, d: number, h: number, mi: number, s: number, tz: string): number | null {
  const guess = Date.UTC(y, m - 1, d, h, mi, s);
  const offsets = new Set([-24, -12, 0, 12, 24].map((shift) => offsetMinutes(guess + shift * HOUR_MS, tz)));
  const target = wall(y, m, d, h, mi, s);
  const hits = [...offsets]
    .map((off) => guess - off * 60000)
    .filter((epoch) => {
      const p = zoneParts(epoch, tz);
      return wall(p.y, p.m, p.d, p.h, p.mi, p.s) === target;
    });
  return hits.length > 0 ? Math.min(...hits) : null;
}

// Первое мгновение суток в зоне. Обычно это 00:00:00; если полночь пропущена
// (переход на летнее время в полночь), — первое существующее мгновение дня.
function startOfDay(y: number, m: number, d: number, tz: string): number {
  const exact = wallTimeToEpoch(y, m, d, 0, 0, 0, tz);
  if (exact !== null) {
    return exact;
  }
  const day = `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
  const guess = Date.UTC(y, m - 1, d);
  let lo = guess - 14 * HOUR_MS;
  let hi = guess + 14 * HOUR_MS;
  // Рядом с пропущенной полночью местная дата не убывает — ищем первую секунду дня.
  while (hi - lo > 1000) {
    const mid = lo + Math.floor((hi - lo) / 2000) * 1000;
    if (localDateKey(mid, tz) >= day) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return hi;
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

function unexpectedDate(field: string): AppError {
  return new AppError({
    code: 'APP_B24_UNEXPECTED_RESPONSE',
    userMessage: 'Битрикс24 вернул данные в неожиданном виде — команда не может их разобрать.',
    details: { field },
  });
}

function checkCalendarDay(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const US_RE = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i;
const DOT_RE = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

interface Wall {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

function parsePortalWall(raw: string): Wall | null {
  const value = raw.trim();
  let y: number, m: number, d: number, h: number, mi: number, s: number;
  let match = US_RE.exec(value);
  if (match) {
    [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    [h, mi, s] = [Number(match[4] ?? 0), Number(match[5] ?? 0), Number(match[6] ?? 0)];
    const meridiem = match[7]?.toLowerCase();
    if (meridiem !== undefined) {
      if (h < 1 || h > 12) {
        return null;
      }
      h = (h % 12) + (meridiem === 'pm' ? 12 : 0);
    }
  } else if ((match = DOT_RE.exec(value))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    [h, mi, s] = [Number(match[4] ?? 0), Number(match[5] ?? 0), Number(match[6] ?? 0)];
  } else if ((match = ISO_RE.exec(value))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    [h, mi, s] = [Number(match[4] ?? 0), Number(match[5] ?? 0), Number(match[6] ?? 0)];
  } else {
    return null;
  }
  if (!checkCalendarDay(y, m, d) || h > 23 || mi > 59 || s > 59) {
    return null;
  }
  return { y, m, d, h, mi, s };
}

export function calendarDate(event: Record<string, unknown>, edge: 'FROM' | 'TO'): string {
  const field = `DATE_${edge}`;
  const raw = event[field];
  const parsed = typeof raw === 'string' ? parsePortalWall(raw) : null;
  if (parsed === null) {
    throw unexpectedDate(field);
  }
  const { y, m, d, h, mi, s } = parsed;
  if (event.DT_SKIP_TIME === 'Y') {
    return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
  }
  const tz = event[`TZ_${edge}`];
  if (typeof tz === 'string' && tz !== '' && isValidZone(tz)) {
    const exact = wallTimeToEpoch(y, m, d, h, mi, s, tz);
    // Настенного времени нет (пропущено при переходе на летнее): читаем его со
    // смещением, действовавшим до перехода, — получается мгновение сразу после разрыва.
    const guess = Date.UTC(y, m - 1, d, h, mi, s);
    const epoch = exact ?? guess - offsetMinutes(guess - 12 * HOUR_MS, tz) * 60000;
    return formatInZone(epoch, tz);
  }
  const offset = Number(event[`TZ_OFFSET_${edge}`]);
  if (event[`TZ_OFFSET_${edge}`] !== undefined && event[`TZ_OFFSET_${edge}`] !== '' && Number.isFinite(offset)) {
    return `${wall(y, m, d, h, mi, s)}${formatOffset(Math.round(offset / 60))}`;
  }
  // Зона события неизвестна — показываем настенное время без смещения, не выдумываем.
  return wall(y, m, d, h, mi, s);
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

function nextDay(y: number, m: number, d: number): [number, number, number] {
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return [next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()];
}

export function parseInputDate(raw: string, edge: 'start' | 'end', option: string, tz: string = machineTimeZone()): string {
  const value = raw.trim();
  const dateOnly = DATE_ONLY_RE.exec(value);
  if (dateOnly) {
    const [y, m, d] = [Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3])];
    if (!checkCalendarDay(y, m, d)) {
      throw invalidDate(option, raw);
    }
    // Конец дня — секунда до начала следующего: так в него попадает и
    // повторившийся час при переходе на зимнее время.
    const epoch = edge === 'start' ? startOfDay(y, m, d, tz) : startOfDay(...nextDay(y, m, d), tz) - 1000;
    return formatInZone(epoch, tz);
  }
  const local = LOCAL_DATETIME_RE.exec(value);
  if (local) {
    const [y, m, d, h, mi, s] = [1, 2, 3, 4, 5, 6].map((i) => Number(local[i] ?? 0)) as [number, number, number, number, number, number];
    if (!checkCalendarDay(y, m, d) || h > 23 || mi > 59 || s > 59) {
      throw invalidDate(option, raw);
    }
    const epoch = wallTimeToEpoch(y, m, d, h, mi, s, tz);
    if (epoch === null) {
      throw invalidDate(option, raw);
    }
    return formatInZone(epoch, tz);
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
