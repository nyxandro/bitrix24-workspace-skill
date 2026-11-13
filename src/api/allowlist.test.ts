import { describe, expect, it } from 'vitest';
import { ALLOWED_V1, ALLOWED_V3, isForbiddenName, scopeForMethod, splitMethodWords } from './allowlist.js';

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
  it('глобальный fetch упоминается только в клиенте и в проверке версии', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const srcDir = path.resolve(import.meta.dirname, '..');
    const files = (fs.readdirSync(srcDir, { recursive: true }) as string[])
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map((f) => f.split(path.sep).join('/'));
    const users = files.filter((f) => /(?<![.\w])fetch\b/.test(fs.readFileSync(path.join(srcDir, f), 'utf8')));
    expect(users.every((f) => f === 'api/client.ts' || f === 'commands/update-check.ts')).toBe(true);
    expect(users).toContain('api/client.ts');
  });
});
