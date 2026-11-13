import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../config/config.js';
import { buildProgram, parseArgs } from './program.js';

describe('buildProgram', () => {
  it('отдаёт версию скилла', () => {
    expect(buildProgram().version()).toBe(APP_VERSION);
  });

  it('называется b24', () => {
    expect(buildProgram().name()).toBe('b24');
  });

  it.each([
    [['nosuch'], 'APP_CLI_INVALID_ARGUMENT', 'Неизвестная команда «nosuch»'],
    [['users', 'find'], 'APP_CLI_INVALID_ARGUMENT', 'Не хватает аргумента'],
    [['status', '--wat'], 'APP_CLI_INVALID_ARGUMENT', 'Неизвестный параметр «--wat»'],
    [[], 'APP_CLI_INVALID_ARGUMENT', 'Не указана команда'],
    [['chats'], 'APP_CLI_INVALID_ARGUMENT', 'Не указана команда'],
  ])('ошибки разбора — по-русски с кодом: %j', async (argv, code, text) => {
    await expect(parseArgs(argv as string[])).rejects.toMatchObject({ code, userMessage: expect.stringContaining(text) });
  });
});
