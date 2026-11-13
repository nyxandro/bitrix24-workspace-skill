/**
 * Команды org и worktime.
 */
import type { Command } from 'commander';
import { orgDepartment, orgFind, orgMe } from '../commands/org.js';
import { worktimeRecords, worktimeStatus } from '../commands/worktime.js';
import type { Runner } from './runtime.js';

export function registerOrgWorktime(program: Command, run: Runner): void {
  const org = program.command('org').description('Оргструктура');
  org
    .command('me')
    .description('Мои отделы, руководители и коллеги')
    .option('--limit <n>', 'сколько коллег (по умолчанию и максимум 50)')
    .action((opts: { limit?: string }) => run((ctx) => orgMe(ctx, opts)));
  org
    .command('find')
    .description('Найти отдел по названию')
    .argument('<текст>', 'не меньше 3 символов')
    .option('--limit <n>', 'сколько (по умолчанию 10, максимум 50)')
    .action((text: string, opts: { limit?: string }) => run((ctx) => orgFind(ctx, text, opts)));
  org
    .command('department')
    .description('Отдел: руководители и сотрудники')
    .argument('<id>', 'номер отдела')
    .option('--limit <n>', 'сколько сотрудников (по умолчанию и максимум 50)')
    .action((id: string, opts: { limit?: string }) => run((ctx) => orgDepartment(ctx, id, opts)));

  const worktime = program.command('worktime').description('Рабочее время');
  worktime
    .command('status')
    .description('Идёт ли сейчас мой рабочий день')
    .action(() => run((ctx) => worktimeStatus(ctx)));
  worktime
    .command('records')
    .description('Сколько я отработал за период')
    .option('--from <дата>', 'с даты ГГГГ-ММ-ДД (обязательно)')
    .option('--to <дата>', 'по дату ГГГГ-ММ-ДД (обязательно)')
    .option('--limit <n>', 'сколько записей (по умолчанию 31, максимум 100)')
    .action((opts: { from?: string; to?: string; limit?: string }) => run((ctx) => worktimeRecords(ctx, opts)));
}
