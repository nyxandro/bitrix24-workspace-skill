import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { diskDownload, diskFile, diskLs, diskSearch, diskStorages, safeFileName } from './disk.js';
import { fakeContext } from './testkit.js';

type M = Record<string, unknown>;
const dirs: string[] = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'b24-disk-'));
  dirs.push(d);
  return d;
};
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

const LINK = 'https://example.bitrix24.ru/rest/1/testsecret0000/download/?token=filetoken0000';
const fileInfo = (name: string, size: number) => ({ ID: '4412', NAME: name, SIZE: String(size), TYPE: 'file', STORAGE_ID: '3', PARENT_ID: '9', CREATE_TIME: '2026-11-01T10:00:00+03:00', UPDATE_TIME: '2026-11-02T10:00:00+03:00', CREATED_BY: '1', UPDATED_BY: '1', DOWNLOAD_URL: LINK, DETAIL_URL: 'https://example.bitrix24.ru/x' });

describe('disk storages', () => {
  it('по умолчанию — мой диск, общий и диски моих групп', async () => {
    const { ctx, calls } = fakeContext({
      'sonet_group.user.groups': () => ({ json: { result: [{ GROUP_ID: '15' }, { GROUP_ID: '20' }] } }),
      'disk.storage.getlist': [
        () => ({ json: { result: [{ ID: '1', NAME: 'Мой диск', ENTITY_TYPE: 'user', ENTITY_ID: '1' }] } }),
        () => ({ json: { result: [{ ID: '2', NAME: 'Общий диск', ENTITY_TYPE: 'common', ENTITY_ID: 'shared_files_s1' }] } }),
        () => ({ json: { result: [{ ID: '3', NAME: 'Коллаба', ENTITY_TYPE: 'group', ENTITY_ID: '15' }] } }),
      ],
    });
    const out = await diskStorages(ctx, {});
    expect(calls.filter((c) => c.method === 'disk.storage.getlist').map((c) => c.body.filter)).toEqual([
      { ENTITY_TYPE: 'user', ENTITY_ID: 1 },
      { ENTITY_TYPE: 'common' },
      // Список номеров — только в поле ENTITY_ID без приставки: «@ENTITY_ID» Битрикс молча
      // отбрасывает и отдаёт диски чужих групп (проверено на живом портале).
      { ENTITY_TYPE: 'group', ENTITY_ID: [15, 20] },
    ]);
    expect(out.data).toEqual([
      { id: 1, name: 'Мой диск', type: 'user', entityId: '1' },
      { id: 2, name: 'Общий диск', type: 'common', entityId: 'shared_files_s1' },
      { id: 3, name: 'Коллаба', type: 'group', entityId: '15' },
    ]);
  });
});

describe('disk ls, search, file', () => {
  it('групп больше 50 — диски запрашиваются порциями по 50, ни одна группа не теряется', async () => {
    const { ctx, calls } = fakeContext({
      'sonet_group.user.groups': () => ({ json: { result: Array.from({ length: 60 }, (_, i) => ({ GROUP_ID: String(i + 1) })) } }),
      'disk.storage.getlist': (b) => {
        const f = b.filter as M;
        const ids = f.ENTITY_TYPE === 'group' ? (f.ENTITY_ID as number[]) : [];
        return { json: { result: ids.map((id) => ({ ID: String(1000 + id), NAME: `Диск ${id}`, ENTITY_TYPE: 'group', ENTITY_ID: String(id) })) } };
      },
    });
    const out = await diskStorages(ctx, {});
    const groupCalls = calls.filter((c) => c.method === 'disk.storage.getlist').slice(2);
    expect(groupCalls.map((c) => ((c.body.filter as M).ENTITY_ID as number[]).length)).toEqual([50, 10]);
    expect((out.data as M[]).filter((s) => s.type === 'group')).toHaveLength(60);
    expect(out.notes.join(' ')).not.toContain('первых');
  });

  it('Битрикс не применил отбор и вернул диск чужой группы — ошибка, а не чужие диски под видом своих', async () => {
    const { ctx } = fakeContext({
      'sonet_group.user.groups': () => ({ json: { result: [{ GROUP_ID: '15' }] } }),
      'disk.storage.getlist': [
        () => ({ json: { result: [] } }),
        () => ({ json: { result: [] } }),
        () => ({ json: { result: [{ ID: '3', NAME: 'Моя', ENTITY_TYPE: 'group', ENTITY_ID: '15' }, { ID: '4', NAME: 'Чужая', ENTITY_TYPE: 'group', ENTITY_ID: '99' }] } }),
      ],
    });
    await expect(diskStorages(ctx, {})).rejects.toMatchObject({ code: 'APP_B24_UNEXPECTED_RESPONSE' });
  });

  it('ls storage:N / folder:N, без ссылок', async () => {
    const { ctx, calls } = fakeContext({
      'disk.storage.getchildren': () => ({ json: { result: [{ ...fileInfo('a.pdf', 10) }, { ID: '9', NAME: 'Папка', TYPE: 'folder', UPDATE_TIME: 'x', UPDATED_BY: '1' }], next: 50 } }),
      'disk.folder.getchildren': () => ({ json: { result: [] } }),
    });
    const out = await diskLs(ctx, 'storage:3', {});
    expect(calls[0]?.body).toEqual({ id: 3, start: 0 });
    expect((out.data as M[])[0]).toEqual({ id: 4412, name: 'a.pdf', type: 'file', size: 10, updatedAt: '2026-11-02T10:00:00+03:00', updatedBy: 1 });
    expect(JSON.stringify(out)).not.toMatch(/DOWNLOAD_URL|DETAIL_URL|token/);
    expect(out.next).not.toBeNull();
    await diskLs(ctx, 'folder:9', {});
    expect(calls[1]?.method).toBe('disk.folder.getchildren');
    await expect(diskLs(ctx, '9', {})).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
  });

  it('search — от 3 символов, --page → start, без ссылок', async () => {
    const { ctx, calls } = fakeContext({ 'disk.file.search': () => ({ json: { result: [fileInfo('Договор.pdf', 100)], next: 50 } }) });
    await expect(diskSearch(ctx, 'до', {})).rejects.toMatchObject({ code: 'APP_CLI_INVALID_ARGUMENT' });
    const out = await diskSearch(ctx, 'договор', { storage: '3' });
    expect(calls[0]?.body).toEqual({ QUERY: 'договор', TYPE: 'file', FILTER: { STORAGE_ID: 3 }, start: 0 });
    expect(JSON.stringify(out)).not.toMatch(/DOWNLOAD_URL|token/);
    await diskSearch(ctx, 'договор', { page: String(out.next) });
    expect(calls[1]?.body).toMatchObject({ start: 1 });
  });

  it('search --limit 20 — следующая страница начинается с 21-го, а не с 51-го', async () => {
    const files = (start: number) => Array.from({ length: 50 }, (_, i) => fileInfo(`f${start + i + 1}.pdf`, 1));
    const { ctx, calls } = fakeContext({ 'disk.file.search': (b) => ({ json: { result: files(Number(b.start)), next: Number(b.start) + 50 } }) });
    const first = await diskSearch(ctx, 'договор', { limit: '20' });
    expect((first.data as M[]).map((f) => f.name)[19]).toBe('f20.pdf');
    const second = await diskSearch(ctx, 'договор', { limit: '20', page: String(first.next) });
    expect(calls[1]?.body.start).toBe(20);
    expect((second.data as M[])[0]?.name).toBe('f21.pdf');
  });

  it('file — Битрикс вернул пустоту вместо файла: APP_B24_NOT_FOUND', async () => {
    for (const result of [null, [], {}]) {
      const { ctx } = fakeContext({ 'disk.file.get': () => ({ json: { result } }) });
      await expect(diskFile(ctx, '4412')).rejects.toMatchObject({ code: 'APP_B24_NOT_FOUND' });
    }
  });

  it('file — сведения без ссылок', async () => {
    const { ctx } = fakeContext({ 'disk.file.get': () => ({ json: { result: fileInfo('a.pdf', 10) } }) });
    const out = await diskFile(ctx, '4412');
    expect(out.data).toEqual({ id: 4412, name: 'a.pdf', size: 10, storageId: 3, folderId: 9, createdAt: '2026-11-01T10:00:00+03:00', updatedAt: '2026-11-02T10:00:00+03:00', createdBy: 1, updatedBy: 1 });
  });
});

describe('disk download', () => {
  const ctxFor = (name: string, size: number, bytes = new Uint8Array(size)) =>
    fakeContext({
      'disk.file.get': () => ({ json: { result: fileInfo(name, size) } }),
      download: () => ({ raw: bytes, headers: { 'Content-Type': 'application/pdf' } }),
    }).ctx;

  it('скачивает в --out, повтор — «(1)», путь и размер без ссылки', async () => {
    const dir = tmp();
    const out = await diskDownload(ctxFor('Договор.pdf', 3), '4412', { out: dir });
    expect(out.data).toEqual({ path: path.join(dir, 'Договор.pdf'), name: 'Договор.pdf', size: 3 });
    const again = await diskDownload(ctxFor('Договор.pdf', 3), '4412', { out: dir });
    expect((again.data as M).path).toBe(path.join(dir, 'Договор (1).pdf'));
    expect(JSON.stringify(out)).not.toMatch(/token|testsecret0000/);
  });

  it('очень длинное русское имя обрезается до допустимого, расширение сохраняется', () => {
    const name = safeFileName(`${'Договор поставки оборудования '.repeat(10)}.pdf`);
    expect(Buffer.byteLength(name)).toBeLessThanOrEqual(180);
    expect(name.endsWith('.pdf')).toBe(true);
  });

  it('имя с ../ сохраняется внутри папки', async () => {
    const dir = tmp();
    const out = await diskDownload(ctxFor('../../etc/x', 2), '4412', { out: dir });
    expect((out.data as M).path).toBe(path.join(dir, 'x'));
  });

  it('Битрикс вернул пустоту вместо файла — APP_B24_NOT_FOUND, ничего не скачано', async () => {
    const dir = tmp();
    const { ctx } = fakeContext({ 'disk.file.get': () => ({ json: { result: null } }) });
    await expect(diskDownload(ctx, '4412', { out: dir })).rejects.toMatchObject({ code: 'APP_B24_NOT_FOUND' });
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('больше лимита — APP_B24_FILE_TOO_LARGE; без --out и с плохой папкой — свои коды', async () => {
    await expect(diskDownload(ctxFor('big.zip', 150 * 1024 * 1024, new Uint8Array(1)), '4412', { out: tmp() })).rejects.toMatchObject({
      code: 'APP_B24_FILE_TOO_LARGE',
    });
    await expect(diskDownload(ctxFor('a.pdf', 1), '4412', {})).rejects.toMatchObject({ code: 'APP_B24_OUTPUT_DIR_REQUIRED' });
    const file = path.join(tmp(), 'not-a-dir');
    fs.writeFileSync(file, 'x');
    await expect(diskDownload(ctxFor('a.pdf', 1), '4412', { out: file })).rejects.toMatchObject({ code: 'APP_B24_OUTPUT_DIR_INVALID' });
  });
});
