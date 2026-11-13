/**
 * calendar upcoming|events|event — встречи и события.
 *
 * Время события — из DATE_* и TZ_* (calendarDate). calendar.event.get.nearest
 * не используем: он не отдаёт часовой пояс.
 */
import { AppError } from '../api/errors.js';
import { MAX_TEXT_CHARS } from '../config/config.js';
import { calendarDate, formatInZone, parseInputDate } from '../render/dates.js';
import { htmlToText, looksLikeHtml } from '../render/html.js';
import type { Envelope } from '../render/output.js';
import { bbToText, truncate } from '../render/text.js';
import { asArray, type CommandContext, envelope, isObject, type Json, num, parseId, parseLimit, personName, str } from './common.js';

const USER_GET_PAGE = 50; // user.get отдаёт не больше 50 человек за раз
const MAX_ATTENDEE_LOOKUP = 200;
const RESPONSES: Readonly<Record<string, string>> = { Y: 'принял', N: 'отклонил', Q: 'не ответил', H: 'организатор' };

function invalid(message: string): AppError {
  return new AppError({ code: 'APP_CLI_INVALID_ARGUMENT', userMessage: message });
}

function isRecurring(rrule: unknown): boolean {
  return isObject(rrule) ? Object.keys(rrule).length > 0 : str(rrule).trim() !== '';
}

async function attendeeNames(ctx: CommandContext, events: Json[]): Promise<Map<number, string>> {
  const ids = [...new Set(events.flatMap((e) => asArray(e.ATTENDEE_LIST).filter(isObject).map((a) => num(a.id))).filter((id): id is number => id !== null))];
  const names = new Map<number, string>();
  if (ids.length === 0) return names;
  const wanted = ids.slice(0, MAX_ATTENDEE_LOOKUP);
  for (let i = 0; i < wanted.length; i += USER_GET_PAGE) {
    const resp = await ctx.client.call<unknown>('user.get', { filter: { ID: wanted.slice(i, i + USER_GET_PAGE) } });
    for (const u of asArray(resp.result).filter(isObject)) {
      const id = num(u.ID);
      if (id !== null) names.set(id, personName(u));
    }
  }
  return names;
}

function toEvent(e: Json, names: Map<number, string>) {
  return {
    id: num(e.ID),
    title: str(e.NAME),
    start: calendarDate(e, 'FROM'),
    end: calendarDate(e, 'TO'),
    allDay: e.DT_SKIP_TIME === 'Y',
    location: str(e.LOCATION),
    recurring: isRecurring(e.RRULE),
    isMeeting: e.IS_MEETING === true || e.IS_MEETING === 'Y',
    myResponse: RESPONSES[str(e.MEETING_STATUS)] ?? null,
    attendees: asArray(e.ATTENDEE_LIST)
      .filter(isObject)
      .map((a) => {
        const id = num(a.id) ?? 0;
        return { id, name: names.get(id) ?? `сотрудник ${id}`, response: RESPONSES[str(a.status)] ?? str(a.status) };
      }),
  };
}

async function eventsFor(ctx: CommandContext, params: Json): Promise<Envelope> {
  const resp = await ctx.client.call<unknown>('calendar.event.get', params);
  const events = asArray(resp.result).filter(isObject);
  const names = await attendeeNames(ctx, events);
  const data = events.map((e) => toEvent(e, names)).sort((a, b) => (Date.parse(a.start) || 0) - (Date.parse(b.start) || 0));
  return envelope(data, null, data.length === 0 ? ['Событий нет за этот период.'] : []);
}

function dayOf(raw: string, edge: 'start' | 'end', option: string, tz: string): string {
  return parseInputDate(raw, edge, option, tz).slice(0, 10);
}

export async function calendarUpcoming(ctx: CommandContext, opts: { days?: string }, now: Date = new Date()): Promise<Envelope> {
  const days = parseLimit(opts.days, 7, 60, '--days');
  const today = formatInZone(now.getTime(), ctx.tz).slice(0, 10);
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days);
  return eventsFor(ctx, { type: 'user', ownerId: ctx.webhook.userId, from: today, to: end.toISOString().slice(0, 10) });
}

export async function calendarEvents(ctx: CommandContext, opts: { from?: string; to?: string; owner?: string }): Promise<Envelope> {
  if (!opts.from || !opts.to) {
    throw invalid('Укажите период: --from ГГГГ-ММ-ДД и --to ГГГГ-ММ-ДД.');
  }
  const owner = (opts.owner ?? 'me').trim();
  let target: Json;
  const m = /^(user|group):(\d+)$/.exec(owner);
  if (owner === 'me') target = { type: 'user', ownerId: ctx.webhook.userId };
  else if (owner === 'company') target = { type: 'company_calendar', ownerId: 0 };
  else if (m) target = { type: m[1], ownerId: Number(m[2]) };
  else throw invalid(`Параметр --owner: ожидается me | company | user:<номер> | group:<номер>, получено «${owner}».`);
  return eventsFor(ctx, { ...target, from: dayOf(opts.from, 'start', '--from', ctx.tz), to: dayOf(opts.to, 'end', '--to', ctx.tz) });
}

export async function calendarEvent(ctx: CommandContext, idRaw: string, opts: { full?: boolean }): Promise<Envelope> {
  const resp = await ctx.client.call<Json>('calendar.event.getbyid', { id: parseId(idRaw, 'id') });
  const e = isObject(resp.result) ? resp.result : {};
  const names = await attendeeNames(ctx, [e]);
  const raw = bbToText(str(e.DESCRIPTION), new Map(), ctx.tz);
  const text = looksLikeHtml(raw) ? htmlToText(raw) : raw;
  const cut = opts.full ? { text, truncated: false } : truncate(text, MAX_TEXT_CHARS);
  return envelope({ ...toEvent(e, names), description: cut.text, ...(cut.truncated ? { descriptionTruncated: true } : {}) });
}
