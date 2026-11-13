/**
 * testkit — общие заглушки для тестов команд (в сборку CLI не попадает): клиент с подменённым fetch, который отвечает
 * по имени метода. Только для *.test.ts.
 */
import { vi } from 'vitest';
import { B24Client } from '../api/client.js';
import type { Webhook } from '../config/webhook.js';
import type { CommandContext } from './common.js';

export const TEST_WEBHOOK: Webhook = { origin: 'https://example.bitrix24.ru', userId: 1, code: 'testsecret0000' };

type Handler = (body: Record<string, unknown>) => { status?: number; json: unknown };

export function fakeContext(handlers: Record<string, Handler | Handler[]>): { ctx: CommandContext; calls: { method: string; body: Record<string, unknown> }[] } {
  const calls: { method: string; body: Record<string, unknown> }[] = [];
  const queues = new Map(Object.entries(handlers).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]));
  const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
    const method = url.replace(/^.*\/rest\/(?:api\/)?\d+\/[^/]+\//, '').replace(/\.json$/, '');
    const body = JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>;
    calls.push({ method, body });
    const entry = queues.get(method);
    const handler = Array.isArray(entry) ? entry.shift() : entry;
    if (!handler) {
      throw new Error(`нет заглушки для ${method}`);
    }
    const { status = 200, json } = handler(body);
    return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  });
  const client = new B24Client({ webhook: TEST_WEBHOOK, fetchFn: fetchFn as unknown as typeof fetch, now: () => 0, sleep: async () => undefined });
  return { ctx: { client, webhook: TEST_WEBHOOK, tz: 'Europe/Moscow' }, calls };
}
