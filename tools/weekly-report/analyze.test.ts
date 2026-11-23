import { describe, expect, it } from 'vitest';
import type { Exercise } from '../../src/domain/exercise';
import type { SetLog } from '../../src/domain/setLog';
import type { TrainingDay } from '../../src/domain/trainingDay';
import { buildWeeklyReport, estimateOneRepMax } from './analyze';
import { reportPeriod } from './period';

const T = '2026-01-01T00:00:00.000Z';
// 11/24 に実行 → 今週 11/17〜11/23、前週 11/10〜11/16
const period = reportPeriod('2026-11-24');

function exercise(id: string, name: string, bodyPart: Exercise['bodyPart'], deletedAt: string | null = null): Exercise {
  return { id, name, bodyPart, createdAt: T, updatedAt: T, deletedAt };
}

let n = 0;
function set(exerciseId: string, date: string, weightKg: number, reps: number, deletedAt: string | null = null): SetLog {
  n++;
  return {
    id: `s${String(n)}`,
    date,
    exerciseId,
    setNo: n,
    weightKg,
    reps,
    note: '',
    createdAt: T,
    updatedAt: T,
    deletedAt,
  };
}

function day(date: string, personal: boolean): TrainingDay {
  return { id: date, date, personal, createdAt: T, updatedAt: T, deletedAt: null };
}

const exercises = [
  exercise('sq', 'テスト種目スクワット', 'legs'),
  exercise('bp', 'テスト種目ベンチ', 'chest'),
  exercise('old', 'テスト種目旧', 'back', T),
];

describe('estimateOneRepMax', () => {
  it('Epley 式。回数1なら重量そのもの', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(60, 10)).toBe(80);
    expect(estimateOneRepMax(90, 3)).toBeCloseTo(99);
  });
});

describe('buildWeeklyReport', () => {
  it('期間の境界: 開始日・終了日を含み、実行日と前週以前は今週に入らない', () => {
    const report = buildWeeklyReport(
      {
        exercises,
        sets: [
          set('sq', '2026-11-16', 50, 10), // 前週の最終日
          set('sq', '2026-11-17', 60, 10), // 今週の初日
          set('sq', '2026-11-23', 60, 10), // 今週の最終日
          set('sq', '2026-11-24', 99, 1), // 実行日（含まない）
          set('sq', '2026-11-09', 40, 10), // 前週より前
        ],
        days: [],
      },
      period,
    );
    expect(report.current).toEqual({ days: 2, personalDays: 0, sets: 2, volume: 1200 });
    expect(report.previous).toEqual({ days: 1, personalDays: 0, sets: 1, volume: 500 });
  });

  it('削除済みのセットは数えない', () => {
    const report = buildWeeklyReport(
      { exercises, sets: [set('sq', '2026-11-18', 60, 10), set('sq', '2026-11-19', 60, 10, T)], days: [] },
      period,
    );
    expect(report.current).toMatchObject({ days: 1, sets: 1 });
  });

  it('パーソナルの日数: 記録がある日だけ数える', () => {
    const report = buildWeeklyReport(
      {
        exercises,
        sets: [set('sq', '2026-11-18', 60, 10), set('bp', '2026-11-20', 40, 10)],
        days: [day('2026-11-18', true), day('2026-11-20', false), day('2026-11-21', true)],
      },
      period,
    );
    expect(report.current).toMatchObject({ days: 2, personalDays: 1 });
  });

  it('6部位すべてを出し、今週やっていない部位を列挙する', () => {
    const report = buildWeeklyReport(
      {
        exercises,
        sets: [
          set('sq', '2026-11-18', 60, 10),
          set('sq', '2026-11-18', 60, 8),
          set('bp', '2026-11-12', 40, 10),
        ],
        days: [],
      },
      period,
    );
    expect(report.bodyParts.map((r) => r.bodyPart)).toEqual(['chest', 'back', 'shoulders', 'arms', 'legs', 'abs']);
    expect(report.bodyParts.find((r) => r.bodyPart === 'legs')).toEqual({
      bodyPart: 'legs',
      sets: 2,
      volume: 1080,
      prevSets: 0,
      prevVolume: 0,
    });
    expect(report.bodyParts.find((r) => r.bodyPart === 'chest')).toMatchObject({ sets: 0, prevSets: 1, prevVolume: 400 });
    expect(report.untrainedParts).toEqual(['chest', 'back', 'shoulders', 'arms', 'abs']);
  });

  it('種目ごと: 今週の値と前回比、初回', () => {
    const report = buildWeeklyReport(
      {
        exercises,
        sets: [
          set('sq', '2026-11-05', 70, 5),
          set('sq', '2026-11-12', 60, 10), // 前回（今週より前で最後の日）
          set('sq', '2026-11-12', 65, 6),
          set('sq', '2026-11-19', 62.5, 10),
          set('sq', '2026-11-21', 67.5, 5),
          set('bp', '2026-11-20', 40, 10), // 初回
        ],
        days: [],
      },
      period,
    );
    const sq = report.exercises.find((e) => e.exerciseId === 'sq');
    expect(sq).toMatchObject({
      name: 'テスト種目スクワット',
      bodyPart: 'legs',
      sets: 2,
      maxWeight: 67.5,
      volume: 625 + 337.5,
      previous: { date: '2026-11-12', maxWeight: 65 },
    });
    expect(sq?.bestE1rm).toBeCloseTo(62.5 * (1 + 10 / 30));
    expect(sq?.previous?.bestE1rm).toBeCloseTo(80);
    const bp = report.exercises.find((e) => e.exerciseId === 'bp');
    expect(bp).toMatchObject({ previous: null, personalBest: false });
  });

  it('自己ベスト: それより前の全期間の最大を上回ったときだけ（同じ値は更新にしない）', () => {
    const base = [set('sq', '2026-10-01', 80, 5), set('sq', '2026-11-12', 60, 10)];
    const same = buildWeeklyReport({ exercises, sets: [...base, set('sq', '2026-11-18', 80, 5)], days: [] }, period);
    expect(same.exercises[0]?.personalBest).toBe(false);
    const heavier = buildWeeklyReport({ exercises, sets: [...base, set('sq', '2026-11-18', 82.5, 1)], days: [] }, period);
    expect(heavier.exercises[0]?.personalBest).toBe(true);
    // 重量は同じでも回数が増えて推定1RMが上がれば更新
    const moreReps = buildWeeklyReport({ exercises, sets: [...base, set('sq', '2026-11-18', 80, 6)], days: [] }, period);
    expect(moreReps.exercises[0]?.personalBest).toBe(true);
  });

  it('並び順は部位順・名前順。削除済みの種目は印付き、不明な種目は最後', () => {
    const report = buildWeeklyReport(
      {
        exercises,
        sets: [
          set('unknown', '2026-11-18', 10, 10),
          set('sq', '2026-11-18', 60, 10),
          set('old', '2026-11-18', 30, 10),
          set('bp', '2026-11-18', 40, 10),
        ],
        days: [],
      },
      period,
    );
    expect(report.exercises.map((e) => e.name)).toEqual([
      'テスト種目ベンチ',
      'テスト種目旧（削除済み）',
      'テスト種目スクワット',
      '不明な種目',
    ]);
  });

  it('記録がなければ 0', () => {
    const report = buildWeeklyReport({ exercises: [], sets: [], days: [] }, period);
    expect(report.current).toEqual({ days: 0, personalDays: 0, sets: 0, volume: 0 });
    expect(report.exercises).toEqual([]);
    expect(report.untrainedParts).toHaveLength(6);
  });
});
