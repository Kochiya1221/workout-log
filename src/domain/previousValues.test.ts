import { describe, expect, it } from 'vitest';
import { findPreviousSession, suggestInitialValues } from './previousValues';
import type { SetLog } from './setLog';

const T1 = '2026-01-01T00:00:00.000Z';

function set(
  exerciseId: string,
  date: string,
  setNo: number,
  weightKg: number,
  reps: number,
  deletedAt: string | null = null,
): SetLog {
  return {
    id: `${exerciseId}-${date}-${String(setNo)}`,
    date,
    exerciseId,
    setNo,
    weightKg,
    reps,
    note: '',
    createdAt: T1,
    updatedAt: T1,
    deletedAt,
  };
}

const TODAY = '2026-11-23';

describe('findPreviousSession', () => {
  it('前の日付のうち最も新しい日を選ぶ（同じ日・未来の日・他の種目は使わない）', () => {
    const sets = [
      set('ex-1', '2026-11-10', 1, 40, 10),
      set('ex-1', '2026-11-20', 2, 52, 8),
      set('ex-1', '2026-11-20', 1, 50, 10),
      set('ex-1', TODAY, 1, 60, 5),
      set('ex-1', '2026-11-25', 1, 70, 5),
      set('ex-2', '2026-11-22', 1, 99, 1),
    ];
    const previous = findPreviousSession(sets, 'ex-1', TODAY);
    expect(previous?.date).toBe('2026-11-20');
    expect(previous?.sets.map((s) => s.setNo)).toEqual([1, 2]);
  });

  it('削除済みのセットしかない日は前回とみなさない', () => {
    const sets = [
      set('ex-1', '2026-11-10', 1, 40, 10),
      set('ex-1', '2026-11-20', 1, 50, 10, T1),
    ];
    expect(findPreviousSession(sets, 'ex-1', TODAY)?.date).toBe('2026-11-10');
  });

  it('前回がなければ null', () => {
    expect(findPreviousSession([set('ex-1', TODAY, 1, 60, 5)], 'ex-1', TODAY)).toBeNull();
  });
});

describe('suggestInitialValues', () => {
  const previous = [
    set('ex-1', '2026-11-20', 1, 65, 12),
    set('ex-1', '2026-11-20', 2, 65, 10),
    set('ex-1', '2026-11-20', 3, 60, 9),
  ];

  it('要件の例: 前回1セット目が 65kg×12 なら、今回1セット目も 65kg×12', () => {
    expect(suggestInitialValues(previous, 'ex-1', TODAY, 1)).toEqual({ weightKg: 65, reps: 12 });
  });

  it('同じセット番号の値を使う（今日の記録より前回を優先）', () => {
    const sets = [...previous, set('ex-1', TODAY, 1, 70, 6)];
    expect(suggestInitialValues(sets, 'ex-1', TODAY, 2)).toEqual({ weightKg: 65, reps: 10 });
  });

  it('前回より多いセットは、前回の最後のセットの値', () => {
    expect(suggestInitialValues(previous, 'ex-1', TODAY, 4)).toEqual({ weightKg: 60, reps: 9 });
    expect(suggestInitialValues(previous, 'ex-1', TODAY, 10)).toEqual({ weightKg: 60, reps: 9 });
  });

  it('前回がなければ、同じ日の最後のセットの値', () => {
    const sets = [set('ex-1', TODAY, 1, 40, 12), set('ex-1', TODAY, 2, 42.5, 10)];
    expect(suggestInitialValues(sets, 'ex-1', TODAY, 3)).toEqual({ weightKg: 42.5, reps: 10 });
  });

  it('前回も同じ日の記録もなければ null', () => {
    expect(suggestInitialValues([], 'ex-1', TODAY, 1)).toBeNull();
    expect(suggestInitialValues(previous, 'ex-2', TODAY, 1)).toBeNull();
  });

  it('過去の日を入力するときは、その日より前を前回とする', () => {
    const sets = [
      set('ex-1', '2026-11-01', 1, 30, 15),
      ...previous,
    ];
    expect(suggestInitialValues(sets, 'ex-1', '2026-11-15', 1)).toEqual({
      weightKg: 30,
      reps: 15,
    });
  });
});
