import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkForUpdate, isNewer } from './update-check.js';

const dirs: string[] = [];
const cachePath = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b24-upd-'));
  dirs.push(dir);
  return path.join(dir, 'update-check.json');
};
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

describe('update-check', () => {
  it('сравнивает версии', () => {
    expect(isNewer('0.2.0', '0.1.0')).toBe(true);
    expect(isNewer('0.1.0', '0.1.0')).toBe(false);
    expect(isNewer('x', '0.1.0')).toBe(false);
  });

  it('сеть недоступна — latestVersion null, без ошибки', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('offline');
    });
    expect(await checkForUpdate({ fetchFn: fetchFn as unknown as typeof fetch, cachePath: cachePath() })).toEqual({
      currentVersion: '0.1.0',
      latestVersion: null,
      updateAvailable: false,
    });
  });

  it('новая версия — updateAvailable, и сутки берётся из кэша', async () => {
    const file = cachePath();
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ version: '0.3.0' })));
    const now = new Date('2026-11-13T10:00:00Z');
    expect((await checkForUpdate({ fetchFn: fetchFn as unknown as typeof fetch, cachePath: file, now })).updateAvailable).toBe(true);
    await checkForUpdate({ fetchFn: fetchFn as unknown as typeof fetch, cachePath: file, now: new Date('2026-11-13T20:00:00Z') });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
