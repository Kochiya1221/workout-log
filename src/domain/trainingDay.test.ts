import { describe, expect, it } from 'vitest';
import { findDay, isPersonalDay, setPersonal, type TrainingDay } from './trainingDay';

const T1 = '2026-11-01T00:00:00.000Z';
const T2 = '2026-11-02T00:00:00.000Z';

function day(date: string, personal: boolean, deletedAt: string | null = null): TrainingDay {
  return { id: date, date, personal, createdAt: T1, updatedAt: T1, deletedAt };
}

describe('setPersonal', () => {
  it('新規なら id = 日付で作る', () => {
    expect(setPersonal(undefined, '2026-11-23', true, T1)).toEqual({
      id: '2026-11-23',
      date: '2026-11-23',
      personal: true,
      createdAt: T1,
      updatedAt: T1,
      deletedAt: null,
    });
  });

  it('既存なら personal と updatedAt だけ変える（createdAt は変えない）', () => {
    const original = day('2026-11-23', true);
    expect(setPersonal(original, '2026-11-23', false, T2)).toEqual({
      ...original,
      personal: false,
      updatedAt: T2,
    });
    expect(original.personal).toBe(true);
  });

  it('削除済みのものを設定し直すと、削除フラグを外す', () => {
    expect(setPersonal(day('2026-11-23', false, T1), '2026-11-23', true, T2)).toMatchObject({
      personal: true,
      deletedAt: null,
      updatedAt: T2,
    });
  });
});

describe('isPersonalDay / findDay', () => {
  const days = [day('2026-11-20', true), day('2026-11-21', false), day('2026-11-22', true, T2)];

  it('設定がなければ自主トレ（false）', () => {
    expect(isPersonalDay(days, '2026-11-23')).toBe(false);
    expect(isPersonalDay([], '2026-11-20')).toBe(false);
  });

  it('設定どおりに返し、削除済みは無いものとして扱う', () => {
    expect(isPersonalDay(days, '2026-11-20')).toBe(true);
    expect(isPersonalDay(days, '2026-11-21')).toBe(false);
    expect(isPersonalDay(days, '2026-11-22')).toBe(false);
    expect(findDay(days, '2026-11-22')).toBeUndefined();
  });
});
