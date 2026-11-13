/**
 * Команды mail.
 */
import type { Command } from 'commander';
import { mailBoxes, mailGet, mailList, mailThread } from '../commands/mail.js';
import type { Runner } from './runtime.js';

export function registerMail(program: Command, run: Runner): void {
  const mail = program.command('mail').description('Почта');
  mail
    .command('boxes')
    .description('Мои почтовые ящики')
    .action(() => run((ctx) => mailBoxes(ctx)));
  mail
    .command('list')
    .description('Найти письма (без текста — текст через mail get)')
    .option('--box <id>', 'номер ящика')
    .option('--search <текст>', 'поиск по содержимому и адресам')
    .option('--since <дата>', 'с даты ГГГГ-ММ-ДД')
    .option('--until <дата>', 'по дату ГГГГ-ММ-ДД')
    .option('--unread', 'только непрочитанные')
    .option('--folder <папка>', 'папка ящика')
    .option('--with-attachments', 'только с вложениями')
    .option('--limit <n>', 'сколько (по умолчанию 20, максимум 50)')
    .option('--page <курсор>', 'значение next из прошлого ответа')
    .action((opts) => run((ctx) => mailList(ctx, opts)));
  mail
    .command('get')
    .description('Прочитать письмо')
    .argument('<id>', 'номер письма')
    .option('--full', 'не обрезать текст')
    .action((id: string, opts: { full?: boolean }) => run((ctx) => mailGet(ctx, id, opts)));
  mail
    .command('thread')
    .description('Вся цепочка по письму')
    .argument('<id>', 'номер письма')
    .option('--limit <n>', 'сколько писем (по умолчанию 20, максимум 50)')
    .action((id: string, opts: { limit?: string }) => run((ctx) => mailThread(ctx, id, opts)));
}
