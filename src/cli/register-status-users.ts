/**
 * Команды status и users.
 */
import type { Command } from 'commander';
import { status } from '../commands/status.js';
import { usersFind, usersGet } from '../commands/users.js';
import type { Runner } from './runtime.js';

export function registerStatusUsers(program: Command, run: Runner): void {
  program
    .command('status')
    .description('Вызывать первым: портал, чей вебхук, доступные разделы, лишние права, новая версия скилла')
    .action(() => run((ctx) => status(ctx)));

  const users = program.command('users').description('Сотрудники');
  users
    .command('find')
    .description('Найти сотрудника по имени, фамилии или должности')
    .argument('<текст>', 'не меньше 2 символов')
    .option('--limit <n>', 'сколько показать (по умолчанию 10, максимум 50)')
    .action((text: string, opts: { limit?: string }) => run((ctx) => usersFind(ctx, text, opts.limit)));
  users
    .command('get')
    .description('Имена и должности по номерам сотрудников')
    .argument('<id>', 'номера через запятую, до 50')
    .action((ids: string) => run((ctx) => usersGet(ctx, ids)));
}
