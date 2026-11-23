import { BODY_PARTS, type BodyPart } from '../../src/domain/bodyPart';
import type { Exercise } from '../../src/domain/exercise';
import { activeSets, type SetLog } from '../../src/domain/setLog';
import { isPersonalDay, type TrainingDay } from '../../src/domain/trainingDay';
import { inRange, type ReportPeriod } from './period';

export interface WorkoutData {
  readonly exercises: readonly Exercise[];
  readonly sets: readonly SetLog[];
  readonly days: readonly TrainingDay[];
}

export interface Totals {
  /** 記録がある日数 */
  readonly days: number;
  /** そのうちパーソナルの日数 */
  readonly personalDays: number;
  readonly sets: number;
  /** 重量 × 回数の合計 */
  readonly volume: number;
}

export interface BodyPartRow {
  readonly bodyPart: BodyPart;
  readonly sets: number;
  readonly volume: number;
  readonly prevSets: number;
  readonly prevVolume: number;
}

export interface SessionBest {
  readonly date: string;
  readonly maxWeight: number;
  readonly bestE1rm: number;
}

export interface ExerciseRow {
  readonly exerciseId: string;
  /** 削除済みは「（削除済み）」付き、見つからなければ「不明な種目」 */
  readonly name: string;
  /** 種目が見つからなければ null */
  readonly bodyPart: BodyPart | null;
  readonly sets: number;
  readonly maxWeight: number;
  readonly bestE1rm: number;
  readonly volume: number;
  /** 今週より前で最後にやった日。なければ null（初回） */
  readonly previous: SessionBest | null;
  /** 最大重量か推定1RMが、それより前の全期間の最大を上回った */
  readonly personalBest: boolean;
}

export interface WeeklyReport {
  readonly period: ReportPeriod;
  readonly current: Totals;
  readonly previous: Totals;
  /** 6部位すべて（表示順） */
  readonly bodyParts: readonly BodyPartRow[];
  /** 今週セットが無い部位 */
  readonly untrainedParts: readonly BodyPart[];
  /** 今週やった種目（部位順・名前順、不明な種目は最後） */
  readonly exercises: readonly ExerciseRow[];
}

/** 推定1RM（Epley 式）。回数1なら重量そのもの。 */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30);
}

const volumeOf = (sets: readonly SetLog[]): number =>
  sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);

const maxOf = (values: readonly number[]): number =>
  values.reduce((max, v) => (v > max ? v : max), 0);

function totals(sets: readonly SetLog[], days: readonly TrainingDay[]): Totals {
  const dates = new Set(sets.map((s) => s.date));
  return {
    days: dates.size,
    personalDays: [...dates].filter((d) => isPersonalDay(days, d)).length,
    sets: sets.length,
    volume: volumeOf(sets),
  };
}

function bestOf(sets: readonly SetLog[]): { maxWeight: number; bestE1rm: number } {
  return {
    maxWeight: maxOf(sets.map((s) => s.weightKg)),
    bestE1rm: maxOf(sets.map((s) => estimateOneRepMax(s.weightKg, s.reps))),
  };
}

/** 週次レポートの集計（削除済みのセットは除く）。 */
export function buildWeeklyReport(data: WorkoutData, period: ReportPeriod): WeeklyReport {
  const sets = activeSets(data.sets);
  const exerciseById = new Map(data.exercises.map((e) => [e.id, e]));
  const current = sets.filter((s) => inRange(s.date, period.start, period.end));
  const previous = sets.filter((s) => inRange(s.date, period.prevStart, period.prevEnd));
  const partOf = (s: SetLog): BodyPart | null => exerciseById.get(s.exerciseId)?.bodyPart ?? null;

  const bodyParts = BODY_PARTS.map((bodyPart) => {
    const now = current.filter((s) => partOf(s) === bodyPart);
    const before = previous.filter((s) => partOf(s) === bodyPart);
    return {
      bodyPart,
      sets: now.length,
      volume: volumeOf(now),
      prevSets: before.length,
      prevVolume: volumeOf(before),
    };
  });

  const exerciseIds = [...new Set(current.map((s) => s.exerciseId))];
  const exercises = exerciseIds.map((exerciseId): ExerciseRow => {
    const exercise = exerciseById.get(exerciseId);
    const mine = current.filter((s) => s.exerciseId === exerciseId);
    const prior = sets.filter((s) => s.exerciseId === exerciseId && s.date < period.start);
    const lastDate = prior.reduce<string | null>(
      (latest, s) => (latest === null || s.date > latest ? s.date : latest),
      null,
    );
    const best = bestOf(mine);
    const priorBest = bestOf(prior);
    const name = exercise
      ? exercise.deletedAt === null
        ? exercise.name
        : `${exercise.name}（削除済み）`
      : '不明な種目';
    return {
      exerciseId,
      name,
      bodyPart: exercise?.bodyPart ?? null,
      sets: mine.length,
      ...best,
      volume: volumeOf(mine),
      previous:
        lastDate === null
          ? null
          : { date: lastDate, ...bestOf(prior.filter((s) => s.date === lastDate)) },
      personalBest:
        prior.length > 0 &&
        (best.maxWeight > priorBest.maxWeight || best.bestE1rm > priorBest.bestE1rm),
    };
  });

  const partIndex = (p: BodyPart | null): number =>
    p === null ? BODY_PARTS.length : BODY_PARTS.indexOf(p);
  exercises.sort(
    (a, b) => partIndex(a.bodyPart) - partIndex(b.bodyPart) || a.name.localeCompare(b.name, 'ja'),
  );

  return {
    period,
    current: totals(current, data.days),
    previous: totals(previous, data.days),
    bodyParts,
    untrainedParts: bodyParts.filter((r) => r.sets === 0).map((r) => r.bodyPart),
    exercises,
  };
}
