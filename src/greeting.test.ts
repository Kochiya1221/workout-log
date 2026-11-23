import { describe, expect, it } from 'vitest';
import { greeting } from './greeting';

describe('greeting', () => {
  it('Hello World を返す', () => {
    expect(greeting()).toBe('Hello World');
  });
});
