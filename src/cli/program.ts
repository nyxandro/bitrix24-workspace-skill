/**
 * Сборка дерева команд CLI «b24».
 *
 * Отделено от точки входа (src/cli.ts), чтобы команды можно было проверять в
 * тестах без запуска процесса. Команды по разделам регистрируются модулями
 * src/cli/register-*.ts по мере их появления.
 */
import { Command } from 'commander';
import { APP_VERSION, CLI_NAME } from '../config/config.js';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name(CLI_NAME)
    .description(
      'Битрикс24 только на чтение: чаты, задачи, проекты, диск, почта, календарь, встречи, лента, база знаний. Вывод — JSON.',
    )
    .version(APP_VERSION);
  return program;
}
