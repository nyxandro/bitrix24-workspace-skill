/**
 * Команды projects и tasks.
 */
import type { Command } from 'commander';
import { projectsGet, projectsList } from '../commands/projects.js';
import { tasksGet, tasksList } from '../commands/tasks.js';
import type { Runner } from './runtime.js';

export function registerProjectsTasks(program: Command, run: Runner): void {
  const projects = program.command('projects').description('Группы, проекты, скрамы, коллабы');
  projects
    .command('list')
    .description('Найти группу или проект; dialogId — их чат для chats messages')
    .option('--search <текст>', 'часть названия')
    .option('--type <тип>', 'group | project | scrum | collab')
    .option('--mine', 'только те, где я участник')
    .option('--limit <n>', 'сколько (по умолчанию 20, максимум 50)')
    .option('--page <курсор>', 'значение next из прошлого ответа')
    .action((opts: { search?: string; type?: string; mine?: boolean; limit?: string; page?: string }) => run((ctx) => projectsList(ctx, opts)));
  projects
    .command('get')
    .description('Карточка группы и участники')
    .argument('<id>', 'номер группы')
    .action((id: string) => run((ctx) => projectsGet(ctx, id)));

  const tasks = program.command('tasks').description('Задачи и их чаты');
  tasks
    .command('list')
    .description('Мои задачи (по умолчанию — где я ответственный, постановщик, соисполнитель или наблюдатель)')
    .option('--role <роль>', 'responsible | creator | accomplice | auditor | any (по умолчанию any)')
    .option('--project <id>', 'только задачи группы')
    .option('--status <статус>', 'active | done | all (по умолчанию active)')
    .option('--search <текст>', 'часть названия')
    .option('--limit <n>', 'сколько (по умолчанию 20, максимум 50)')
    .option('--page <курсор>', 'значение next (только с одной ролью)')
    .action((opts: { role?: string; project?: string; status?: string; search?: string; limit?: string; page?: string }) =>
      run((ctx) => tasksList(ctx, opts)),
    );
  tasks
    .command('get')
    .description('Карточка задачи: dialogId её чата, чаты из описания, чек-лист')
    .argument('<id>', 'номер задачи')
    .option('--full', 'не обрезать описание')
    .action((id: string, opts: { full?: boolean }) => run((ctx) => tasksGet(ctx, id, opts)));
}
