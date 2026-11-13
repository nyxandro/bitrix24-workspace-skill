/**
 * Команды calendar и meetings.
 */
import type { Command } from 'commander';
import { calendarEvent, calendarEvents, calendarUpcoming } from '../commands/calendar.js';
import { meetingsGet, meetingsList } from '../commands/meetings.js';
import type { Runner } from './runtime.js';

export function registerCalendarMeetings(program: Command, run: Runner): void {
  const calendar = program.command('calendar').description('Календарь и встречи');
  calendar
    .command('upcoming')
    .description('Мои события на ближайшие дни')
    .option('--days <n>', 'сколько дней вперёд (по умолчанию 7, максимум 60)')
    .action((opts: { days?: string }) => run((ctx) => calendarUpcoming(ctx, opts)));
  calendar
    .command('events')
    .description('События за период — мои, общего, группового или чужого календаря')
    .option('--from <дата>', 'с даты ГГГГ-ММ-ДД (обязательно)')
    .option('--to <дата>', 'по дату ГГГГ-ММ-ДД (обязательно)')
    .option('--owner <чей>', 'me | company | user:<номер> | group:<номер> (по умолчанию me)')
    .action((opts: { from?: string; to?: string; owner?: string }) => run((ctx) => calendarEvents(ctx, opts)));
  calendar
    .command('event')
    .description('Подробности события с описанием')
    .argument('<id>', 'номер события')
    .option('--full', 'не обрезать описание')
    .action((id: string, opts: { full?: boolean }) => run((ctx) => calendarEvent(ctx, id, opts)));

  const meetings = program.command('meetings').description('ИИ-итоги видеовстреч, где я участник');
  meetings
    .command('list')
    .description('Встречи с итогами за период')
    .option('--from <дата>', 'с даты ГГГГ-ММ-ДД (обязательно)')
    .option('--to <дата>', 'по дату ГГГГ-ММ-ДД (обязательно)')
    .option('--limit <n>', 'сколько (по умолчанию и максимум 20)')
    .option('--page <курсор>', 'значение next из прошлого ответа')
    .action((opts: { from?: string; to?: string; limit?: string; page?: string }) => run((ctx) => meetingsList(ctx, opts)));
  meetings
    .command('get')
    .description('Итог встречи: тема, договорённости, задачи, краткое содержание')
    .argument('<callId>', 'номер звонка из meetings list')
    .option('--transcript', 'добавить расшифровку')
    .option('--full', 'не обрезать расшифровку')
    .action((id: string, opts: { transcript?: boolean; full?: boolean }) => run((ctx) => meetingsGet(ctx, id, opts)));
}
