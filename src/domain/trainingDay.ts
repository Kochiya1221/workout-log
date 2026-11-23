/** トレーニング日の情報。REQUIREMENTS.md「データ設計 > トレーニング日」に対応する。 */
export interface TrainingDay {
  /** 日付と同じ YYYY-MM-DD（1日1件にするため） */
  readonly id: string;
  readonly date: string;
  /** パーソナル（トレーナー付き）なら true */
  readonly personal: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

/** その日の情報を返す（削除済みは無いものとして扱う）。 */
export function findDay(days: readonly TrainingDay[], date: string): TrainingDay | undefined {
  return days.find((d) => d.id === date && d.deletedAt === null);
}

/** その日がパーソナルか（設定がなければ自主トレ＝false）。 */
export function isPersonalDay(days: readonly TrainingDay[], date: string): boolean {
  return findDay(days, date)?.personal ?? false;
}

/**
 * パーソナルかどうかを設定した TrainingDay を返す。
 * 既存（削除済みを含む）があれば更新し、なければ id = 日付で作る。
 */
export function setPersonal(
  existing: TrainingDay | undefined,
  date: string,
  personal: boolean,
  now: string,
): TrainingDay {
  if (existing) {
    return { ...existing, personal, updatedAt: now, deletedAt: null };
  }
  return { id: date, date, personal, createdAt: now, updatedAt: now, deletedAt: null };
}
