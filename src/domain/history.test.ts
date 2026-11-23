import { describe, expect, it } from 'vitest';
import type { Exercise } from './exercise';
import { buildHistory } from './history';
import type { SetLog } from './setLog';

function exercise(id: string, name: string, deletedAt: string | null = null): Exercise {
  return {
    id,
    name,
    bodyPart: 'legs',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt,
  };
}

function set(
  id: string,
  exerciseId: string,
  date: string,
  setNo: number,
  createdAt: string,
  deletedAt: string | null = null,
): SetLog {
  return {
    id,
    date,
    exerciseId,
    setNo,
    weightKg: 50,
    reps: 10,
    note: '',
    createdAt,
    updatedAt: createdAt,
    deletedAt,
  };
}

const exercises = [
  exercise('ex-a', 'テスト種目A'),
  exercise('ex-b', 'テスト種目B'),
  exercise('ex-c', 'テスト種目C', '2026-11-22T00:00:00.000Z'),
];

describe('buildHistory', () => {
  it('日付は新しい順、日の中の種目は最初に記録した順、セットは番号順', () => {
    const sets = [
      set('s1', 'ex-a', '2026-11-20', 1, '2026-11-20T10:00:00.000Z'),
      set('s4', 'ex-a', '2026-11-23', 2, '2026-11-23T10:05:00.000Z'),
      set('s3', 'ex-b', '2026-11-23', 1, '2026-11-23T09:00:00.000Z'),
      set('s2', 'ex-a', '2026-11-23', 1, '2026-11-23T10:00:00.000Z'),
    ];
    const history = buildHistory(sets, exercises);
    expect(history.map((d) => d.date)).toEqual(['2026-11-23', '2026-11-20']);
    expect(history[0]?.entries.map((e) => e.exerciseName)).toEqual(['テスト種目B', 'テスト種目A']);
    expect(history[0]?.entries[1]?.sets.map((s) => s.id)).toEqual(['s2', 's4']);
  });

  it('削除済みのセットは含めず、セットがすべて削除された日は出さない', () => {
    const sets = [
      set('s1', 'ex-a', '2026-11-20', 1, '2026-11-20T10:00:00.000Z', '2026-11-21T00:00:00.000Z'),
      set('s2', 'ex-a', '2026-11-23', 1, '2026-11-23T10:00:00.000Z'),
      set('s3', 'ex-a', '2026-11-23', 2, '2026-11-23T10:05:00.000Z', '2026-11-23T11:00:00.000Z'),
    ];
    const history = buildHistory(sets, exercises);
    expect(history.map((d) => d.date)).toEqual(['2026-11-23']);
    expect(history[0]?.entries[0]?.sets.map((s) => s.id)).toEqual(['s2']);
  });

  it('削除済みの種目の記録は「（削除済み）」付きで残し、見つからない種目は「不明な種目」', () => {
    const sets = [
      set('s1', 'ex-c', '2026-11-20', 1, '2026-11-20T10:00:00.000Z'),
      set('s2', 'ex-x', '2026-11-20', 1, '2026-11-20T11:00:00.000Z'),
    ];
    const entries = buildHistory(sets, exercises)[0]?.entries;
    expect(entries?.map((e) => [e.exerciseName, e.exerciseDeleted])).toEqual([
      ['テスト種目C（削除済み）', true],
      ['不明な種目', false],
    ]);
  });

  it('記録がなければ空配列', () => {
    expect(buildHistory([], exercises)).toEqual([]);
  });
});
