import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '../api/errors.js';
import { WEBHOOK_ENV } from '../config/config.js';
import { bootstrapEnv, formatError, loadWebhook, parsePositiveInt } from './runtime.js';

const URL_WITH_SECRET = 'https://example.bitrix24.ru/rest/1/testsecret0000/';

describe('formatError', () => {
  it('печатает русский текст и код, без адреса вебхука и ключа ссылки', () => {
    const err = new AppError({
      code: 'APP_B24_NETWORK',
      userMessage: 'Нет связи с порталом Битрикс24. Проверьте интернет и адрес портала.',
      details: { url: `${URL_WITH_SECRET}im.recent.list.json`, link: 'download.json?auth[auth]=filetoken0000' },
    });
    const lines = formatError(err, ['testsecret0000', URL_WITH_SECRET], true);
    const all = lines.join('\n');
    expect(lines[0]).toBe('Ошибка: Нет связи с порталом Битрикс24. Проверьте интернет и адрес портала. [APP_B24_NETWORK]');
    expect(all).not.toContain('testsecret0000');
    expect(all).not.toContain('filetoken0000');
  });

  it('без отладки детали не печатаются', () => {
    const err = new AppError({ code: 'APP_B24_PORTAL_ERROR', userMessage: 'Текст.', details: { bitrix: 'INTERNAL' } });
    expect(formatError(err, [], false)).toEqual(['Ошибка: Текст. [APP_B24_PORTAL_ERROR]']);
  });

  it('непредвиденная ошибка — APP_UNEXPECTED, текст исключения вычищен', () => {
    const lines = formatError(new Error(`boom at ${URL_WITH_SECRET}`), ['testsecret0000'], true);
    expect(lines[0]).toContain('[APP_UNEXPECTED]');
    expect(lines.join('\n')).not.toContain('testsecret0000');
  });
});

describe('loadWebhook', () => {
  it('берёт адрес из переменной окружения', () => {
    expect(loadWebhook({ [WEBHOOK_ENV]: URL_WITH_SECRET }).code).toBe('testsecret0000');
  });

  it('нет переменной — APP_B24_WEBHOOK_MISSING', () => {
    expect(() => loadWebhook({})).toThrowError(expect.objectContaining({ code: 'APP_B24_WEBHOOK_MISSING' }));
  });
});

describe('bootstrapEnv', () => {
  const originalCwd = process.cwd();
  afterEach(() => {
    process.chdir(originalCwd);
    delete process.env[WEBHOOK_ENV];
  });

  it('не читает .env из текущей папки', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b24-cwd-'));
    fs.writeFileSync(path.join(dir, '.env'), `${WEBHOOK_ENV}=${URL_WITH_SECRET}\n`);
    process.chdir(dir);
    bootstrapEnv(path.join(dir, 'нет-такого', '.env'));
    expect(process.env[WEBHOOK_ENV]).toBeUndefined();
  });

  it('читает свой файл, а переменная окружения главнее файла', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b24-env-'));
    const file = path.join(dir, '.env');
    fs.writeFileSync(file, `${WEBHOOK_ENV}=https://file.bitrix24.ru/rest/2/fromfile0000/\n`);
    bootstrapEnv(file);
    expect(process.env[WEBHOOK_ENV]).toBe('https://file.bitrix24.ru/rest/2/fromfile0000/');
    process.env[WEBHOOK_ENV] = URL_WITH_SECRET;
    bootstrapEnv(file);
    expect(process.env[WEBHOOK_ENV]).toBe(URL_WITH_SECRET);
  });
});

describe('parsePositiveInt', () => {
  it('принимает десятичное целое в пределах', () => {
    expect(parsePositiveInt('30', '--limit', 200)).toBe(30);
  });

  it.each(['0', '-1', '1e3', '0x0A', '+5', '2.5', '201', 'abc'])('«%s» — APP_CLI_INVALID_ARGUMENT', (raw) => {
    expect(() => parsePositiveInt(raw, '--limit', 200)).toThrowError(
      expect.objectContaining({ code: 'APP_CLI_INVALID_ARGUMENT' }),
    );
  });
});
