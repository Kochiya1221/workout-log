import { describe, expect, it } from 'vitest';
import { buildMonthGrid, daySummary, daysInMonth, shiftMonth, trainedDates } from './calendar';
import { formatYearMonth } from './date';
import type { Exercise } from './exercise';
import type { SetLog } from './setLog';

const T1 = '2026-11-01T00:00:00.000Z';

function set(id: string, date: string, setNo: number, deletedAt: string | null = null): SetLog {
  return {
    id,
    date,
    exerciseId: 'ex-1',
    setNo,
    weightKg: 60,
    reps: 10,
    note: '',
    createdAt: `${date}T10:0${String(setNo)}:00.000Z`,
    updatedAt: T1,
    deletedAt,
  };
}

const days = (weeks: ReturnType<typeof buildMonthGrid>) =>
  weeks.map((w) => w.map((c) => (c ? c.day : 0)));

describe('buildMonthGrid', () => {
  it('日曜始まり、月初の前は空欄（2026年11月は日曜始まり）', () => {
    const grid = buildMonthGrid(2026, 11);
    expect(grid[0]?.[0]).toEqual({ date: '2026-11-01', day: 1 });
    expect(grid).toHaveLength(5);
    expect(days(grid).at(-1)).toEqual([29, 30, 0, 0, 0, 0, 0]);
  });

  it('月初が土曜なら6週になる（2026年8月）', () => {
    const grid = buildMonthGrid(2026, 8);
    expect(days(grid)[0]).toEqual([0, 0, 0, 0, 0, 0, 1]);
    expect(grid).toHaveLength(6);
    expect(days(grid)[5]).toEqual([30, 31, 0, 0, 0, 0, 0]);
  });

  it('2026年2月（28日・日曜始まり）はちょうど4週', () => {
    const grid = buildMonthGrid(2026, 2);
    expect(grid).toHaveLength(4);
    expect(days(grid)[3]?.[6]).toBe(28);
  });

  it('各週は7マス、日付は0埋め', () => {
    const grid = buildMonthGrid(2027, 1);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat().find((c) => c?.day === 5)?.date).toBe('2027-01-05');
  });
});

describe('daysInMonth', () => {
  it('30日・31日・うるう年の2月', () => {
    expect(daysInMonth(2026, 11)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
  });
});

describe('shiftMonth', () => {
  it('前後に動かし、年をまたぐ', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2026, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 3, -14)).toEqual({ year: 2025, month: 1 });
  });
});

describe('trainedDates', () => {
  it('削除されていないセットがある日付だけ', () => {
    const dates = trainedDates([
      set('a', '2026-11-04', 1),
      set('b', '2026-11-04', 2),
      set('c', '2026-11-05', 1, T1),
      set('d', '2026-11-11', 1),
    ]);
    expect([...dates].sort()).toEqual(['2026-11-04', '2026-11-11']);
  });
});

describe('daySummary', () => {
  const exercises: Exercise[] = [
    { id: 'ex-1', name: 'テスト種目A', bodyPart: 'legs', createdAt: T1, updatedAt: T1, deletedAt: null },
  ];

  it('その日の種目ごとのセット（番号順）', () => {
    const summary = daySummary(
      [set('b', '2026-11-04', 2), set('a', '2026-11-04', 1), set('x', '2026-11-05', 1)],
      exercises,
      '2026-11-04',
    );
    expect(summary.map((e) => [e.exerciseName, e.sets.map((s) => s.id)])).toEqual([
      ['テスト種目A', ['a', 'b']],
    ]);
  });

  it('記録がなければ空', () => {
    expect(daySummary([], exercises, '2026-11-04')).toEqual([]);
  });
});

describe('formatYearMonth', () => {
  it('年月の表記', () => {
    expect(formatYearMonth(2026, 11)).toBe('2026年11月');
  });
});
