/**
 * meetings list|get — ИИ-итоги видеовстреч (CoPilot Follow-up, REST 3.0).
 *
 * Администратор через API видит итоги всех встреч компании, а у
 * call.followup.get фильтра нет — поэтому выдача всегда сужена до встреч, где
 * владелец вебхука участник. Ссылки на записи (tracks, url) не выводятся.
 */
import { AppError } from '../api/errors.js';
import { MAX_MEMBERS, MAX_TEXT_CHARS } from '../config/config.js';
import { parseInputDate, toZone } from '../render/dates.js';
import type { Envelope } from '../render/output.js';
import { bbToText, truncate } from '../render/text.js';
import { asArray, type CommandContext, decodeCursor, encodeCursor, envelope, isObject, type Json, num, parseId, parseLimit, str } from './common.js';

const MAX_PAGE = 20; // тяжёлые поля ограничивают страницу 20 записями
const TRANSCRIPT_CHARS = 40_000;
const URL_KEY_RE = /url/i;

const isCursor = (v: unknown): v is Json => isObject(v);

function allParticipants(item: Json) {
  return asArray(item.participants)
    .filter(isObject)
    .map((p) => ({ id: num(p.userId) ?? 0, name: str(p.name) }));
}

// Текстовые блоки итогов: строки — без разметки и обрезанные; объекты — без
// полей со ссылками.
function clean(value: unknown, tz: string): unknown {
  if (typeof value === 'string') return truncate(bbToText(value, new Map(), tz), MAX_TEXT_CHARS).text;
  if (Array.isArray(value)) return value.map((v) => clean(v, tz));
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !URL_KEY_RE.test(k)).map(([k, v]) => [k, clean(v, tz)]));
  }
  return value;
}

export async function meetingsList(ctx: CommandContext, opts: { from?: string; to?: string; limit?: string; page?: string }): Promise<Envelope> {
  if (!opts.from || !opts.to) {
    throw new AppError({ code: 'APP_CLI_INVALID_ARGUMENT', userMessage: 'Укажите период: --from ГГГГ-ММ-ДД и --to ГГГГ-ММ-ДД (так требует Битрикс).' });
  }
  const limit = parseLimit(opts.limit, MAX_PAGE, MAX_PAGE);
  const pagination: Json = { limit };
  if (opts.page) pagination.afterCursor = decodeCursor(opts.page, '--page', isCursor);
  const resp = await ctx.client.callV3<Json>('call.followup.list', {
    filter: {
      participantId: ctx.webhook.userId,
      startDate: { from: parseInputDate(opts.from, 'start', '--from', ctx.tz), to: parseInputDate(opts.to, 'end', '--to', ctx.tz) },
    },
    select: ['callId', 'startDate', 'endDate', 'durationSeconds', 'participants', 'overview.topic'],
    order: { startDate: 'desc' },
    pagination,
  });
  const data = asArray(resp.items)
    .filter(isObject)
    .map((m) => ({
      callId: num(m.callId),
      start: toZone(str(m.startDate), ctx.tz),
      end: toZone(str(m.endDate), ctx.tz),
      durationSeconds: num(m.durationSeconds),
      topic: isObject(m.overview) ? str(m.overview.topic) : '',
      participants: allParticipants(m).slice(0, MAX_MEMBERS),
      participantsTotal: allParticipants(m).length,
    }));
  const next = resp.hasMore === true && isObject(resp.afterCursor) ? encodeCursor(resp.afterCursor) : null;
  const notes = data.length === 0 ? ['Итогов встреч за этот период нет.'] : next ? ['Есть ещё: --page <next>.'] : [];
  return envelope(data, next, notes);
}

export async function meetingsGet(ctx: CommandContext, idRaw: string, opts: { transcript?: boolean; full?: boolean }): Promise<Envelope> {
  const callId = parseId(idRaw, 'callId');
  const select = ['callId', 'startDate', 'endDate', 'durationSeconds', 'participants', 'overview', 'summary', ...(opts.transcript ? ['transcription'] : [])];
  const resp = await ctx.client.callV3<Json>('call.followup.get', { callId, select });
  const item = isObject(resp.item) ? resp.item : resp;
  const people = allParticipants(item);
  if (!people.some((p) => p.id === ctx.webhook.userId)) {
    throw new AppError({
      code: 'APP_B24_ACCESS_DENIED',
      userMessage: 'Нет доступа: вы не участник этой встречи. Скилл показывает итоги только встреч с вашим участием.',
    });
  }
  const overview = isObject(item.overview) ? item.overview : {};
  const data: Json = {
    callId,
    start: toZone(str(item.startDate), ctx.tz),
    end: toZone(str(item.endDate), ctx.tz),
    durationSeconds: num(item.durationSeconds),
    participants: people.slice(0, MAX_MEMBERS),
    participantsTotal: people.length,
    topic: str(overview.topic),
    meetingType: clean(overview.meetingType, ctx.tz),
    agenda: clean(overview.agenda, ctx.tz),
    agreements: clean(overview.agreements, ctx.tz),
    actionItems: clean(overview.actionItems, ctx.tz),
    takeaways: clean(overview.detailedTakeaways, ctx.tz),
    summary: asArray(isObject(item.summary) ? item.summary.segments : [])
      .filter(isObject)
      .map((s) => ({ title: str(s.title), summary: truncate(bbToText(str(s.summary), new Map(), ctx.tz), MAX_TEXT_CHARS).text })),
  };
  const notes: string[] = [];
  if (opts.transcript) {
    const segments = asArray(isObject(item.transcription) ? item.transcription.segments : []).filter(isObject);
    const transcript: { speaker: string; text: string }[] = [];
    let used = 0;
    for (const s of segments) {
      const text = str(s.text);
      if (!opts.full && used + text.length > TRANSCRIPT_CHARS) {
        notes.push(`Расшифровка обрезана на ${TRANSCRIPT_CHARS} знаков, полностью — --full.`);
        break;
      }
      used += text.length;
      transcript.push({ speaker: str(s.userName), text });
    }
    data.transcript = transcript;
  }
  return envelope(data, null, notes);
}
