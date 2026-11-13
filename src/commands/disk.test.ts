import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { diskDownload, diskFile, diskLs, diskSearch, diskStorages } from './disk.js';
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
      { ENTITY_TYPE: 'group', '@ENTITY_ID': [15, 20] },
    ]);
    expect(out.data).toEqual([
      { id: 1, name: 'Мой диск', type: 'user', entityId: '1' },
      { id: 2, name: 'Общий диск', type: 'common', entityId: 'shared_files_s1' },
      { id: 3, name: 'Коллаба', type: 'group', entityId: '15' },
    ]);
  });
});

describe('disk ls, search, file', () => {
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
    expect(calls[1]?.body).toMatchObject({ start: 50 });
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

  it('имя с ../ сохраняется внутри папки', async () => {
    const dir = tmp();
    const out = await diskDownload(ctxFor('../../etc/x', 2), '4412', { out: dir });
    expect((out.data as M).path).toBe(path.join(dir, 'x'));
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
