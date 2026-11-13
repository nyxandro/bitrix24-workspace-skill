/**
 * Команды chats и notifications.
 */
import type { Command } from 'commander';
import { chatsCounters, chatsFind, chatsInfo, chatsMessages, chatsRecent, chatsSearch } from '../commands/chats.js';
import { notifications } from '../commands/notifications.js';
import type { Runner } from './runtime.js';

const DIALOG_HELP = 'chat<номер> — групповой чат или чат задачи, sg<номер> — чат проекта, номер — личка с сотрудником';

export function registerChats(program: Command, run: Runner): void {
  const chats = program.command('chats').description('Чаты, личка, чаты задач и проектов');
  chats
    .command('recent')
    .description('Последние диалоги со счётчиками непрочитанного')
    .option('--unread', 'только с непрочитанными')
    .option('--type <тип>', 'private | chat | all (по умолчанию all)')
    .option('--limit <n>', 'сколько (по умолчанию 20, максимум 50)')
    .option('--page <курсор>', 'значение next из прошлого ответа')
    .action((opts: { unread?: boolean; type?: string; limit?: string; page?: string }) => run((ctx) => chatsRecent(ctx, opts)));
  chats
    .command('counters')
    .description('Сводка непрочитанного по типам')
    .action(() => run((ctx) => chatsCounters(ctx)));
  chats
    .command('find')
    .description('Найти чат по названию или участнику (чат проекта или коллабы — projects list --search, чат задачи — tasks get)')
    .argument('<текст>', 'не меньше 2 символов')
    .option('--limit <n>', 'сколько (по умолчанию 10, максимум 50)')
    .action((text: string, opts: { limit?: string }) => run((ctx) => chatsFind(ctx, text, opts.limit)));
  chats
    .command('info')
    .description('Что за чат и кто в нём')
    .argument('<dialogId>', DIALOG_HELP)
    .action((dialogId: string) => run((ctx) => chatsInfo(ctx, dialogId)));
  chats
    .command('messages')
    .description('Прочитать переписку: по умолчанию последние сообщения, по возрастанию времени')
    .argument('<dialogId>', DIALOG_HELP)
    .option('--limit <n>', 'сколько (по умолчанию 30, максимум 200)')
    .option('--before <id>', 'более ранние, чем это сообщение (значение next)')
    .option('--after <id>', 'более новые, чем это сообщение')
    .option('--since <дата>', 'все сообщения с даты ГГГГ-ММ-ДД (не больше 500)')
    .option('--full', 'не обрезать длинные сообщения')
    .action((dialogId: string, opts: { limit?: string; before?: string; after?: string; since?: string; full?: boolean }) =>
      run((ctx) => chatsMessages(ctx, dialogId, opts)),
    );
  chats
    .command('search')
    .description('Найти сообщения в одном чате')
    .argument('<dialogId>', DIALOG_HELP)
    .argument('<текст>', 'больше 2 символов')
    .option('--since <дата>', 'с даты ГГГГ-ММ-ДД')
    .option('--until <дата>', 'по дату ГГГГ-ММ-ДД')
    .option('--limit <n>', 'сколько (по умолчанию 30, максимум 200)')
    .option('--before <id>', 'значение next из прошлого ответа')
    .action((dialogId: string, text: string, opts: { since?: string; until?: string; limit?: string; before?: string }) =>
      run((ctx) => chatsSearch(ctx, dialogId, text, opts)),
    );

  program
    .command('notifications')
    .description('Уведомления: упоминания, поручения, приглашения')
    .option('--limit <n>', 'сколько (по умолчанию 20, максимум 50)')
    .option('--before <курсор>', 'значение next из прошлого ответа')
    .action((opts: { limit?: string; before?: string }) => run((ctx) => notifications(ctx, opts)));
}
