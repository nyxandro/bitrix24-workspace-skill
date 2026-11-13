/**
 * worktime status|records — рабочее время владельца вебхука.
 */
import { AppError } from '../api/errors.js';
import { parseInputDate } from '../render/dates.js';
import type { Envelope } from '../render/output.js';
import { asArray, type CommandContext, envelope, isObject, type Json, num, parseLimit, str, unexpected } from './common.js';

const STATUS: Readonly<Record<string, string>> = { OPENED: 'идёт', CLOSED: 'закрыт', PAUSED: 'на паузе', EXPIRED: 'не закрыт вовремя' };

export async function worktimeStatus(ctx: CommandContext): Promise<Envelope> {
  const resp = await ctx.client.call<Json>('timeman.status');
  const r = resp.result;
  if (!isObject(r)) throw unexpected('timeman.status.result');
  return envelope({
    status: STATUS[str(r.STATUS)] ?? str(r.STATUS),
    start: str(r.TIME_START) || null,
    finish: str(r.TIME_FINISH) || null,
    duration: str(r.DURATION) || null,
    breaks: str(r.TIME_LEAKS) || null,
  });
}

export async function worktimeRecords(ctx: CommandContext, opts: { from?: string; to?: string; limit?: string }): Promise<Envelope> {
  if (!opts.from || !opts.to) {
    throw new AppError({ code: 'APP_CLI_INVALID_ARGUMENT', userMessage: 'Укажите период: --from ГГГГ-ММ-ДД и --to ГГГГ-ММ-ДД.' });
  }
  const limit = parseLimit(opts.limit, 31, 100);
  const resp = await ctx.client.callV3<Json>('timeman.record.list', {
    // Условие на userId обязательно и только через «=» (timeman-record-list.md).
    filter: [
      ['userId', ctx.webhook.userId],
      ['startTime', 'between', [parseInputDate(opts.from, 'start', '--from', ctx.tz), parseInputDate(opts.to, 'end', '--to', ctx.tz)]],
    ],
    // Без select: с ним Битрикс не отдаёт state (timeman-record-list.md).
    order: { startTime: 'DESC' },
    pagination: { limit },
  });
  const records = asArray(resp.items)
    .filter(isObject)
    .map((r) => ({ id: num(r.id), start: str(r.startTime), end: str(r.endTime) || null, durationSeconds: num(r.duration), breakSeconds: num(r.breakLength), state: str(r.state) }));
  const totalSeconds = records.reduce((sum, r) => sum + (r.durationSeconds ?? 0), 0);
  const notes = records.length === 0 ? ['Записей нет за этот период.'] : records.length >= limit ? [`Показаны ${limit} записей, и сумма — только по ним; увеличьте --limit или сузьте период.`] : [];
  return envelope({ records, totalSeconds }, null, notes);
}
