import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from './config/config.js';

// Выпуск собирается из нескольких файлов, которые правятся руками. Если они
// разойдутся, установленные копии будут вечно сообщать «вышла новая версия»
// или получат архив не от того кода.
const ROOT = path.resolve(import.meta.dirname, '..');
const SKILL_DIR = path.join(ROOT, 'skills', 'bitrix24-workspace');
const ARCHIVE = path.join(ROOT, 'bitrix24-workspace.skill');
const read = (...parts: string[]) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

describe('согласованность выпуска', () => {
  it('версия одна и та же в package.json, package-lock.json, config.ts, SKILL.md и CHANGELOG.md', () => {
    expect((JSON.parse(read('package.json')) as { version: string }).version).toBe(APP_VERSION);
    expect((JSON.parse(read('package-lock.json')) as { version: string }).version).toBe(APP_VERSION);
    expect(/bitrix24-workspace · версия (\S+) ·/.exec(read('skills', 'bitrix24-workspace', 'SKILL.md'))?.[1]).toBe(APP_VERSION);
    // Первая запись списка изменений — текущая версия.
    expect(/^## \[([^\]]+)\]/m.exec(read('CHANGELOG.md'))?.[1]).toBe(APP_VERSION);
  });

  // Строгие разборщики YAML (GitHub, часть установщиков) отвергают значение без кавычек,
  // в котором есть «: » или « #»: шапка скилла тогда не читается вовсе.
  it('шапка SKILL.md — корректный YAML: значения с двоеточием взяты в кавычки', () => {
    const header = /^---\n([\s\S]*?)\n---\n/.exec(read('skills', 'bitrix24-workspace', 'SKILL.md'))?.[1] ?? '';
    const fields = header.split('\n').map((line) => /^([a-z-]+): (.*)$/.exec(line));
    expect(fields.map((f) => f?.[1])).toEqual(['name', 'description']);
    for (const field of fields) {
      const value = field?.[2] ?? '';
      const quoted = /^"(?:[^"\\]|\\.)*"$/.test(value);
      expect(quoted || !/: | #|^[[{&*!|>'%@`]/.test(value), `поле ${field?.[1]} нужно взять в кавычки`).toBe(true);
    }
  });

  it('собранная программа называет ту же версию', () => {
    const out = execFileSync('node', [path.join(SKILL_DIR, 'scripts', 'b24.cjs'), '--version'], { encoding: 'utf8' });
    expect(out.trim()).toBe(APP_VERSION);
  });

  it('архив .skill содержит ровно файлы скилла и они совпадают с папкой skills/', () => {
    const files = ['SKILL.md', 'references/json-fields.md', 'references/setup.md', 'scripts/b24.cjs'];
    const listed = execFileSync('unzip', ['-Z1', ARCHIVE], { encoding: 'utf8' }).trim().split('\n').sort();
    expect(listed).toEqual(files.map((f) => `bitrix24-workspace/${f}`).sort());
    for (const file of files) {
      const packed = execFileSync('unzip', ['-p', ARCHIVE, `bitrix24-workspace/${file}`], { maxBuffer: 64 * 1024 * 1024 });
      expect(packed.equals(fs.readFileSync(path.join(SKILL_DIR, file))), `${file} в архиве устарел: npm run pack:skill`).toBe(true);
    }
  });
});
