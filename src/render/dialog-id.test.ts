import { describe, expect, it } from 'vitest';
import { normalizeDialogId, parseDialogIdArg } from './dialog-id.js';

describe('normalizeDialogId (данные Битрикса)', () => {
  it('приставка chat не удваивается', () => {
    expect(normalizeDialogId('chat222222')).toBe('chat222222');
    expect(normalizeDialogId('222222', 'chat')).toBe('chat222222');
    expect(normalizeDialogId(222222, 'open')).toBe('chat222222');
  });

  it('чат проекта и личка', () => {
    expect(normalizeDialogId('sg15')).toBe('sg15');
    expect(normalizeDialogId(5, 'user')).toBe('5');
    expect(normalizeDialogId('5', 'private')).toBe('5');
  });

  it('непонятное — APP_B24_UNEXPECTED_RESPONSE', () => {
    expect(() => normalizeDialogId('что-то')).toThrowError(expect.objectContaining({ code: 'APP_B24_UNEXPECTED_RESPONSE' }));
  });
});

describe('parseDialogIdArg (ввод агента)', () => {
  it.each([
    ['chat987', 'chat987'],
    ['sg15', 'sg15'],
    ['42', '42'],
    [' chat987 ', 'chat987'],
  ])('%s → %s', (raw, expected) => {
    expect(parseDialogIdArg(raw)).toBe(expected);
  });

  it.each(['chat', 'chat-1', 'группа', '', 'sg'])('«%s» — APP_CLI_INVALID_ARGUMENT', (raw) => {
    expect(() => parseDialogIdArg(raw)).toThrowError(expect.objectContaining({ code: 'APP_CLI_INVALID_ARGUMENT' }));
  });
});
