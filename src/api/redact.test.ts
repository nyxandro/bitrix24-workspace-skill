import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { HIDDEN, redact } from './redact.js';

describe('redact', () => {
  it('вырезает код вебхука и ключ ссылки на скачивание', () => {
    const text =
      'fetch failed: https://example.bitrix24.ru/rest/1/testsecret0000/disk.file.get.json ' +
      'и https://example.bitrix24.ru/rest/download.json?auth[auth]=filetoken0000&token=abc&id=5';
    const out = redact(text, ['testsecret0000']);
    expect(out).not.toContain('testsecret0000');
    expect(out).not.toContain('filetoken0000');
    expect(out).toContain(`auth[auth]=${HIDDEN}`);
    expect(out).toContain(`token=${HIDDEN}`);
    expect(out).toContain('id=5');
  });

  it('понимает закодированный вид auth%5Bauth%5D и signature, _esd', () => {
    const out = redact('x?auth%5Bauth%5D=filetoken0000&signature=s1g&_esd=e5d&a=1', []);
    expect(out).toBe(`x?auth%5Bauth%5D=${HIDDEN}&signature=${HIDDEN}&_esd=${HIDDEN}&a=1`);
  });

  it('пустые секреты не ломают текст', () => {
    expect(redact('обычный текст', ['', '   '])).toBe('обычный текст');
  });

  it('property: код вебхука не остаётся в тексте ни при каком окружении', () => {
    fc.assert(
      fc.property(fc.string(), fc.stringMatching(/^[a-z0-9]{8,40}$/), fc.string(), fc.nat({ max: 3 }), (before, code, after, repeats) => {
        const text = before + code + after + code.repeat(repeats);
        expect(redact(text, [code])).not.toContain(code);
      }),
    );
  });

  it('property: текст без «=» и без секрета не меняется', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes('=')),
        fc.stringMatching(/^[a-z0-9]{8,40}$/),
        (text, code) => {
          fc.pre(!text.includes(code));
          expect(redact(text, [code])).toBe(text);
        },
      ),
    );
  });

  it('property: значение после auth=/token=/signature=/_esd= не выживает', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('auth=', 'auth[auth]=', 'auth%5Bauth%5D=', 'token=', 'signature=', '_esd='),
        fc.stringMatching(/^[A-Za-z0-9._-]{6,64}$/),
        (key, value) => {
          const out = redact(`https://h/x?${key}${value}&n=1`, []);
          expect(out).toBe(`https://h/x?${key}${HIDDEN}&n=1`);
        },
      ),
    );
  });
});
