/**
 * Сообщения чата из ответа Битрикса → читаемый вид для агента.
 *
 * im.dialog.messages.get отдаёт поля в snake_case (author_id), а
 * im.dialog.messages.search — в camelCase (authorId, isSystem); список
 * пользователей — то массивом, то объектом по id. Ссылки на файлы
 * (urlDownload, urlShow, viewerAttrs) не выводим: в них бывают ключи.
 */
import { MAX_TEXT_CHARS } from '../config/config.js';
import { bbToText, isSystemMessage, truncate } from '../render/text.js';
import { asArray, isObject, type Json, num, peopleMap, str } from './common.js';

export interface ChatFile {
  fileId: number;
  name?: string;
  size?: number | null;
  type?: string;
}

export interface ChatMessage {
  id: number;
  date: string;
  author: { id: number; name: string };
  text: string;
  truncated?: true;
  system: boolean;
  files: ChatFile[];
}

export function toMessages(result: Json, tz: string, full: boolean): ChatMessage[] {
  const users = peopleMap(result.users);
  const files = new Map<number, ChatFile>();
  for (const f of asArray(result.files).filter(isObject)) {
    const id = num(f.id);
    if (id !== null) {
      files.set(id, { fileId: id, name: str(f.name), size: num(f.size), type: str(f.type) });
    }
  }
  const out: ChatMessage[] = [];
  for (const m of asArray(result.messages).filter(isObject)) {
    const id = num(m.id);
    if (id === null) {
      continue;
    }
    const authorId = num(m.author_id ?? m.authorId) ?? 0;
    const params = isObject(m.params) ? m.params : {};
    const code = str(params.CODE) || undefined;
    const system = m.isSystem === true || isSystemMessage({ authorId, code });
    const text = bbToText(str(m.text), users, tz);
    const cut = full ? { text, truncated: false } : truncate(text, MAX_TEXT_CHARS);
    const fileIds = asArray(params.FILE_ID ?? m.files).map((f) => num(isObject(f) ? f.id : f)).filter((f): f is number => f !== null);
    out.push({
      id,
      date: str(m.date),
      author: authorId === 0 ? { id: 0, name: 'система' } : { id: authorId, name: users.get(authorId) ?? `сотрудник ${authorId}` },
      text: cut.text,
      ...(cut.truncated ? { truncated: true as const } : {}),
      system,
      files: fileIds.map((fid) => files.get(fid) ?? { fileId: fid }),
    });
  }
  return out;
}
