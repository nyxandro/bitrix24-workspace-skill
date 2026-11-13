/**
 * B24Client — единственная точка выхода в сеть к порталу Битрикс24.
 *
 * - call(method, params) — старая версия REST: POST <портал>/rest/<id>/<код>/<method>.json;
 * - callV3(method, body) — REST 3.0: POST <портал>/rest/api/<id>/<код>/<method>;
 * - download(url, destPath, expectedSize, maxBytes) — скачивание по подписанной
 *   ссылке DOWNLOAD_URL только с хоста портала.
 *
 * Перед любым запросом метод сверяется со списком разрешённого (только чтение).
 * Темп — не чаще одного запроса в MIN_REQUEST_INTERVAL_MS. Повторов нет: ошибка
 * переводится в код APP_B24_* и уходит наверх.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  DOWNLOAD_IDLE_TIMEOUT_MS,
  MIN_REQUEST_INTERVAL_MS,
  REQUEST_TIMEOUT_MS,
  USER_AGENT,
} from '../config/config.js';
import type { Webhook } from '../config/webhook.js';
import { ALLOWED_V1, ALLOWED_V3 } from './allowlist.js';
import { mapBitrixError } from './bitrix-errors.js';
import { AppError } from './errors.js';

export interface V1Response<T> {
  result: T;
  next?: number;
  total?: number;
}

export interface ClientOptions {
  webhook: Webhook;
  fetchFn?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  idleTimeoutMs?: number;
  minIntervalMs?: number;
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function operatingResetAt(body: Json): number | undefined {
  const time = body.time;
  return isObject(time) && typeof time.operating_reset_at === 'number' ? time.operating_reset_at : undefined;
}

function unexpected(method: string, status: number): AppError {
  return new AppError({
    code: 'APP_B24_UNEXPECTED_RESPONSE',
    userMessage: 'Битрикс24 вернул данные в неожиданном виде — команда не может их разобрать.',
    details: { method, status },
  });
}

function portalError(method: string, status: number): AppError {
  return new AppError({
    code: 'APP_B24_PORTAL_ERROR',
    userMessage: 'Битрикс24 вернул ошибку при выполнении запроса. Повторите позже.',
    details: { method, status },
  });
}

function transportError(err: unknown, method: string): AppError {
  const name = err instanceof Error || err instanceof DOMException ? err.name : '';
  if (name === 'TimeoutError' || name === 'AbortError') {
    return new AppError({
      code: 'APP_B24_TIMEOUT',
      userMessage: 'Битрикс24 не ответил вовремя. Повторите запрос или уменьшите объём (--limit).',
      details: { method },
      cause: err,
    });
  }
  return new AppError({
    code: 'APP_B24_NETWORK',
    userMessage: 'Нет связи с порталом Битрикс24. Проверьте интернет и адрес портала.',
    details: { method },
    cause: err,
  });
}

function notAllowed(method: string): AppError {
  return new AppError({
    code: 'APP_B24_METHOD_NOT_ALLOWED',
    userMessage: 'Команда попыталась вызвать метод, который этот скилл не использует; запрос не отправлен.',
    details: { method },
  });
}

export class B24Client {
  readonly webhook: Webhook;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly timeoutMs: number;
  private readonly idleTimeoutMs: number;
  private readonly minIntervalMs: number;
  private lastRequestAt: number | null = null;

  constructor(options: ClientOptions) {
    this.webhook = options.webhook;
    this.fetchFn = options.fetchFn ?? fetch;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.idleTimeoutMs = options.idleTimeoutMs ?? DOWNLOAD_IDLE_TIMEOUT_MS;
    this.minIntervalMs = options.minIntervalMs ?? MIN_REQUEST_INTERVAL_MS;
  }

  async call<T = unknown>(method: string, params: Json = {}): Promise<V1Response<T>> {
    if (!ALLOWED_V1.has(method)) {
      throw notAllowed(method);
    }
    const { origin, userId, code } = this.webhook;
    const { status, body } = await this.post(`${origin}/rest/${userId}/${code}/${method}.json`, params, method);
    if (typeof body.error === 'string') {
      throw mapBitrixError({
        code: body.error,
        status,
        method,
        description: typeof body.error_description === 'string' ? body.error_description : undefined,
        operatingResetAt: operatingResetAt(body),
      });
    }
    if (status >= 400 || !('result' in body)) {
      throw status >= 500 ? portalError(method, status) : unexpected(method, status);
    }
    const response: V1Response<T> = { result: body.result as T };
    if (typeof body.next === 'number') {
      response.next = body.next;
    }
    if (typeof body.total === 'number') {
      response.total = body.total;
    }
    return response;
  }

  async callV3<T = unknown>(method: string, payload: Json = {}): Promise<T> {
    if (!ALLOWED_V3.has(method)) {
      throw notAllowed(method);
    }
    const { origin, userId, code } = this.webhook;
    const { status, body } = await this.post(`${origin}/rest/api/${userId}/${code}/${method}`, payload, method);
    if (isObject(body.error) || typeof body.error === 'string') {
      const error = isObject(body.error) ? body.error : { code: body.error, message: body.error_description };
      const validation = Array.isArray(error.validation) ? error.validation : [];
      const fields = validation
        .map((item) => (isObject(item) && typeof item.field === 'string' ? item.field : undefined))
        .filter((field): field is string => field !== undefined);
      throw mapBitrixError({
        code: typeof error.code === 'string' ? error.code : 'UNKNOWN',
        status,
        method,
        description: typeof error.message === 'string' ? error.message : undefined,
        fields,
        operatingResetAt: operatingResetAt(body),
      });
    }
    if (status >= 400 || !('result' in body)) {
      throw status >= 500 ? portalError(method, status) : unexpected(method, status);
    }
    return body.result as T;
  }

  async download(url: string, destPath: string, expectedSize: number, maxBytes: number): Promise<{ path: string; size: number }> {
    const name = path.basename(destPath);
    const fail = (reason: string, cause?: unknown) =>
      new AppError({
        code: 'APP_B24_DOWNLOAD_FAILED',
        userMessage: `Не удалось скачать файл «${name}». Повторите позже.`,
        details: { reason },
        cause,
      });

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw fail('bad-url');
    }
    if (parsed.origin !== this.webhook.origin) {
      throw fail('foreign-host');
    }

    await this.pace();
    const tmpPath = `${destPath}.part-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    let handle: fs.promises.FileHandle | undefined;
    try {
      let response: Response;
      try {
        response = await this.fetchFn(url, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': USER_AGENT,
            Accept: '*/*',
            'Accept-Language': 'ru-RU,ru;q=0.9',
            Referer: `${this.webhook.origin}/`,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        throw fail('transport', err);
      }
      if (response.status !== 200 || !response.body) {
        throw fail(`status-${response.status}`);
      }
      // Без нужных заголовков сервер отдаёт страницу 404 под именем файла.
      const contentType = response.headers.get('content-type') ?? '';
      if (/text\/html/i.test(contentType) && !/\.html?$/i.test(name)) {
        throw fail('html-instead-of-file');
      }

      handle = await fs.promises.open(tmpPath, 'wx');
      const reader = response.body.getReader();
      let bytes = 0;
      for (;;) {
        const chunk = await this.readWithIdleTimeout(reader, fail);
        if (chunk.done) {
          break;
        }
        bytes += chunk.value.byteLength;
        if (bytes > maxBytes) {
          void reader.cancel().catch(() => undefined);
          throw fail('over-limit');
        }
        await handle.write(chunk.value);
      }
      if (bytes !== expectedSize) {
        throw fail(`size-mismatch-${bytes}-of-${expectedSize}`);
      }
      await handle.close();
      handle = undefined;
      await fs.promises.rename(tmpPath, destPath);
      return { path: destPath, size: bytes };
    } catch (err) {
      await handle?.close().catch(() => undefined);
      await fs.promises.rm(tmpPath, { force: true });
      throw err instanceof AppError ? err : fail('io', err);
    }
  }

  private readWithIdleTimeout(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    fail: (reason: string) => AppError,
  ): ReturnType<ReadableStreamDefaultReader<Uint8Array>['read']> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        void reader.cancel().catch(() => undefined);
        reject(fail('idle-timeout'));
      }, this.idleTimeoutMs);
      reader.read().then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        (err: unknown) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  private async post(url: string, payload: Json, method: string): Promise<{ status: number; body: Json }> {
    await this.pace();
    let response: Response;
    let text: string;
    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': USER_AGENT },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      text = await response.text();
    } catch (err) {
      throw transportError(err, method);
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw response.status >= 500 ? portalError(method, response.status) : unexpected(method, response.status);
    }
    if (!isObject(body)) {
      throw unexpected(method, response.status);
    }
    return { status: response.status, body };
  }

  private async pace(): Promise<void> {
    if (this.lastRequestAt !== null) {
      const wait = this.minIntervalMs - (this.now() - this.lastRequestAt);
      if (wait > 0) {
        await this.sleep(wait);
      }
    }
    this.lastRequestAt = this.now();
  }
}
