#!/usr/bin/env node
/**
 * Точка входа CLI «b24» — доступ ИИ-агента к Битрикс24 только на чтение.
 * Дерево команд — src/cli/program.ts, граница ошибок — src/cli/runtime.ts.
 */
import { parseArgs } from './cli/program.js';
import { bootstrapEnv, reportError } from './cli/runtime.js';

// Любая непойманная ошибка тоже проходит через вычистку секретов.
process.on('uncaughtException', (err) => {
  reportError(err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  reportError(err);
  process.exit(1);
});

async function main(): Promise<void> {
  bootstrapEnv();
  await parseArgs(process.argv.slice(2));
}

main().catch((err: unknown) => reportError(err));
