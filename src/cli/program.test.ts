import { describe, expect, it } from 'vitest';
import { buildProgram } from './program.js';

describe('buildProgram', () => {
  it('отдаёт версию скилла', () => {
    expect(buildProgram().version()).toBe('0.1.0');
  });

  it('называется b24', () => {
    expect(buildProgram().name()).toBe('b24');
  });
});
