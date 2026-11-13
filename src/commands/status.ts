/**
 * status — первое, что вызывает агент: портал, от чьего имени работает вебхук,
 * какие разделы доступны, лишние права, новая версия скилла.
 */
import { checkForUpdate, type UpdateInfo } from './update-check.js';
import { type CommandContext, envelope, type Json, num, personName } from './common.js';
import type { Envelope } from '../render/output.js';

// Раздел скилла → право вебхука. Для «сотрудников» годится любое из прав user*.
export const SECTION_SCOPES: Readonly<Record<string, string>> = {
  chats: 'im',
  notifications: 'im',
  org: 'im',
  tasks: 'task',
  projects: 'sonet_group',
  disk: 'disk',
  mail: 'mail',
  calendar: 'calendar',
  meetings: 'call',
  feed: 'log',
  kb: 'note',
  worktime: 'timeman',
  users: 'user_basic',
};
const USER_SCOPES = ['user', 'user_basic', 'user_brief'];

export async function status(ctx: CommandContext, check: () => Promise<UpdateInfo> = () => checkForUpdate()): Promise<Envelope> {
  const scopeResp = await ctx.client.call<unknown>('scope');
  const granted = (Array.isArray(scopeResp.result) ? scopeResp.result : []).map(String).sort();
  const me = await ctx.client.call<Json>('user.current');
  const version = await check();

  const sections: Record<string, string> = {};
  for (const [section, scope] of Object.entries(SECTION_SCOPES)) {
    const ok = scope === 'user_basic' ? USER_SCOPES.some((s) => granted.includes(s)) : granted.includes(scope);
    sections[section] = ok ? 'ok' : `нет права ${scope}`;
  }
  const needed = new Set([...Object.values(SECTION_SCOPES), ...USER_SCOPES, 'basic']);
  const extra = granted.filter((s) => !needed.has(s));

  const notes: string[] = [];
  const missing = Object.entries(sections).filter(([, v]) => v !== 'ok');
  if (missing.length > 0) {
    notes.push(`Недоступны разделы: ${missing.map(([k, v]) => `${k} (${v})`).join(', ')}. Добавьте права в настройках вебхука.`);
  }
  if (extra.length > 0) {
    notes.push(`Лишние права у вебхука: ${extra.join(', ')} — скиллу они не нужны, их можно снять в настройках вебхука.`);
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
