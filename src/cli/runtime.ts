/**
 * Каркас исполнения CLI: окружение, граница ошибок и общие парсеры.
 *
 * - bootstrapEnv(path) — загрузка .env только из своего пути (не из текущей
 *   папки); настоящие переменные окружения главнее файла;
 * - loadWebhook(env) — адрес вебхука из окружения, fail-fast;
 * - formatError(err, secrets, debug) — строки для stderr: русский текст и код,
 *   детали только в отладке, всё через redact();
 * - printErrorAndExit(err, secrets) — единая граница ошибок;
 * - parsePositiveInt(raw, optionName, max?) — строгая десятичная проверка чисел.
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import { AppError } from '../api/errors.js';
import { redact } from '../api/redact.js';
import { DEBUG_ENV, ENV_PATH, WEBHOOK_ENV } from '../config/config.js';
import { parseWebhook, type Webhook } from '../config/webhook.js';

export function bootstrapEnv(envPath: string = ENV_PATH): void {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true });
  }
}

export function loadWebhook(env: NodeJS.ProcessEnv = process.env): Webhook {
  return parseWebhook(env[WEBHOOK_ENV]);
}

// Секреты для вычистки: код и полный адрес, если адрес вообще задан (даже
// неверный — его кусок мог попасть в текст ошибки).
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

function describeDetails(err: unknown): string {
  if (err instanceof AppError) {
    const cause = err.cause instanceof Error ? `${err.cause.name}: ${err.cause.message}` : err.cause;
    return `Детали: ${JSON.stringify({ details: err.details ?? null, cause: cause ?? null })}`;
  }
  return err instanceof Error ? `Детали: ${err.name}: ${err.message}` : `Детали: ${String(err)}`;
}

export function formatError(err: unknown, secrets: readonly string[], debug: boolean): string[] {
  const lines =
    err instanceof AppError
      ? [`Ошибка: ${err.userMessage} [${err.code}]`]
      : [`Ошибка: Непредвиденная ошибка. Запустите с ${DEBUG_ENV}=1, чтобы увидеть подробности. [APP_UNEXPECTED]`];
  if (debug) {
    lines.push(describeDetails(err));
  }
  return lines.map((line) => redact(line, secrets));
}

export function printErrorAndExit(err: unknown, secrets: readonly string[] = secretsFromEnv()): never {
  for (const line of formatError(err, secrets, Boolean(process.env[DEBUG_ENV]))) {
    console.error(line);
  }
  process.exit(1);
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
