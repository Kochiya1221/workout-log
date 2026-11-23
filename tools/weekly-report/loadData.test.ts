import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serializeDays, serializeExercises, serializeSets } from '../../src/sync/files';
import { loadWorkoutData } from './loadData';

const T = '2026-01-01T00:00:00.000Z';
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'workout-report-test-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const set = (id: string, date: string) => ({
  id,
  date,
  exerciseId: 'ex-1',
  setNo: 1,
  weightKg: 60,
  reps: 10,
  note: '',
  createdAt: T,
  updatedAt: T,
  deletedAt: null,
});

describe('loadWorkoutData', () => {
  it('種目・日・月ごとのファイルを読む（月以外のファイルは無視）', () => {
    writeFileSync(
      join(dir, 'exercises.json'),
      serializeExercises([{ id: 'ex-1', name: 'テスト種目A', bodyPart: 'legs', createdAt: T, updatedAt: T, deletedAt: null }]),
    );
    writeFileSync(
      join(dir, 'days.json'),
      serializeDays([{ id: '2026-11-20', date: '2026-11-20', personal: true, createdAt: T, updatedAt: T, deletedAt: null }]),
    );
    mkdirSync(join(dir, 'logs'));
    writeFileSync(join(dir, 'logs', '2026-10.json'), serializeSets([set('a', '2026-10-31')]));
    writeFileSync(join(dir, 'logs', '2026-11.json'), serializeSets([set('b', '2026-11-20')]));
    writeFileSync(join(dir, 'logs', 'notes.md'), '# メモ');

    const data = loadWorkoutData(dir);
    expect(data.exercises.map((e) => e.name)).toEqual(['テスト種目A']);
    expect(data.days.map((d) => d.personal)).toEqual([true]);
    expect(data.sets.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('ファイルや logs/ が無ければ空', () => {
    expect(loadWorkoutData(dir)).toEqual({ exercises: [], days: [], sets: [] });
  });

  it('フォルダが無ければエラー', () => {
    expect(() => loadWorkoutData(join(dir, 'nope'))).toThrow('見つかりません');
  });

  it('壊れたファイルはエラー（ファイル名がわかる）', () => {
    mkdirSync(join(dir, 'logs'));
    writeFileSync(join(dir, 'logs', '2026-11.json'), '{ broken');
    expect(() => loadWorkoutData(dir)).toThrow('logs/2026-11.json');
  });
});
