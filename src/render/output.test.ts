import { describe, expect, it } from 'vitest';
import { finalizeOutput } from './output.js';

describe('finalizeOutput', () => {
  it('печатает конверт data/next/notes', () => {
    const out = JSON.parse(finalizeOutput({ data: [{ id: 1 }], next: null, notes: [] }, ['testsecret0000']));
    expect(out).toEqual({ data: [{ id: 1 }], next: null, notes: [] });
  });

  it('значения token=/auth= в тексте заменяются и добавляется пометка', () => {
    const out = JSON.parse(
      finalizeOutput({ data: [{ text: 'смотри https://x.ru/?token=abc&id=1' }], next: null, notes: [] }, ['testsecret0000']),
    );
    expect(out.data[0].text).toBe('смотри https://x.ru/?token=<скрыто>&id=1');
    expect(out.notes).toEqual(['В тексте скрыты значения, похожие на ключи доступа (token=, auth= и т. п.).']);
  });

  it('кавычка и перевод строки после значения не ломают JSON и не съедают текст', () => {
    const text = 'curl "https://x.ru/?token=abc"\ntoken=def\nследующая строка\tтаб';
    const out = JSON.parse(finalizeOutput({ data: { text }, next: null, notes: [] }, ['testsecret0000']));
    expect(out.data.text).toBe('curl "https://x.ru/?token=<скрыто>"\ntoken=<скрыто>\nследующая строка\tтаб');
  });

  it('ключи объектов не трогаются, вычищаются только строки-значения', () => {
    const out = JSON.parse(finalizeOutput({ data: { 'token=abc': 1, list: ['auth=xyz', 5, null, true] }, next: null, notes: [] }, []));
    expect(out.data).toEqual({ 'token=abc': 1, list: ['auth=<скрыто>', 5, null, true] });
  });

  it.each([
    ['в данных', { data: { deep: [{ x: 'abc testsecret0000' }] }, next: null, notes: [] }],
    ['в пометках', { data: [], next: null, notes: ['testsecret0000'] }],
    ['в курсоре', { data: [], next: 'testsecret0000', notes: [] }],
    ['в ключе объекта', { data: { testsecret0000: 1 }, next: null, notes: [] }],
  ])('код вебхука %s — APP_B24_SECRET_IN_OUTPUT', (_name, envelope) => {
    expect(() => finalizeOutput(envelope, ['testsecret0000'])).toThrowError(
      expect.objectContaining({ code: 'APP_B24_SECRET_IN_OUTPUT' }),
    );
  });
});
