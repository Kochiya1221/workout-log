import { describe, expect, it } from 'vitest';
import { parseArgs } from './cli';

describe('parseArgs', () => {
  it('既定は markdown、--end は任意', () => {
    expect(parseArgs(['--data-dir', '/tmp/data'])).toEqual({ dataDir: '/tmp/data', end: undefined, format: 'markdown' });
    expect(parseArgs(['--data-dir', 'd', '--end', '2026-11-23', '--format', 'json'])).toEqual({
      dataDir: 'd',
      end: '2026-11-23',
      format: 'json',
    });
  });

  it('--data-dir が無い・不明な引数はエラー', () => {
    expect(() => parseArgs([])).toThrow('--data-dir');
    expect(() => parseArgs(['--data-dir', 'd', '--format', 'html'])).toThrow('不明な引数');
    expect(() => parseArgs(['--verbose'])).toThrow('不明な引数');
  });
});
