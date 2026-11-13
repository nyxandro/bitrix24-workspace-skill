/**
 * Команды feed и kb.
 */
import type { Command } from 'commander';
import { feedList, feedPost } from '../commands/feed.js';
import { kbDoc, kbList, kbSearch, kbTree } from '../commands/kb.js';
import type { Runner } from './runtime.js';

export function registerFeedKb(program: Command, run: Runner): void {
  const feed = program.command('feed').description('Живая лента: новости компании');
  feed
    .command('list')
    .description('Посты ленты (начало текста)')
    .option('--since <дата>', 'с даты ГГГГ-ММ-ДД')
    .option('--until <дата>', 'по дату ГГГГ-ММ-ДД')
    .option('--limit <n>', 'сколько (по умолчанию 20, максимум 50)')
    .option('--page <курсор>', 'значение next из прошлого ответа')
    .action((opts: { since?: string; until?: string; limit?: string; page?: string }) => run((ctx) => feedList(ctx, opts)));
  feed
    .command('post')
    .description('Пост целиком с комментариями')
    .argument('<id>', 'номер поста')
    .option('--comments <n>', 'сколько комментариев (по умолчанию 20, максимум 50)')
    .option('--full', 'не обрезать текст поста')
    .action((id: string, opts: { comments?: string; full?: boolean }) => run((ctx) => feedPost(ctx, id, opts)));

  const kb = program.command('kb').description('База знаний');
  kb
    .command('list')
    .description('Какие базы знаний есть')
    .option('--limit <n>', 'сколько (по умолчанию 20, максимум 50)')
    .option('--page <курсор>', 'значение next из прошлого ответа')
    .action((opts: { limit?: string; page?: string }) => run((ctx) => kbList(ctx, opts)));
  kb
    .command('search')
    .description('Найти документ')
    .argument('<текст>', 'не меньше 3 символов')
    .option('--limit <n>', 'сколько (по умолчанию 20, максимум 50)')
    .action((text: string, opts: { limit?: string }) => run((ctx) => kbSearch(ctx, text, opts)));
  kb
    .command('tree')
    .description('Оглавление базы знаний')
    .argument('<collectionId>', 'номер базы из kb list')
    .action((id: string) => run((ctx) => kbTree(ctx, id)));
  kb
    .command('doc')
    .description('Прочитать документ (Markdown)')
    .argument('<id>', 'номер документа')
    .option('--full', 'не обрезать')
    .action((id: string, opts: { full?: boolean }) => run((ctx) => kbDoc(ctx, id, opts)));
}
