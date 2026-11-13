/**
 * Текст сообщений Битрикс24 → читаемый текст для агента.
 *
 * - bbToText(raw, users) — разметка BB-кодов: упоминания → «@имя», ссылки →
 *   «текст (адрес)», цитаты → строки с «> », оформление убирается, частые
 *   HTML-сущности раскодируются. Квадратные скобки в обычном тексте не трогаем:
 *   вырезаются только известные теги Битрикса.
 * - isSystemMessage(msg) — служебные события (вход/выход, автор 0).
 * - truncate(text, max) — обрезка по символам без разрезания эмодзи.
 */

const KNOWN_TAGS = [
  'B', 'I', 'U', 'S', 'COLOR', 'SIZE', 'FONT', 'ICON', 'LEFT', 'RIGHT', 'CENTER', 'JUSTIFY',
  'IMG', 'VIDEO', 'SPOILER', 'P', 'HR', 'PCH', 'ATTACH', 'DISK', 'CONTEXT', 'SEND', 'PUT', 'CALL',
  'CHAT', 'LIKE', 'DATE', 'BOT',
];
import { formatInZone, machineTimeZone } from './dates.js';

const KNOWN_TAG_RE = new RegExp(`\\[\\/?(?:${KNOWN_TAGS.join('|')})(?:=[^\\]]*)?(?:\\s[^\\]]*)?\\]`, 'gi');

const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#039;': "'",
  '&nbsp;': ' ',
};

const CODE_BLOCK_RE = /\[CODE\]([\s\S]*?)\[\/CODE\]/gi;

const SYSTEM_CODES = new Set(['CHAT_JOIN', 'CHAT_LEAVE', 'CHAT_CREATE', 'CHAT_RENAME', 'CHAT_AVATAR']);

// Списки и таблицы: пункты — с новой строки через «- », ячейки — через « | ».
function flattenListsAndTables(text: string): string {
  return text
    .replace(/\[LIST(?:=[^\]]*)?\]\s*/gi, '')
    .replace(/\s*\[\/LIST\]/gi, '')
    .replace(/\s*\[\*\]\s*/g, '\n- ')
    .replace(/\[\/T[DH]\]\s*\[T[DH](?:=[^\]]*)?\]/gi, ' | ')
    .replace(/\[\/?T[DH](?:=[^\]]*)?\]/gi, '')
    .replace(/\s*\[\/TR\]\s*\[TR\]\s*/gi, '\n')
    .replace(/\[\/?(?:TR|TABLE)\]/gi, '')
    .replace(/^\n+/, '');
}

export function bbToText(
  raw: string,
  users: ReadonlyMap<number, string> = new Map(),
  tz: string = machineTimeZone(),
): string {
  // Содержимое [CODE] не разбирается вовсе — прячем его до конца обработки.
  const codeBlocks: string[] = [];
  let text = raw.replace(CODE_BLOCK_RE, (_m, body: string) => {
    codeBlocks.push(body);
    return `\uE000${codeBlocks.length - 1}\uE000`;
  });
  text = text.replace(/\[br\]/gi, '\n');
  text = text.replace(/\[TIMESTAMP=(\d+)(?:\s[^\]]*)?\]/gi, (_m, ts: string) => formatInZone(Number(ts) * 1000, tz));
  text = flattenListsAndTables(text);
  text = text.replace(/\[USER=(\d+)(?:\s+REPLACE)?\]([\s\S]*?)\[\/USER\]/gi, (_m, id: string, name: string) => {
    const shown = name.trim() !== '' ? name.trim() : users.get(Number(id)) ?? `сотрудник ${id}`;
    return `@${shown}`;
  });
  text = text.replace(/\[URL=([^\]]+)\]([\s\S]*?)\[\/URL\]/gi, (_m, href: string, label: string) => {
    const l = label.trim();
    return l === '' || l === href ? href : `${l} (${href})`;
  });
  text = text.replace(/\[URL\]([\s\S]*?)\[\/URL\]/gi, (_m, href: string) => href.trim());
  text = text.replace(/\[QUOTE\]([\s\S]*?)\[\/QUOTE\]\n?/gi, (_m, body: string) =>
    body
      .trim()
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')
      .concat('\n'),
  );
  text = text.replace(KNOWN_TAG_RE, '');
  // Остатки известных парных тегов, которые не сошлись (незакрытые упоминания и ссылки).
  text = text.replace(/\[\/?(?:USER|URL|QUOTE)(?:=[^\]]*)?(?:\s[^\]]*)?\]/gi, '');
  text = text.replace(/&(?:amp|lt|gt|quot|nbsp|#0?39);/g, (entity) => ENTITIES[entity] ?? entity);
  text = text.replace(/\uE000(\d+)\uE000/g, (match, i: string) => codeBlocks[Number(i)] ?? match);
  return text.replace(/\n$/, '');
}

export function isSystemMessage(msg: { authorId: number; code?: string }): boolean {
  return msg.authorId === 0 || (msg.code !== undefined && SYSTEM_CODES.has(msg.code));
}

export function truncate(text: string, max: number): { text: string; truncated: boolean } {
  const chars = Array.from(text);
  if (chars.length <= max) {
    return { text, truncated: false };
  }
  return { text: chars.slice(0, max).join(''), truncated: true };
}
