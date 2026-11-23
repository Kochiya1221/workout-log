import type { Exercise } from './exercise';
import { buildHistory, type HistoryEntry } from './history';
import { activeSets, type SetLog } from './setLog';

export interface CalendarCell {
  /** YYYY-MM-DD */
  readonly date: string;
  readonly day: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** その月の日数。month は 1〜12。 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 月のカレンダーのマス目（日曜始まり、週ごと）。前後の月のマスは null。
 * month は 1〜12。
 */
export function buildMonthGrid(year: number, month: number): (CalendarCell | null)[][] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const cells: (CalendarCell | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    cells.push({ date: `${String(year)}-${pad2(month)}-${pad2(day)}`, day });
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (CalendarCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/** 月を delta だけ動かす（年をまたぐ）。 */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** 削除されていないセットがある日付。 */
export function trainedDates(sets: readonly SetLog[]): Set<string> {
  return new Set(activeSets(sets).map((s) => s.date));
}

/** その日の記録の概要（種目ごと、記録した順）。 */
export function daySummary(
  sets: readonly SetLog[],
  exercises: readonly Exercise[],
  date: string,
): readonly HistoryEntry[] {
  return buildHistory(
    sets.filter((s) => s.date === date),
    exercises,
  )[0]?.entries ?? [];
}
