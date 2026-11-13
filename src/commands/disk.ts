/**
 * disk storages|ls|search|file|download — файлы на Диске.
 *
 * Ссылки DOWNLOAD_URL / DETAIL_URL никогда не выводятся: в ссылке на
 * скачивание живого портала есть код вебхука и бессрочный ключ. Файл скачивает
 * сам скилл (B24Client.download) и сообщает только путь.
 */
import fs from 'node:fs';
import path from 'node:path';
import { AppError } from '../api/errors.js';
import { parsePositiveInt } from '../cli/runtime.js';
import type { Envelope } from '../render/output.js';
import {
  asArray,
  type CommandContext,
  decodeCursor,
  encodeCursor,
  envelope,
  isObject,
  type Json,
  notFound,
  num,
  parseId,
  parseLimit,
  str,
} from './common.js';

const DEFAULT_MAX_MB = 100;
const MAX_MB = 1024;
const MAX_NAME_SUFFIX = 1000;
const MAX_GROUP_STORAGE_IDS = 50;

const isStartCursor = (v: unknown): v is { s: number } => isObject(v) && typeof v.s === 'number' && Number.isSafeInteger(v.s) && v.s >= 0;

function invalid(code: string, message: string): AppError {
  return new AppError({ code, userMessage: message });
}

function storageOf(s: Json) {
  return { id: num(s.ID), name: str(s.NAME), type: str(s.ENTITY_TYPE), entityId: str(s.ENTITY_ID) };
}

function entryOf(e: Json) {
  return {
    id: num(e.ID),
    name: str(e.NAME),
    type: str(e.TYPE),
    ...(str(e.TYPE) === 'file' ? { size: num(e.SIZE) } : {}),
    updatedAt: str(e.UPDATE_TIME) || null,
    updatedBy: num(e.UPDATED_BY),
  };
}

export async function diskStorages(ctx: CommandContext, opts: { all?: boolean; page?: string }): Promise<Envelope> {
  if (opts.all) {
    const start = opts.page ? decodeCursor(opts.page, '--page', isStartCursor).s : 0;
    const resp = await ctx.client.call<unknown>('disk.storage.getlist', { filter: {}, start });
    const next = typeof resp.next === 'number' ? encodeCursor({ s: resp.next }) : null;
    return envelope(asArray(resp.result).filter(isObject).map(storageOf), next, next ? ['Есть ещё хранилища: --page <next>.'] : []);
  }
  const groups = await ctx.client.call<unknown>('sonet_group.user.groups');
  const allGroupIds = asArray(groups.result)
    .filter(isObject)
    .map((g) => num(g.GROUP_ID))
    .filter((id): id is number => id !== null);
  const groupIds = allGroupIds.slice(0, MAX_GROUP_STORAGE_IDS);
  const own = await ctx.client.call<unknown>('disk.storage.getlist', { filter: { ENTITY_TYPE: 'user', ENTITY_ID: ctx.webhook.userId } });
  const common = await ctx.client.call<unknown>('disk.storage.getlist', { filter: { ENTITY_TYPE: 'common' } });
  const result = [...asArray(own.result), ...asArray(common.result)];
  if (groupIds.length > 0) {
    const group = await ctx.client.call<unknown>('disk.storage.getlist', { filter: { ENTITY_TYPE: 'group', '@ENTITY_ID': groupIds } });
    result.push(...asArray(group.result));
  }
  const notes = ['Все хранилища, которые вам видны, — disk storages --all.'];
  if (allGroupIds.length > groupIds.length) {
    notes.unshift(`Диски групп показаны только для первых ${groupIds.length} из ${allGroupIds.length} ваших групп; остальные — disk storages --all.`);
  }
  return envelope(result.filter(isObject).map(storageOf), null, notes);
}

export async function diskLs(ctx: CommandContext, target: string, opts: { page?: string }): Promise<Envelope> {
  const match = /^(storage|folder):(\d+)$/.exec(target.trim());
  if (!match) {
    throw invalid('APP_CLI_INVALID_ARGUMENT', `Параметр папка: ожидается storage:<номер> или folder:<номер>, получено «${target}».`);
  }
  const start = opts.page ? decodeCursor(opts.page, '--page', isStartCursor).s : 0;
  const method = match[1] === 'storage' ? 'disk.storage.getchildren' : 'disk.folder.getchildren';
  const resp = await ctx.client.call<unknown>(method, { id: Number(match[2]), start });
  const data = asArray(resp.result).filter(isObject).map(entryOf);
  const next = typeof resp.next === 'number' ? encodeCursor({ s: resp.next }) : null;
  const notes = data.length === 0 ? ['Папка пуста.'] : next ? ['Есть ещё: --page <next>.'] : [];
  return envelope(data, next, notes);
}

export async function diskSearch(
  ctx: CommandContext,
  text: string,
  opts: { storage?: string; folder?: string; limit?: string; page?: string },
): Promise<Envelope> {
  const query = text.trim().replace(/\s+/g, ' ');
  if (query.length < 3) {
    throw invalid('APP_CLI_INVALID_ARGUMENT', 'Параметр текст: нужно не меньше 3 символов.');
  }
  const limit = parseLimit(opts.limit, 20, 50);
  const filter: Json = {};
  if (opts.storage) filter.STORAGE_ID = parseId(opts.storage, '--storage');
  if (opts.folder) filter.FOLDER_ID = parseId(opts.folder, '--folder');
  const start = opts.page ? decodeCursor(opts.page, '--page', isStartCursor).s : 0;
  const params: Json = { QUERY: query, TYPE: 'file', start };
  if (Object.keys(filter).length > 0) params.FILTER = filter;
  const resp = await ctx.client.call<unknown>('disk.file.search', params);
  const found = asArray(resp.result).filter(isObject);
  const data = found.slice(0, limit).map((f) => ({ ...entryOf(f), storageId: num(f.STORAGE_ID), folderId: num(f.PARENT_ID) }));
  // start у поиска — число пропущенных объектов (disk-file-search.md): продолжаем
  // ровно с того, что не показали, иначе при --limit меньше 50 файлы пропадут.
  const more = found.length > data.length || typeof resp.next === 'number';
  const next = more && data.length > 0 ? encodeCursor({ s: start + data.length }) : null;
  const notes = data.length === 0 ? ['Ничего не найдено. Поиск не охватывает файлы чатов.'] : next ? ['Есть ещё: --page <next>.'] : [];
  return envelope(data, next, notes);
}

function fileInfo(f: Json) {
  return {
    id: num(f.ID),
    name: str(f.NAME),
    size: num(f.SIZE),
    storageId: num(f.STORAGE_ID),
    folderId: num(f.PARENT_ID),
    createdAt: str(f.CREATE_TIME) || null,
    updatedAt: str(f.UPDATE_TIME) || null,
    createdBy: num(f.CREATED_BY),
    updatedBy: num(f.UPDATED_BY),
  };
}

export async function diskFile(ctx: CommandContext, idRaw: string): Promise<Envelope> {
  const resp = await ctx.client.call<Json>('disk.file.get', { id: parseId(idRaw, 'id') });
  const f = isObject(resp.result) ? resp.result : null;
  if (!f || num(f.ID) === null) throw notFound();
  return envelope(fileInfo(f));
}

// Предел имени в байтах: файловые системы держат 255 байт, а к имени ещё добавятся
// « (N)» и временный хвост «.part-…» — кириллица занимает по 2 байта на букву.
const MAX_NAME_BYTES = 180;
const MAX_EXT_BYTES = 20;

function fitBytes(text: string, maxBytes: number): string {
  let out = '';
  for (const ch of text) {
    if (Buffer.byteLength(out + ch) > maxBytes) break;
    out += ch;
  }
  return out;
}

// Имя файла из портала → безопасное имя внутри папки: без путей и служебных символов,
// не длиннее MAX_NAME_BYTES с сохранённым расширением.
export function safeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex -- управляющие символы в имени файла убираем намеренно
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, '_').trim();
  if (cleaned === '' || cleaned === '.' || cleaned === '..') return 'file';
  if (Buffer.byteLength(cleaned) <= MAX_NAME_BYTES) return cleaned;
  const ext = path.extname(cleaned);
  const keepExt = Buffer.byteLength(ext) <= MAX_EXT_BYTES ? ext : '';
  const stem = keepExt ? cleaned.slice(0, -keepExt.length) : cleaned;
  return `${fitBytes(stem, MAX_NAME_BYTES - Buffer.byteLength(keepExt)).trimEnd()}${keepExt}`;
}

function uniquePath(dir: string, name: string): string {
  const ext = path.extname(name);
  const stem = ext ? name.slice(0, -ext.length) : name;
  for (let i = 0; i <= MAX_NAME_SUFFIX; i++) {
    const candidate = path.join(dir, i === 0 ? name : `${stem} (${i})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  throw invalid('APP_B24_OUTPUT_DIR_INVALID', `В папке слишком много файлов с именем «${name}».`);
}

export async function diskDownload(ctx: CommandContext, idRaw: string, opts: { out?: string; maxMb?: string }): Promise<Envelope> {
  if (!opts.out?.trim()) {
    throw invalid('APP_B24_OUTPUT_DIR_REQUIRED', 'Укажите папку для сохранения: --out <папка>.');
  }
  const dir = path.resolve(opts.out.trim());
  try {
    if (!fs.statSync(dir).isDirectory()) throw new Error('not a directory');
    fs.accessSync(dir, fs.constants.W_OK);
  } catch (err) {
    throw new AppError({
      code: 'APP_B24_OUTPUT_DIR_INVALID',
      userMessage: `Папка для сохранения не существует или недоступна для записи: ${dir}.`,
      cause: err,
    });
  }
  const maxMb = opts.maxMb ? parsePositiveInt(opts.maxMb, '--max-mb', MAX_MB) : DEFAULT_MAX_MB;
  const resp = await ctx.client.call<Json>('disk.file.get', { id: parseId(idRaw, 'id') });
  const f = isObject(resp.result) ? resp.result : null;
  if (!f || num(f.ID) === null) throw notFound();
  const size = num(f.SIZE);
  const url = str(f.DOWNLOAD_URL);
  if (size === null || url === '') {
    throw new AppError({
      code: 'APP_B24_UNEXPECTED_RESPONSE',
      userMessage: 'Битрикс24 вернул данные в неожиданном виде — команда не может их разобрать.',
      details: { field: 'disk.file.get.SIZE/DOWNLOAD_URL' },
    });
  }
  const name = safeFileName(str(f.NAME));
  if (size > maxMb * 1024 * 1024) {
    throw new AppError({
      code: 'APP_B24_FILE_TOO_LARGE',
      userMessage: `Файл «${name}» весит ${Math.ceil(size / 1024 / 1024)} МБ — больше лимита ${maxMb} МБ. Чтобы скачать, добавьте --max-mb <число>.`,
    });
  }
  const saved = await ctx.client.download(url, uniquePath(dir, name), size, maxMb * 1024 * 1024);
  return envelope({ path: saved.path, name: path.basename(saved.path), size: saved.size });
}
