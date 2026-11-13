/**
 * kb list|search|tree|doc — база знаний (REST 3.0). Документы приходят в Markdown.
 */
import { AppError } from '../api/errors.js';
import { MAX_TEXT_CHARS } from '../config/config.js';
import type { Envelope } from '../render/output.js';
import { bbToText, truncate } from '../render/text.js';
import { asArray, type CommandContext, decodeCursor, encodeCursor, envelope, isObject, type Json, notFound, num, parseId, parseLimit, str } from './common.js';

// note.collection.list требует тот же limit на всех страницах — курсор хранит его.
const isListCursor = (v: unknown): v is { c: Json; l: number } => isObject(v) && isObject(v.c) && Number.isSafeInteger(v.l) && (v.l as number) >= 1;

export async function kbList(ctx: CommandContext, opts: { limit?: string; page?: string }): Promise<Envelope> {
  const cursor = opts.page ? decodeCursor(opts.page, '--page', isListCursor) : null;
  const limit = cursor ? cursor.l : parseLimit(opts.limit, 20, 50);
  const pagination: Json = { limit };
  if (cursor) pagination.afterCursor = cursor.c;
  const resp = await ctx.client.callV3<Json>('note.collection.list', { pagination });
  const data = asArray(resp.items)
    .filter(isObject)
    .map((c) => ({ id: num(c.id), name: str(c.name), updatedAt: str(c.updatedAt) || null, archived: c.isArchived === true }));
  const next = isObject(resp.nextCursor) ? encodeCursor({ c: resp.nextCursor, l: limit }) : null;
  return envelope(data, next, data.length === 0 ? ['Баз знаний нет.'] : next ? ['Есть ещё: --page <next>.'] : []);
}

export async function kbSearch(ctx: CommandContext, text: string, opts: { limit?: string }): Promise<Envelope> {
  if (text.trim().length < 3) {
    throw new AppError({ code: 'APP_CLI_INVALID_ARGUMENT', userMessage: 'Параметр текст: нужно не меньше 3 символов.' });
  }
  const limit = parseLimit(opts.limit, 20, 50);
  const resp = await ctx.client.callV3<Json>('note.document.search.list', { query: text.trim(), pagination: { limit } });
  const data = asArray(resp.items)
    .filter(isObject)
    .map((d) => ({ id: num(d.documentId), collectionId: num(d.collectionId), title: str(d.title), snippet: bbToText(str(d.snippet), new Map(), ctx.tz) }));
  const notes = data.length === 0 ? ['Ничего не найдено.'] : [];
  // У поиска нет курсора следующей страницы (note-document-search-list.md).
  if (resp.hasMore === true) notes.push('Есть ещё совпадения — уточните запрос или увеличьте --limit.');
  return envelope(data, null, notes);
}

function flatten(items: unknown[], level: number, out: { id: number | null; title: string; level: number }[]): void {
  for (const item of items.filter(isObject)) {
    out.push({ id: num(item.id), title: str(item.title), level });
    flatten(asArray(item.children), level + 1, out);
  }
}

export async function kbTree(ctx: CommandContext, collectionRaw: string): Promise<Envelope> {
  const resp = await ctx.client.callV3<Json>('note.document.tree.list', { collectionId: parseId(collectionRaw, 'collectionId') });
  const out: { id: number | null; title: string; level: number }[] = [];
  flatten(asArray(resp.items), 0, out);
  return envelope(out, null, resp.truncated === true ? ['Оглавление обрезано Битриксом — откройте нужный раздел документа.'] : []);
}

export async function kbDoc(ctx: CommandContext, idRaw: string, opts: { full?: boolean }): Promise<Envelope> {
  const resp = await ctx.client.callV3<Json>('note.document.get', { id: parseId(idRaw, 'id') });
  const d = isObject(resp.item) ? resp.item : null;
  if (!d || num(d.id) === null) throw notFound();
  const markdown = str(d.markdown);
  const cut = opts.full ? { text: markdown, truncated: false } : truncate(markdown, MAX_TEXT_CHARS);
  return envelope(
    {
      id: num(d.id),
      collectionId: num(d.collectionId),
      title: str(d.title),
      updatedAt: str(d.contentUpdatedAt) || str(d.updatedAt) || null,
      archived: d.isArchived === true,
      trashed: d.isTrashed === true,
      text: cut.text,
      ...(cut.truncated ? { truncated: true } : {}),
    },
    null,
    cut.truncated ? [`Документ обрезан на ${MAX_TEXT_CHARS} знаков, полностью — --full.`] : [],
  );
}
