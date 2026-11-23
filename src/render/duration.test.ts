import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatDuration } from './duration.js';

// «9 ч 30 мин» → минуты; null — текст не по формату.
function minutesOf(text: string): number | null {
  const m = /^(?:(\d+) ч)?(?: ?(\d+) мин)?$/.exec(text);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

describe('formatDuration', () => {
  it.each([
    [0, '0 мин'],
    [29, 'меньше минуты'],
    [30, '1 мин'],
    [5100, '1 ч 25 мин'],
    [3600, '1 ч'],
    [3599, '1 ч'],
    [58_380, '16 ч 13 мин'],
  ])('%i с → «%s»', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });

  it.each([-1, 1.5, Number.NaN])('%s — ошибка программы, а не текст', (seconds) => {
    expect(() => formatDuration(seconds)).toThrow();
  });

  it('property: часы и минуты в тексте дают ровно округлённые минуты, минут меньше 60', () => {
    fc.assert(
      fc.property(fc.integer({ min: 30, max: 10_000 * 3600 }), (seconds) => {
        const text = formatDuration(seconds);
        expect(minutesOf(text)).toBe(Math.round(seconds / 60));
        const minutesPart = /(\d+) мин/.exec(text)?.[1];
        expect(minutesPart === undefined || Number(minutesPart) < 60).toBe(true);
      }),
      { examples: [[30], [59], [60], [89], [90], [3570], [3599], [3600], [3629], [3630]] },
    );
  });
});
