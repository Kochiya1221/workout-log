import { describe, expect, it } from 'vitest';
import { addDays, inRange, reportPeriod } from './period';

describe('addDays', () => {
  it('月末・年末・うるう年をまたぐ', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('reportPeriod', () => {
  it('実行した日を含まない過去7日間と、その前の7日間', () => {
    expect(reportPeriod('2026-11-24')).toEqual({
      start: '2026-11-17',
      end: '2026-11-23',
      prevStart: '2026-11-10',
      prevEnd: '2026-11-16',
    });
  });

  it('月・年をまたぐ', () => {
    expect(reportPeriod('2027-01-03')).toEqual({
      start: '2026-12-27',
      end: '2027-01-02',
      prevStart: '2026-12-20',
      prevEnd: '2026-12-26',
    });
  });

  it('最終日を指定できる', () => {
    expect(reportPeriod('2026-11-24', '2026-11-16')).toMatchObject({
      start: '2026-11-10',
      end: '2026-11-16',
    });
  });

  it('不正な日付の指定はエラー', () => {
    expect(() => reportPeriod('2026-11-24', '2026/11/16')).toThrow('日付の形式');
  });
});

describe('inRange', () => {
  it('両端を含む', () => {
    expect(inRange('2026-11-17', '2026-11-17', '2026-11-23')).toBe(true);
    expect(inRange('2026-11-23', '2026-11-17', '2026-11-23')).toBe(true);
    expect(inRange('2026-11-24', '2026-11-17', '2026-11-23')).toBe(false);
    expect(inRange('2026-11-16', '2026-11-17', '2026-11-23')).toBe(false);
  });
});
