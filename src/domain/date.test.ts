import { describe, expect, it } from 'vitest';
import { formatDateWithWeekday, formatShortDate, isValidDateString, toLocalDateString } from './date';

describe('toLocalDateString', () => {
  it('ローカル日付を 0 埋めで返す', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 9, 0))).toBe('2026-01-05');
  });

  it('深夜（UTC では前日）でもローカルの日付になる', () => {
    expect(toLocalDateString(new Date(2026, 10, 23, 0, 30))).toBe('2026-11-23');
  });

  it('年末・月末', () => {
    expect(toLocalDateString(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    expect(toLocalDateString(new Date(2026, 1, 28))).toBe('2026-02-28');
  });
});

describe('isValidDateString', () => {
  it('実在する日付は true', () => {
    expect(isValidDateString('2026-11-23')).toBe(true);
    expect(isValidDateString('2028-02-29')).toBe(true);
  });

  it('形式違い・実在しない日付は false', () => {
    expect(isValidDateString('')).toBe(false);
    expect(isValidDateString('2026-2-3')).toBe(false);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('2026/11/23')).toBe(false);
  });
});

describe('formatShortDate', () => {
  it('月/日（0 埋めなし）', () => {
    expect(formatShortDate('2026-11-20')).toBe('11/20');
    expect(formatShortDate('2026-01-05')).toBe('1/5');
  });
});

describe('formatDateWithWeekday', () => {
  it('同じ年は月/日(曜日)', () => {
    expect(formatDateWithWeekday('2026-11-23', '2026-12-01')).toBe('11/23(月)');
    expect(formatDateWithWeekday('2026-01-04', '2026-12-01')).toBe('1/4(日)');
  });

  it('違う年は年/月/日(曜日)', () => {
    expect(formatDateWithWeekday('2025-12-31', '2026-01-01')).toBe('2025/12/31(水)');
  });
});
