import { describe, expect, it } from 'vitest';
import {
  activeExercises,
  createExercise,
  deleteExercise,
  groupByBodyPart,
  normalizeName,
  updateExercise,
  validateExerciseName,
  type Exercise,
} from './exercise';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';

function make(id: string, name: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name,
    bodyPart: 'chest',
    createdAt: T1,
    updatedAt: T1,
    deletedAt: null,
    ...overrides,
  };
}

describe('normalizeName', () => {
  it('前後の空白（全角を含む）を取り除く', () => {
    expect(normalizeName('  テスト種目A　')).toBe('テスト種目A');
  });
});

describe('validateExerciseName', () => {
  const existing = [
    make('id-1', 'テスト種目A'),
    make('id-2', 'テスト種目B', { deletedAt: T2 }),
  ];

  it('空や空白だけはエラー', () => {
    expect(validateExerciseName('', existing)).toEqual({
      ok: false,
      error: '種目名を入力してください',
    });
    expect(validateExerciseName('   ', existing).ok).toBe(false);
  });

  it('50文字までは OK、51文字はエラー', () => {
    expect(validateExerciseName('あ'.repeat(50), existing)).toEqual({
      ok: true,
      name: 'あ'.repeat(50),
    });
    expect(validateExerciseName('あ'.repeat(51), existing)).toEqual({
      ok: false,
      error: '種目名は50文字以内にしてください',
    });
  });

  it('削除されていない種目と同名はエラー（前後の空白は無視）', () => {
    const expected = { ok: false, error: '同じ名前の種目があります' };
    expect(validateExerciseName('テスト種目A', existing)).toEqual(expected);
    expect(validateExerciseName(' テスト種目A ', existing)).toEqual(expected);
  });

  it('削除済みの種目と同名は OK', () => {
    expect(validateExerciseName('テスト種目B', existing)).toEqual({
      ok: true,
      name: 'テスト種目B',
    });
  });

  it('編集中の種目自身と同名は OK', () => {
    expect(validateExerciseName('テスト種目A', existing, 'id-1')).toEqual({
      ok: true,
      name: 'テスト種目A',
    });
  });

  it('正規化した名前を返す', () => {
    expect(validateExerciseName('  テスト種目C ', existing)).toEqual({
      ok: true,
      name: 'テスト種目C',
    });
  });
});

describe('createExercise', () => {
  it('各フィールドを設定する', () => {
    expect(
      createExercise({ name: ' テスト種目A ', bodyPart: 'legs' }, { id: 'id-1', now: T1 }),
    ).toEqual({
      id: 'id-1',
      name: 'テスト種目A',
      bodyPart: 'legs',
      createdAt: T1,
      updatedAt: T1,
      deletedAt: null,
    });
  });
});

describe('updateExercise', () => {
  it('名前・部位・updatedAt を変え、他は保つ', () => {
    const original = make('id-1', 'テスト種目A');
    const updated = updateExercise(original, { name: 'テスト種目Z', bodyPart: 'back' }, T2);
    expect(updated).toEqual({
      id: 'id-1',
      name: 'テスト種目Z',
      bodyPart: 'back',
      createdAt: T1,
      updatedAt: T2,
      deletedAt: null,
    });
    expect(original.name).toBe('テスト種目A');
    expect(original.updatedAt).toBe(T1);
  });
});

describe('deleteExercise', () => {
  it('deletedAt と updatedAt を同じ時刻にし、元は変えない', () => {
    const original = make('id-1', 'テスト種目A');
    const deleted = deleteExercise(original, T2);
    expect(deleted.deletedAt).toBe(T2);
    expect(deleted.updatedAt).toBe(T2);
    expect(deleted.name).toBe('テスト種目A');
    expect(original.deletedAt).toBeNull();
  });
});

describe('activeExercises', () => {
  it('削除済みを除く', () => {
    const list = [make('id-1', 'A'), make('id-2', 'B', { deletedAt: T2 })];
    expect(activeExercises(list).map((e) => e.id)).toEqual(['id-1']);
  });
});

describe('groupByBodyPart', () => {
  it('部位の表示順・名前順にまとめ、空の部位と削除済みを除く', () => {
    const list = [
      make('id-1', 'テスト種目い', { bodyPart: 'legs' }),
      make('id-2', 'テスト種目あ', { bodyPart: 'legs' }),
      make('id-3', 'テスト種目う', { bodyPart: 'chest' }),
      make('id-4', 'テスト種目え', { bodyPart: 'abs', deletedAt: T2 }),
    ];
    const groups = groupByBodyPart(list);
    expect(groups.map((g) => g.bodyPart)).toEqual(['chest', 'legs']);
    expect(groups[1]?.exercises.map((e) => e.name)).toEqual(['テスト種目あ', 'テスト種目い']);
  });

  it('種目がなければ空配列', () => {
    expect(groupByBodyPart([])).toEqual([]);
  });
});
