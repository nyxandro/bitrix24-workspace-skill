/**
 * Проверка новой версии скилла — необязательное удобство в `status`.
 * Читает version из package.json ветки main, кэширует на сутки. Никогда не
 * бросает: при любой ошибке latestVersion = null (необязательное значение).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  APP_VERSION,
  UPDATE_CHECK_CACHE_PATH,
  UPDATE_CHECK_TIMEOUT_MS,
  UPDATE_CHECK_TTL_MS,
  UPDATE_CHECK_URL,
} from '../config/config.js';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
}

function parseVersion(value: string): number[] | null {
  const normalized = value.trim().replace(/^v/i, '');
  return /^\d+(\.\d+)*$/.test(normalized) ? normalized.split('.').map(Number) : null;
}

export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) {
    return false;
  }
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) {
      return x > y;
    }
  }
  return false;
}

interface Cache {
  checkedAt: string;
  latestVersion: string;
}

function readCache(file: string): Cache | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Cache>;
    return typeof parsed.checkedAt === 'string' && typeof parsed.latestVersion === 'string'
      ? { checkedAt: parsed.checkedAt, latestVersion: parsed.latestVersion }
      : null;
  } catch {
    return null;
  }
}

function writeCache(file: string, cache: Cache): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, JSON.stringify(cache), 'utf8');
  } catch {
    // Кэш вспомогательный: не записался — в следующий раз сходим в сеть.
  }
}

async function fetchLatest(fetchFn: typeof fetch): Promise<string | null> {
  try {
    const response = await fetchFn(UPDATE_CHECK_URL, { signal: AbortSignal.timeout(UPDATE_CHECK_TIMEOUT_MS) });
    if (!response.ok) {
      return null;
    }
    const pkg = (await response.json()) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

export async function checkForUpdate(
  deps: { fetchFn?: typeof fetch; now?: Date; cachePath?: string } = {},
): Promise<UpdateInfo> {
  const now = deps.now ?? new Date();
  const file = deps.cachePath ?? UPDATE_CHECK_CACHE_PATH;
  const cache = readCache(file);
  const fresh = cache !== null && now.getTime() - Date.parse(cache.checkedAt) < UPDATE_CHECK_TTL_MS;
  let latest: string | null;
  if (fresh && cache) {
    latest = cache.latestVersion;
  } else {
    latest = await fetchLatest(deps.fetchFn ?? fetch);
    if (latest !== null) {
      writeCache(file, { checkedAt: now.toISOString(), latestVersion: latest });
    } else if (cache) {
      latest = cache.latestVersion;
    }
  }
  return { currentVersion: APP_VERSION, latestVersion: latest, updateAvailable: latest !== null && isNewer(latest, APP_VERSION) };
}
