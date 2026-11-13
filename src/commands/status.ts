/**
 * status — первое, что вызывает агент: портал, от чьего имени работает вебхук,
 * какие разделы доступны, лишние права, новая версия скилла, закрыт ли файл с вебхуком.
 */
import fs from 'node:fs';
import { ENV_PATH, ENV_PATH_DISPLAY } from '../config/config.js';
import type { Envelope } from '../render/output.js';
import { type CommandContext, envelope, isObject, type Json, num, personName, unexpected } from './common.js';
import { checkForUpdate, type UpdateInfo } from './update-check.js';

// Раздел скилла → права вебхука. Для «сотрудников» годится любое из прав user*.
export const SECTION_SCOPES: Readonly<Record<string, readonly string[]>> = {
  chats: ['im'],
  notifications: ['im'],
  org: ['im'],
  tasks: ['task'],
  projects: ['sonet_group', 'socialnetwork'],
  disk: ['disk'],
  mail: ['mail'],
  calendar: ['calendar'],
  meetings: ['call'],
  feed: ['log'],
  kb: ['note'],
  worktime: ['timeman'],
  users: ['user_basic'],
};
// Для раздела «сотрудники» годится любое из прав user*, но user (с приглашением и правкой
// профилей) шире нужного — его помечаем лишним.
const USER_SCOPES = ['user', 'user_basic', 'user_brief'];
const OTHERS_ACCESS_BITS = 0o077;

// Права доступа к файлу с вебхуком; null — файла нет (адрес задан переменной
// окружения) или система без прав в стиле Unix.
export function envFileMode(envPath: string = ENV_PATH): number | null {
  if (process.platform === 'win32') return null;
  try {
    return fs.statSync(envPath).mode;
  } catch {
    return null;
  }
}

export interface StatusDeps {
  check?: () => Promise<UpdateInfo>;
  envFileMode?: () => number | null;
}

export async function status(ctx: CommandContext, deps: StatusDeps = {}): Promise<Envelope> {
  const check = deps.check ?? (() => checkForUpdate());
  const readMode = deps.envFileMode ?? (() => envFileMode());
  const scopeResp = await ctx.client.call<unknown>('scope');
  // Без списка прав нельзя честно сказать, что доступно: пустой список выглядел бы как «нет ни одного права».
  if (!Array.isArray(scopeResp.result)) throw unexpected('scope.result');
  const granted = scopeResp.result.map(String).sort();
  const me = await ctx.client.call<Json>('user.current');
  if (!isObject(me.result)) throw unexpected('user.current.result');
  const version = await check();

  const sections: Record<string, string> = {};
  for (const [section, scopes] of Object.entries(SECTION_SCOPES)) {
    const lacking = scopes.filter((scope) =>
      scope === 'user_basic' ? !USER_SCOPES.some((s) => granted.includes(s)) : !granted.includes(scope),
    );
    sections[section] = lacking.length === 0 ? 'ok' : `нет права ${lacking.join(', ')}`;
  }
  const needed = new Set([...Object.values(SECTION_SCOPES).flat(), 'user_brief', 'basic']);
  const extra = granted.filter((s) => !needed.has(s));

  const notes: string[] = [];
  const missing = Object.entries(sections).filter(([, v]) => v !== 'ok');
  if (missing.length > 0) {
    notes.push(`Недоступны разделы: ${missing.map(([k, v]) => `${k} (${v})`).join(', ')}. Добавьте права в настройках вебхука.`);
  }
  if (extra.length > 0) {
    notes.push(`Лишние права у вебхука: ${extra.join(', ')} — скиллу они не нужны, их можно снять в настройках вебхука.`);
  }
  const mode = readMode();
  if (mode !== null && (mode & OTHERS_ACCESS_BITS) !== 0) {
    notes.push(`Файл с адресом вебхука ${ENV_PATH_DISPLAY} доступен другим пользователям этой машины. Закройте его: chmod 600 ${ENV_PATH_DISPLAY}.`);
  }
  if (version.updateAvailable) {
    notes.push(`Вышла новая версия скилла ${version.latestVersion} (сейчас ${version.currentVersion}). Обновить: повторить установку.`);
  }
  return envelope(
    {
      portal: new URL(ctx.webhook.origin).host,
      webhookUserId: ctx.webhook.userId,
      user: { id: num(me.result.ID) ?? ctx.webhook.userId, name: personName(me.result) },
      sections,
      scopes: { granted, extra },
      version,
    },
    null,
    notes,
  );
}
