import type { Exercise } from './exercise';
import { activeSets, type SetLog } from './setLog';

export interface HistoryEntry {
  readonly exerciseId: string;
  /** 表示名。削除済みの種目は「（削除済み）」付き、見つからなければ「不明な種目」 */
  readonly exerciseName: string;
  readonly exerciseDeleted: boolean;
  /** setNo 順 */
  readonly sets: readonly SetLog[];
}

export interface HistoryDay {
  readonly date: string;
  readonly entries: readonly HistoryEntry[];
}

function minCreatedAt(sets: readonly SetLog[]): string {
  return sets.reduce((min, s) => (s.createdAt < min ? s.createdAt : min), sets[0]?.createdAt ?? '');
}

/**
 * 削除されていないセットを、日付（新しい順）→ 種目（その日最初に記録した順）→ セット番号順にまとめる。
 */
export function buildHistory(
  sets: readonly SetLog[],
  exercises: readonly Exercise[],
): HistoryDay[] {
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));

  const byDate = new Map<string, Map<string, SetLog[]>>();
  for (const s of activeSets(sets)) {
    let byExercise = byDate.get(s.date);
    if (!byExercise) {
      byExercise = new Map();
      byDate.set(s.date, byExercise);
    }
    const list = byExercise.get(s.exerciseId);
    if (list) {
      list.push(s);
    } else {
      byExercise.set(s.exerciseId, [s]);
    }
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, byExercise]) => ({
      date,
      entries: [...byExercise.entries()]
        .map(([exerciseId, list]) => {
          const exercise = exerciseById.get(exerciseId);
          const deleted = exercise?.deletedAt != null;
          const name = exercise ? exercise.name : '不明な種目';
          return {
            exerciseId,
            exerciseName: deleted ? `${name}（削除済み）` : name,
            exerciseDeleted: deleted,
            sets: [...list].sort((a, b) => a.setNo - b.setNo),
          };
        })
        .sort((a, b) => {
          const ca = minCreatedAt(a.sets);
          const cb = minCreatedAt(b.sets);
          return ca < cb ? -1 : ca > cb ? 1 : 0;
        }),
    }));
}
