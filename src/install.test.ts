import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const dirs: string[] = [];
const tmp = (p: string) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), p));
  dirs.push(d);
  return d;
};
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

function fakeArchive(dir: string): string {
  const file = path.join(dir, 'bitrix24-workspace.skill');
  execFileSync('python3', ['-I', '-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],"w"); z.writestr("bitrix24-workspace/SKILL.md","# skill"); z.close()', file]);
  return file;
}

function install(home: string, args: string[]) {
  return execFileSync('bash', [path.join(ROOT, 'install.sh'), ...args], { env: { ...process.env, HOME: home }, encoding: 'utf8' });
}

describe('install.sh', () => {
  it('ставит скилл, ссылку для Claude Code и пустой .env с правами 600; повтор не трогает адрес', () => {
    const home = tmp('b24-home-');
    const archive = fakeArchive(tmp('b24-arc-'));
    install(home, ['--file', archive]);
    expect(fs.existsSync(path.join(home, '.agents/skills/bitrix24-workspace/SKILL.md'))).toBe(true);
    const link = path.join(home, '.claude/skills/bitrix24-workspace');
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(path.join(link, 'SKILL.md'))).toBe(true);
    const env = path.join(home, '.config/bitrix24-workspace/.env');
    expect(fs.statSync(env).mode & 0o777).toBe(0o600);
    fs.writeFileSync(env, 'BITRIX24_WORKSPACE_WEBHOOK_URL=https://example.bitrix24.ru/rest/1/testsecret0000/\n');
    install(home, ['--file', archive]);
    expect(fs.readFileSync(env, 'utf8')).toContain('testsecret0000');
  });

  it('--dir ставит ещё в одну папку; старая папка в ~/.claude/skills заменяется ссылкой', () => {
    const home = tmp('b24-home-');
    const extra = tmp('b24-extra-');
    fs.mkdirSync(path.join(home, '.claude/skills/bitrix24-workspace'), { recursive: true });
    install(home, ['--file', fakeArchive(tmp('b24-arc-')), '--dir', extra]);
    expect(fs.existsSync(path.join(extra, 'bitrix24-workspace/SKILL.md'))).toBe(true);
    expect(fs.lstatSync(path.join(home, '.claude/skills/bitrix24-workspace')).isSymbolicLink()).toBe(true);
  });

  it('не архив скилла — понятная ошибка', () => {
    const home = tmp('b24-home-');
    const bad = path.join(tmp('b24-arc-'), 'bad.skill');
    execFileSync('python3', ['-I', '-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],"w"); z.writestr("x.txt","x"); z.close()', bad]);
    expect(() => install(home, ['--file', bad])).toThrow(/внутри нет bitrix24-workspace\/SKILL.md/);
  });
});
