#!/usr/bin/env node
/**
 * Точка входа CLI «b24» — доступ ИИ-агента к Битрикс24 только на чтение.
 * Дерево команд — src/cli/program.ts, граница ошибок — src/cli/runtime.ts.
 */
import { buildProgram } from './cli/program.js';
import { bootstrapEnv, printErrorAndExit } from './cli/runtime.js';

bootstrapEnv();
buildProgram()
  .parseAsync(process.argv)
  .catch((err: unknown) => printErrorAndExit(err));
