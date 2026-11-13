import { describe, expect, it } from 'vitest';
import { ALLOWED_V1, ALLOWED_V3, isForbiddenName, isReadOnlyShape, scopeForMethod, splitMethodWords } from './allowlist.js';

describe('список разрешённых методов', () => {
  it('ни один разрешённый метод не похож на запись', () => {
    const offenders = [...ALLOWED_V1, ...ALLOWED_V3].filter((m) => isForbiddenName(m));
    expect(offenders).toEqual([]);
  });

  it.each([
    'disk.file.getExternalLink',
    'im.dialog.read',
    'im.notify.read.list',
    'im.recent.unread',
    'im.message.add',
    'tasks.task.update',
    'timeman.open',
    'timeman.close',
    'timeman.pause',
    'mail.message.send',
    'disk.folder.uploadfile',
    'im.chat.leave',
    'disk.folder.addsubfolder',
    'disk.file.markdeleted',
    'disk.file.getexternallink',
    'im.dialog.readall',
  ])('ловит пишущий метод %s', (method) => {
    expect(isForbiddenName(method)).toBe(true);
  });

  it('каждый разрешённый метод заканчивается «читающим» словом', () => {
    const offenders = [...ALLOWED_V1, ...ALLOWED_V3].filter((m) => !isReadOnlyShape(m));
    expect(offenders).toEqual([]);
  });

  it.each([
    'im.notify',
    'im.dialog.writing',
    'im.disk.file.save',
    'im.message.command',
    'tasks.task.defer',
    'tasks.task.renew',
    'tasks.task.disapprove',
    'tasks.task.stopwatch',
    'tasks.task.unmute',
    'tasks.task.unpin',
    'tasks.task.favorite.remove',
    'tasks.task.files.attach',
    'task.checklistitem.renew',
    'sonet_group.user.invite',
    'sonet_group.user.request',
    'note.document.archive',
    'mail.message.removecrmactivity',
    'event.bind',
    'placement.bind',
    'imopenlines.session.join',
    'bizproc.workflow.terminate',
    'im.message.add',
    'disk.file.getExternalLink',
  ])('пишущий метод %s не проходит проверку формы', (method) => {
    expect(isReadOnlyShape(method)).toBe(false);
  });

  it('проверяет начало слова, а не вхождение: thread — не read', () => {
    expect(isForbiddenName('mail.message.thread')).toBe(false);
    expect(splitMethodWords('disk.file.getExternalLink')).toEqual(['disk', 'file', 'get', 'external', 'link']);
    expect(splitMethodWords('sonet_group.user.groups')).toEqual(['sonet', 'group', 'user', 'groups']);
  });

  it('у каждого разрешённого метода известно право', () => {
    const unknown = [...ALLOWED_V1, ...ALLOWED_V3].filter((m) => scopeForMethod(m) === undefined);
    expect(unknown).toEqual([]);
  });

  it('почта, база знаний, учёт времени и итоги встреч — только в REST 3.0', () => {
    for (const m of ['mail.message.get', 'note.document.get', 'timeman.record.list', 'call.followup.get']) {
      expect(ALLOWED_V3.has(m)).toBe(true);
      expect(ALLOWED_V1.has(m)).toBe(false);
    }
  });
});

describe('выход в сеть', () => {
  const NET_MODULES = /from\s+['"](?:node:)?(?:http|https|net|tls|dgram|child_process)['"]|from\s+['"]undici['"]|require\(\s*['"](?:node:)?(?:http|https|net|tls|child_process|undici)['"]\s*\)/;
  const FETCH_USE = /(?<![.\w])fetch\b|globalThis\s*\.\s*fetch\b/;

  function stripComments(code: string): string {
    return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  }

  it('глобальный fetch — только в клиенте и в проверке версии; сетевых модулей нет нигде', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const srcDir = path.resolve(import.meta.dirname, '..');
    const files = (fs.readdirSync(srcDir, { recursive: true }) as string[])
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('testkit.ts'))
      .map((f) => f.split(path.sep).join('/'));
    const code = new Map(files.map((f) => [f, stripComments(fs.readFileSync(path.join(srcDir, f), 'utf8'))]));
    const fetchUsers = files.filter((f) => FETCH_USE.test(code.get(f) ?? ''));
    expect(fetchUsers.every((f) => f === 'api/client.ts' || f === 'commands/update-check.ts')).toBe(true);
    expect(fetchUsers).toContain('api/client.ts');
    expect(files.filter((f) => NET_MODULES.test(code.get(f) ?? ''))).toEqual([]);
  });

  it('сама проверка ловит обходы', () => {
    expect(FETCH_USE.test('await globalThis.fetch(url)')).toBe(true);
    expect(FETCH_USE.test('const f = fetch;')).toBe(true);
    expect(NET_MODULES.test("import https from 'node:https';")).toBe(true);
    expect(NET_MODULES.test("import { request } from 'undici';")).toBe(true);
    expect(NET_MODULES.test("import { execSync } from 'child_process';")).toBe(true);
    expect(FETCH_USE.test(stripComments('// «fetch failed» в комментарии'))).toBe(false);
  });
});
