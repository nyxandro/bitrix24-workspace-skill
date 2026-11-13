import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Webhook } from '../config/webhook.js';
import { B24Client } from './client.js';
import { AppError } from './errors.js';

const WEBHOOK: Webhook = { origin: 'https://example.bitrix24.ru', userId: 1, code: 'testsecret0000' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function makeClient(fetchFn: typeof fetch, extra: Partial<ConstructorParameters<typeof B24Client>[0]> = {}) {
  let clock = 0;
  const sleeps: number[] = [];
  const client = new B24Client({
    webhook: WEBHOOK,
    fetchFn,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    ...extra,
  });
  return { client, sleeps, advance: (ms: number) => (clock += ms) };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof AppError) {
      expect(err.userMessage).not.toContain('testsecret0000');
      expect(JSON.stringify(err.details ?? null)).not.toContain('testsecret0000');
      return err.code;
    }
    throw err;
  }
  throw new Error('ожидалась ошибка');
}

describe('B24Client.call (старая версия REST)', () => {
  it('отправляет POST с JSON на адрес метода', async () => {
    const fetchFn = vi.fn(async () => json({ result: [{ id: 1 }], next: 50, total: 120, time: {} }));
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    const res = await client.call('im.recent.list', { LIMIT: 50 });
    expect(res).toEqual({ result: [{ id: 1 }], next: 50, total: 120 });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.bitrix24.ru/rest/1/testsecret0000/im.recent.list.json');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"LIMIT":50}');
    const headers = new Headers(init.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('User-Agent')).toBe('bitrix24-workspace-skill/0.1.0');
  });

  it('метод не из списка — APP_B24_METHOD_NOT_ALLOWED, запроса нет', async () => {
    const fetchFn = vi.fn();
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.call('im.message.add', { DIALOG_ID: 'chat1' }))).toBe('APP_B24_METHOD_NOT_ALLOWED');
    expect(await codeOf(client.call('mail.message.get', { id: 1 }))).toBe('APP_B24_METHOD_NOT_ALLOWED');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('ошибка Битрикса переводится в свой код', async () => {
    const fetchFn = vi.fn(async () => json({ error: 'insufficient_scope', error_description: 'The request requires higher privileges' }, 401));
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.call('disk.storage.getlist'))).toBe('APP_B24_SCOPE_MISSING');
  });

  it('пустой и числовой код ошибки разбираются по наличию поля error', async () => {
    const empty = vi.fn(async () => json({ error: '', error_description: 'Not found' }, 400));
    expect(await codeOf(makeClient(empty as unknown as typeof fetch).client.call('tasks.task.get', { taskId: 1 }))).toBe('APP_B24_NOT_FOUND');
    const numeric = vi.fn(async () => json({ error: 100, error_description: 'Invalid value' }, 400));
    expect(await codeOf(makeClient(numeric as unknown as typeof fetch).client.call('tasks.task.get', { taskId: 1 }))).toBe(
      'APP_B24_BAD_REQUEST',
    );
  });

  it('время сброса лимита берётся из последнего успешного ответа, если в ошибке его нет', async () => {
    const responses = [
      json({ result: [], time: { operating_reset_at: 1_800_000_000 } }),
      json({ error: 'OPERATION_TIME_LIMIT', error_description: 'x' }, 429),
    ];
    const fetchFn = vi.fn(async () => responses.shift() as Response);
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    await client.call('im.recent.list');
    try {
      await client.call('im.recent.list');
    } catch (err) {
      expect((err as AppError).userMessage).toMatch(/Повторите после \d{2}:\d{2}\.$/);
      return;
    }
    throw new Error('ожидалась ошибка');
  });

  it('переадресация портала — APP_B24_PORTAL_MOVED, запрос не повторяется GET-ом', async () => {
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.redirect).toBe('manual');
      return new Response(null, { status: 301, headers: { Location: 'https://new.bitrix24.ru/rest/1/x/im.recent.list.json' } });
    });
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.call('im.recent.list'))).toBe('APP_B24_PORTAL_MOVED');
  });

  it('OPERATION_TIME_LIMIT берёт время сброса из ответа', async () => {
    const fetchFn = vi.fn(async () => json({ error: 'OPERATION_TIME_LIMIT', error_description: 'x', time: { operating_reset_at: 1_800_000_000 } }, 429));
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.call('im.recent.list'))).toBe('APP_B24_METHOD_TIME_LIMIT');
  });

  it('обрыв сети — APP_B24_NETWORK, адрес не просачивается', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError(`fetch failed for ${WEBHOOK.origin}/rest/1/testsecret0000/im.recent.list.json`);
    });
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.call('im.recent.list'))).toBe('APP_B24_NETWORK');
  });

  it('нет ответа дольше таймаута — APP_B24_TIMEOUT', async () => {
    const fetchFn = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const { client } = makeClient(fetchFn as unknown as typeof fetch, { timeoutMs: 20 });
    expect(await codeOf(client.call('im.recent.list'))).toBe('APP_B24_TIMEOUT');
  });

  it('ответ не JSON при 502 — APP_B24_PORTAL_ERROR', async () => {
    const fetchFn = vi.fn(async () => new Response('<html>Bad Gateway</html>', { status: 502 }));
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.call('im.recent.list'))).toBe('APP_B24_PORTAL_ERROR');
  });

  it('ответ без result — APP_B24_UNEXPECTED_RESPONSE', async () => {
    const fetchFn = vi.fn(async () => json({ something: 1 }));
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.call('im.recent.list'))).toBe('APP_B24_UNEXPECTED_RESPONSE');
  });

  it('держит темп: второй запрос не раньше чем через 500 мс', async () => {
    const fetchFn = vi.fn(async () => json({ result: [] }));
    const { client, sleeps, advance } = makeClient(fetchFn as unknown as typeof fetch);
    await client.call('im.recent.list');
    await client.call('im.recent.list');
    expect(sleeps).toEqual([500]);
    advance(2000);
    await client.call('im.recent.list');
    expect(sleeps).toEqual([500]);
  });
});

describe('B24Client: темп при параллельных вызовах', () => {
  it('четыре одновременных вызова расходятся по 500 мс', async () => {
    const sleeps: number[] = [];
    const fetchFn = vi.fn(async () => json({ result: [] }));
    const client = new B24Client({
      webhook: WEBHOOK,
      fetchFn: fetchFn as unknown as typeof fetch,
      now: () => 0,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    await Promise.all([1, 2, 3, 4].map(() => client.call('im.recent.list')));
    expect(sleeps.sort((a, b) => a - b)).toEqual([500, 1000, 1500]);
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });
});

describe('B24Client.callV3 (REST 3.0)', () => {
  it('ходит по /rest/api/ и отдаёт result', async () => {
    const fetchFn = vi.fn(async () => json({ result: { items: [{ id: 3 }] }, time: {} }));
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await client.callV3('mail.mailbox.list')).toEqual({ items: [{ id: 3 }] });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.bitrix24.ru/rest/api/1/testsecret0000/mail.mailbox.list');
    expect(init.body).toBe('{}');
  });

  it('ошибка вида { error: { code, message, validation } }', async () => {
    const fetchFn = vi.fn(async () =>
      json({ error: { code: 'BITRIX_REST_V3_EXCEPTION_ACCESSDENIEDEXCEPTION', message: 'Access denied' } }, 403),
    );
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.callV3('note.document.get', { id: 7 }))).toBe('APP_B24_ACCESS_DENIED');
  });

  it('метод старой версии через callV3 не уходит', async () => {
    const fetchFn = vi.fn();
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.callV3('im.recent.list'))).toBe('APP_B24_METHOD_NOT_ALLOWED');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('B24Client.download', () => {
  const made: string[] = [];
  const tmp = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b24-dl-'));
    made.push(dir);
    return dir;
  };
  afterEach(() => {
    for (const dir of made.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  const LINK = 'https://example.bitrix24.ru/rest/download.json?auth[auth]=filetoken0000&id=5';

  function streamOf(chunks: Uint8Array[], hang = false): ReadableStream<Uint8Array> {
    return new ReadableStream({
      async pull(controller) {
        const next = chunks.shift();
        if (next) {
          controller.enqueue(next);
        } else if (!hang) {
          controller.close();
        } else {
          await new Promise(() => undefined);
        }
      },
    });
  }

  it('ссылка настоящего портала вида /rest/<номер>/<код>/download/?token=… скачивается, ключ не светится', async () => {
    const dir = tmp();
    const real = 'https://example.bitrix24.ru/rest/1/testsecret0000/download/?token=filetoken0000';
    const fetchFn = vi.fn(async () => new Response(streamOf([new Uint8Array([7, 8])]), { status: 200, headers: { 'Content-Type': 'application/pdf' } }));
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await client.download(real, path.join(dir, 'a.pdf'), 2, 100)).toEqual({ path: path.join(dir, 'a.pdf'), size: 2 });
  });

  it.each([
    ['чужой номер пользователя', 'https://example.bitrix24.ru/rest/2/testsecret0000/download/?token=x'],
    ['чужой код', 'https://example.bitrix24.ru/rest/1/othercode0000/download/?token=x'],
    ['метод вместо download', 'https://example.bitrix24.ru/rest/1/testsecret0000/im.message.add/?token=x'],
  ])('путь скачивания с подменой (%s) — отказ без запроса', async (_name, url) => {
    const fetchFn = vi.fn();
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.download(url, path.join(tmp(), 'x.pdf'), 3, 100))).toBe('APP_B24_DOWNLOAD_FAILED');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('скачивает с четырьмя заголовками и проверяет размер', async () => {
    const dir = tmp();
    const fetchFn = vi.fn(async () => new Response(streamOf([new Uint8Array([1, 2, 3])]), { status: 200, headers: { 'Content-Type': 'application/pdf' } }));
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    const dest = path.join(dir, 'Договор.pdf');
    expect(await client.download(LINK, dest, 3, 100)).toEqual({ path: dest, size: 3 });
    expect(fs.readFileSync(dest)).toEqual(Buffer.from([1, 2, 3]));
    const headers = new Headers((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].headers);
    expect(headers.get('User-Agent')).toBe('bitrix24-workspace-skill/0.1.0');
    expect(headers.get('Accept')).toBe('*/*');
    expect(headers.get('Accept-Language')).toBe('ru-RU,ru;q=0.9');
    expect(headers.get('Referer')).toBe('https://example.bitrix24.ru/');
    expect(fs.readdirSync(dir)).toEqual(['Договор.pdf']);
  });

  it('ссылка не на портал — отказ без запроса', async () => {
    const fetchFn = vi.fn();
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    const dest = path.join(tmp(), 'x.pdf');
    expect(await codeOf(client.download('https://evil.example.com/file?token=x', dest, 3, 100))).toBe('APP_B24_DOWNLOAD_FAILED');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    ['404', () => new Response('nope', { status: 404 })],
    ['HTML вместо PDF', () => new Response('<html>404 Not Found</html>', { status: 200, headers: { 'Content-Type': 'text/html' } })],
    ['меньше байт, чем SIZE', () => new Response(streamOf([new Uint8Array([1])]), { status: 200, headers: { 'Content-Type': 'application/pdf' } })],
  ])('%s — APP_B24_DOWNLOAD_FAILED, временного файла нет', async (_name, make) => {
    const dir = tmp();
    const { client } = makeClient(vi.fn(async () => make()) as unknown as typeof fetch);
    expect(await codeOf(client.download(LINK, path.join(dir, 'Договор.pdf'), 3, 100))).toBe('APP_B24_DOWNLOAD_FAILED');
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('больше лимита по ходу скачивания — отказ, файла нет', async () => {
    const dir = tmp();
    const fetchFn = vi.fn(async () => new Response(streamOf([new Uint8Array(80), new Uint8Array(80)]), { status: 200 }));
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.download(LINK, path.join(dir, 'big.bin'), 50, 100))).toBe('APP_B24_DOWNLOAD_FAILED');
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('нет новых данных дольше таймаута простоя — отказ, файла нет', async () => {
    const dir = tmp();
    const fetchFn = vi.fn(async () => new Response(streamOf([new Uint8Array([1])], true), { status: 200 }));
    const { client } = makeClient(fetchFn as unknown as typeof fetch, { idleTimeoutMs: 30 });
    expect(await codeOf(client.download(LINK, path.join(dir, 'slow.bin'), 3, 100))).toBe('APP_B24_DOWNLOAD_FAILED');
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it.each([
    ['адрес метода вебхука', 'https://example.bitrix24.ru/rest/1/testsecret0000/im.message.add.json?DIALOG_ID=chat1&MESSAGE=x'],
    ['адрес REST 3.0', 'https://example.bitrix24.ru/rest/api/1/testsecret0000/mail.message.send'],
    ['http вместо https', 'http://example.bitrix24.ru/rest/download.json?auth[auth]=filetoken0000'],
    ['другой путь портала', 'https://example.bitrix24.ru/company/personal/user/1/'],
  ])('%s — отказ без запроса', async (_name, url) => {
    const fetchFn = vi.fn();
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.download(url, path.join(tmp(), 'x.pdf'), 3, 100))).toBe('APP_B24_DOWNLOAD_FAILED');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('переадресация на чужой хост — отказ, файла нет', async () => {
    const dir = tmp();
    const fetchFn = vi.fn(async () => {
      const res = new Response(streamOf([new Uint8Array([1, 2, 3])]), { status: 200 });
      Object.defineProperty(res, 'url', { value: 'https://evil.example.com/file' });
      return res;
    });
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.download(LINK, path.join(dir, 'x.pdf'), 3, 100))).toBe('APP_B24_DOWNLOAD_FAILED');
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('существующий файл не перезаписывается', async () => {
    const dir = tmp();
    const dest = path.join(dir, 'Договор.pdf');
    fs.writeFileSync(dest, 'старое');
    const fetchFn = vi.fn(async () => new Response(streamOf([new Uint8Array([1, 2, 3])]), { status: 200 }));
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.download(LINK, dest, 3, 100))).toBe('APP_B24_DOWNLOAD_FAILED');
    expect(fs.readFileSync(dest, 'utf8')).toBe('старое');
    expect(fs.readdirSync(dir)).toEqual(['Договор.pdf']);
  });

  it('байт больше, чем SIZE, — обрыв сразу, файла нет', async () => {
    const dir = tmp();
    const fetchFn = vi.fn(async () => new Response(streamOf([new Uint8Array(5)]), { status: 200 }));
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    expect(await codeOf(client.download(LINK, path.join(dir, 'x.bin'), 3, 100))).toBe('APP_B24_DOWNLOAD_FAILED');
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('медленный, но живой поток дольше таймаута ответа не обрывается', async () => {
    const dir = tmp();
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      let sent = 0;
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          await new Promise((r) => setTimeout(r, 15));
          if (init.signal?.aborted) {
            controller.error(init.signal.reason);
            return;
          }
          if (sent < 5) {
            sent += 1;
            controller.enqueue(new Uint8Array([sent]));
          } else {
            controller.close();
          }
        },
      });
      return new Response(body, { status: 200 });
    });
    const { client } = makeClient(fetchFn as unknown as typeof fetch, { timeoutMs: 20, idleTimeoutMs: 200 });
    expect(await client.download(LINK, path.join(dir, 'slow-ok.bin'), 5, 100)).toEqual({ path: path.join(dir, 'slow-ok.bin'), size: 5 });
  });

  it('текст ошибки не содержит ключ ссылки', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError(`fetch failed ${LINK}`);
    });
    const { client } = makeClient(fetchFn as unknown as typeof fetch);
    const err = await client.download(LINK, path.join(tmp(), 'x.pdf'), 3, 100).then(
      () => undefined,
      (e: unknown) => e as AppError,
    );
    expect(err).toBeInstanceOf(AppError);
    expect(`${err?.userMessage} ${JSON.stringify(err?.details ?? null)}`).not.toContain('filetoken0000');
  });
});
