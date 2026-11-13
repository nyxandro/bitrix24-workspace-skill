/**
 * Каркас исполнения CLI: окружение, граница ошибок и общие парсеры.
 *
 * - bootstrapEnv(path) — адрес вебхука из своего файла .env (не из текущей
 *   папки); переменная окружения главнее файла; другие строки файла не трогаем;
 * - loadWebhook(env) — адрес вебхука из окружения, fail-fast;
 * - secretsFromEnv(env) — что вычищать из любого вывода: адрес и код;
 * - formatError(err, secrets, debug) — строки для stderr: русский текст и код,
 *   детали только в отладке, всё через redact();
 * - reportError(err) — единая граница ошибок: печать и код выхода 1;
 * - parsePositiveInt(raw, optionName, max?) — строгая десятичная проверка чисел.
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import { AppError } from '../api/errors.js';
import { redact } from '../api/redact.js';
import { DEBUG_ENV, ENV_PATH, ENV_PATH_DISPLAY, WEBHOOK_ENV } from '../config/config.js';
import { parseWebhook, type Webhook } from '../config/webhook.js';

// Разбираем файл сами (dotenv.parse), а не dotenv.config: config умеет печатать
// служебные строки в stdout и переключаться в другие режимы по переменным
// окружения — а в stdout у нас только JSON.
export function bootstrapEnv(envPath: string = ENV_PATH, env: NodeJS.ProcessEnv = process.env): void {
  let content: string;
  try {
    content = fs.readFileSync(envPath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw new AppError({
      code: 'APP_B24_CONFIG_UNREADABLE',
      userMessage: `Не удалось прочитать файл настроек ${ENV_PATH_DISPLAY}: проверьте, что это файл и у вас есть права на чтение.`,
      cause: err,
    });
  }
  const value = dotenv.parse(content)[WEBHOOK_ENV];
  if (value !== undefined && !env[WEBHOOK_ENV]) {
    env[WEBHOOK_ENV] = value;
  }
}

export function loadWebhook(env: NodeJS.ProcessEnv = process.env): Webhook {
  return parseWebhook(env[WEBHOOK_ENV]);
}

// Секреты для вычистки: адрес целиком и код, если адрес задан (даже неверный —
// его кусок мог попасть в текст ошибки).
export function secretsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env[WEBHOOK_ENV]?.trim();
  if (!raw) {
    return [];
  }
  const secrets = [raw];
  try {
    secrets.push(parseWebhook(raw).code);
  } catch {
    // Неверный адрес: вычищаем хотя бы его целиком.
  }
  return secrets;
}

export function isDebug(env: NodeJS.ProcessEnv = process.env): boolean {
  return ['1', 'true', 'yes', 'on'].includes((env[DEBUG_ENV] ?? '').trim().toLowerCase());
}

const MAX_CAUSE_DEPTH = 4;

// Цепочка причин: для сетевой ошибки «fetch failed» настоящая причина
// (ENOTFOUND, отказ соединения, сертификат) лежит уровнем-двумя глубже.
function describeCauses(err: unknown): string[] {
  const lines: string[] = [];
  let current: unknown = err instanceof AppError ? err.cause : err;
  for (let depth = 0; current !== undefined && current !== null && depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (current instanceof Error) {
      const code = (current as NodeJS.ErrnoException).code;
      lines.push(`Причина: ${current.name}: ${current.message}${code ? ` (${code})` : ''}`);
      current = current.cause;
    } else {
      lines.push(`Причина: ${String(current)}`);
      current = undefined;
    }
  }
  return lines;
}

export function formatError(err: unknown, secrets: readonly string[], debug: boolean): string[] {
  const lines =
    err instanceof AppError
      ? [`Ошибка: ${err.userMessage} [${err.code}]`]
      : [`Ошибка: Непредвиденная ошибка. Запустите с ${DEBUG_ENV}=1, чтобы увидеть подробности. [APP_UNEXPECTED]`];
  if (debug) {
    if (err instanceof AppError && err.details !== undefined) {
      lines.push(`Детали: ${JSON.stringify(err.details)}`);
    }
    lines.push(...describeCauses(err));
  }
  return lines.map((line) => redact(line, secrets));
}

// Код выхода ставим через exitCode, а не process.exit(): при выводе в канал
// (pipe) stdout и stderr успевают дописаться.
export function reportError(err: unknown, secrets: readonly string[] = secretsFromEnv()): void {
  for (const line of formatError(err, secrets, isDebug())) {
    console.error(line);
  }
  process.exitCode = 1;
}

const DECIMAL_INT_RE = /^\d+$/;

// Голый Number() принимает «1e3», «0x0A», «+5» — опечатка превратилась бы в
// неожиданный объём выборки, поэтому сначала формат по строке, потом диапазон.
export function parsePositiveInt(raw: string, optionName: string, max?: number): number {
  const trimmed = raw.trim();
  const value = Number(trimmed);
  const withinMax = max === undefined || value <= max;
  if (!DECIMAL_INT_RE.test(trimmed) || !Number.isSafeInteger(value) || value <= 0 || !withinMax) {
    const range = max === undefined ? 'положительным целым числом' : `целым числом от 1 до ${max}`;
    throw new AppError({
      code: 'APP_CLI_INVALID_ARGUMENT',
      userMessage: `Параметр ${optionName}: должен быть ${range}, получено «${raw}».`,
    });
  }
  return value;
}
