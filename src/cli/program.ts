/**
 * Сборка дерева команд CLI «b24» и перевод ошибок разбора командной строки.
 *
 * Сообщения самого commander английские и уходят в stderr — заменяем их
 * своими кодами APP_CLI_* с русским текстом. Команды по разделам
 * регистрируются модулями src/cli/register-*.ts.
 */
import { Command, CommanderError } from 'commander';
import { AppError } from '../api/errors.js';
import { APP_VERSION, CLI_NAME } from '../config/config.js';
import { registerChats } from './register-chats.js';
import { registerDisk } from './register-disk.js';
import { registerProjectsTasks } from './register-projects-tasks.js';
import { registerStatusUsers } from './register-status-users.js';
import { runCommand, type Runner } from './runtime.js';

export function buildProgram(run: Runner = runCommand): Command {
  const program = new Command();
  program
    .name(CLI_NAME)
    .description(
      'Битрикс24 только на чтение: чаты, задачи, проекты, диск, почта, календарь, встречи, лента, база знаний. Вывод — JSON.',
    )
    .version(APP_VERSION)
    .helpCommand(false)
    .exitOverride()
    .configureOutput({ writeErr: () => undefined, outputError: () => undefined });
  registerStatusUsers(program, run);
  registerChats(program, run);
  registerProjectsTasks(program, run);
  registerDisk(program, run);
  return program;
}

const HELP_CODES = new Set(['commander.helpDisplayed', 'commander.help', 'commander.version']);

function translate(err: CommanderError): AppError {
  const token = /'([^']+)'/.exec(err.message)?.[1] ?? '';
  const messages: Record<string, string> = {
    'commander.unknownCommand': `Неизвестная команда «${token}». Список команд: b24 --help.`,
    'commander.unknownOption': `Неизвестный параметр «${token}». Справка по команде: b24 <команда> --help.`,
    'commander.missingArgument': `Не хватает аргумента «${token}». Справка по команде: b24 <команда> --help.`,
    'commander.optionMissingArgument': `У параметра «${token}» не указано значение.`,
    'commander.missingMandatoryOptionValue': `Не указан обязательный параметр «${token}».`,
    'commander.excessArguments': 'Лишние аргументы у команды. Справка по команде: b24 <команда> --help.',
  };
  return new AppError({
    code: 'APP_CLI_INVALID_ARGUMENT',
    userMessage: messages[err.code] ?? 'Команда вызвана неверно: проверьте параметры. Справка: b24 --help.',
    details: { commanderCode: err.code },
  });
}

export async function parseArgs(argv: string[], run: Runner = runCommand): Promise<void> {
  try {
    await buildProgram(run).parseAsync(argv, { from: 'user' });
  } catch (err) {
    if (err instanceof CommanderError) {
      if (HELP_CODES.has(err.code)) {
        return;
      }
      throw translate(err);
    }
    throw err;
  }
}
