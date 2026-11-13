#!/usr/bin/env node
/**
 * Точка входа CLI «b24» — доступ ИИ-агента к Битрикс24 только на чтение.
 * Дерево команд — src/cli/program.ts.
 */
import { buildProgram } from './cli/program.js';

buildProgram()
  .parseAsync(process.argv)
  .catch((err: unknown) => {
    console.error('Ошибка: Непредвиденная ошибка выполнения команды. [APP_UNEXPECTED]');
    if (process.env.B24_DEBUG) {
      console.error(err);
    }
    process.exit(1);
  });
