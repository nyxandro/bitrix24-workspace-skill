import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AppError } from '../api/errors.js';
import { parseWebhook } from './webhook.js';

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof AppError ? err.code : 'NOT_APP_ERROR';
  }
  return undefined;
}

describe('parseWebhook', () => {
  it('разбирает адрес с косой чертой на конце', () => {
    expect(parseWebhook('https://example.bitrix24.ru/rest/1/testsecret0000/')).toEqual({
      origin: 'https://example.bitrix24.ru',
      userId: 1,
      code: 'testsecret0000',
    });
  });

  it('принимает адрес без косой черты, с пробелами и кавычками по краям', () => {
    const expected = { origin: 'https://example.bitrix24.ru', userId: 7, code: 'abc123def456' };
    expect(parseWebhook('https://example.bitrix24.ru/rest/7/abc123def456')).toEqual(expected);
    expect(parseWebhook('  "https://example.bitrix24.ru/rest/7/abc123def456/"  ')).toEqual(expected);
    expect(parseWebhook("'https://example.bitrix24.ru/rest/7/abc123def456/'")).toEqual(expected);
  });

  it('пустое значение — APP_B24_WEBHOOK_MISSING', () => {
    expect(errorCode(() => parseWebhook(undefined))).toBe('APP_B24_WEBHOOK_MISSING');
    expect(errorCode(() => parseWebhook(''))).toBe('APP_B24_WEBHOOK_MISSING');
    expect(errorCode(() => parseWebhook('   '))).toBe('APP_B24_WEBHOOK_MISSING');
  });

  it.each([
    ['http вместо https', 'http://example.bitrix24.ru/rest/1/testsecret0000/'],
    ['нет номера пользователя', 'https://example.bitrix24.ru/rest/testsecret0000/'],
    ['адрес с именем метода', 'https://example.bitrix24.ru/rest/1/testsecret0000/profile.json'],
    ['не адрес', 'testsecret0000'],
    ['с параметрами', 'https://example.bitrix24.ru/rest/1/testsecret0000/?x=1'],
    ['адрес REST 3.0', 'https://example.bitrix24.ru/rest/api/1/testsecret0000/'],
  ])('%s — APP_B24_WEBHOOK_INVALID', (_name, raw) => {
    expect(errorCode(() => parseWebhook(raw))).toBe('APP_B24_WEBHOOK_INVALID');
  });

  it('сообщение об ошибке не содержит сам адрес', () => {
    let caught: AppError | undefined;
    try {
      parseWebhook('http://example.bitrix24.ru/rest/1/testsecret0000/');
    } catch (err) {
      caught = err as AppError;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect(String(caught?.userMessage)).not.toContain('testsecret0000');
    expect(JSON.stringify(caught?.details ?? null)).not.toContain('testsecret0000');
  });

  it('property: любой правильный адрес разбирается в свои же части', () => {
    const host = fc
      .tuple(fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,18}[a-z0-9]$/), fc.constantFrom('bitrix24.ru', 'bitrix24.com', 'example.org'))
      .map(([sub, domain]) => `${sub}.${domain}`);
    fc.assert(
      fc.property(
        host,
        fc.integer({ min: 1, max: 9_999_999 }),
        fc.stringMatching(/^[a-z0-9]{8,40}$/),
        fc.boolean(),
        fc.constantFrom('', ' ', '\t', '"', "'"),
        (h, userId, code, slash, wrap) => {
          const url = `https://${h}/rest/${userId}/${code}${slash ? '/' : ''}`;
          const raw = wrap === '"' || wrap === "'" ? `${wrap}${url}${wrap}` : `${wrap}${url}${wrap}`;
          expect(parseWebhook(raw)).toEqual({ origin: `https://${h}`, userId, code });
        },
      ),
    );
  });
});
