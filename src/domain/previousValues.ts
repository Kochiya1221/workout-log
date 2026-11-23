import { activeSets, setsOf, type SetLog } from './setLog';

export interface PreviousSession {
  readonly date: string;
  /** setNo 順 */
  readonly sets: readonly SetLog[];
}

export interface InitialValues {
  readonly weightKg: number;
  readonly reps: number;
}

/**
 * 前回の記録: date より前の日付のうち最も新しい日の、その種目のセット（削除済みを除く）。
 * 同じ日は含めない。
 */
export function findPreviousSession(
  sets: readonly SetLog[],
  exerciseId: string,
  date: string,
): PreviousSession | null {
  let previousDate: string | null = null;
  for (const s of activeSets(sets)) {
    if (s.exerciseId === exerciseId && s.date < date) {
      if (previousDate === null || s.date > previousDate) {
        previousDate = s.date;
      }
    }
  }
  if (previousDate === null) {
    return null;
  }
  return { date: previousDate, sets: setsOf(sets, exerciseId, previousDate) };
}

function lastOf(sets: readonly SetLog[]): SetLog | undefined {
  return sets.at(-1);
}

/**
 * 入力欄の初期値を決める。
 * 1. 前回があれば同じ setNo のセット、なければ前回の最後のセット
 * 2. 前回がなければ、同じ日の最後のセット
 * 3. どちらもなければ null
 */
export function suggestInitialValues(
  sets: readonly SetLog[],
  exerciseId: string,
  date: string,
  setNo: number,
): InitialValues | null {
  const previous = findPreviousSession(sets, exerciseId, date);
  const source = previous
    ? (previous.sets.find((s) => s.setNo === setNo) ?? lastOf(previous.sets))
    : lastOf(setsOf(sets, exerciseId, date));
  return source ? { weightKg: source.weightKg, reps: source.reps } : null;
}
