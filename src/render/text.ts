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
  'B', 'I', 'U', 'S', 'COLOR', 'SIZE', 'FONT', 'CODE', 'ICON', 'LEFT', 'RIGHT', 'CENTER', 'JUSTIFY',
  'LIST', '\\*', 'TABLE', 'TR', 'TD', 'TH', 'IMG', 'VIDEO', 'SPOILER', 'P', 'HR', 'PCH', 'ATTACH',
  'DISK', 'TIMESTAMP', 'CONTEXT', 'SEND', 'PUT', 'CALL', 'CHAT', 'LIKE', 'DATE', 'BOT',
];
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

const SYSTEM_CODES = new Set(['CHAT_JOIN', 'CHAT_LEAVE', 'CHAT_CREATE', 'CHAT_RENAME', 'CHAT_AVATAR']);

export function bbToText(raw: string, users: ReadonlyMap<number, string> = new Map()): string {
  let text = raw.replace(/\[br\]/gi, '\n');
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
