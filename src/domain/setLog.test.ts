import { describe, expect, it } from 'vitest';
import {
  createSetLog,
  nextSetNo,
  setsOf,
  toHalfWidthNumber,
  validateSetInput,
  type SetFormInput,
  type SetLog,
} from './setLog';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';

function set(
  id: string,
  exerciseId: string,
  date: string,
  setNo: number,
  overrides: Partial<SetLog> = {},
): SetLog {
  return {
    id,
    date,
    exerciseId,
    setNo,
    weightKg: 50,
    reps: 10,
    note: '',
    createdAt: T1,
    updatedAt: T1,
    deletedAt: null,
    ...overrides,
  };
}

const base: SetFormInput = { date: '2026-11-23', weight: '60', reps: '10', note: '' };
const weightError = '重量は0〜1000kg、小数第2位までで入力してください';
const repsError = '回数は1〜1000の整数で入力してください';

describe('toHalfWidthNumber', () => {
  it('全角数字・小数点を半角にし、空白を除く', () => {
    expect(toHalfWidthNumber(' ６２．５ ')).toBe('62.5');
  });
});

describe('validateSetInput', () => {
  it('正しい入力は数値に変換して返す', () => {
    expect(validateSetInput({ ...base, weight: '62.5', reps: '12', note: ' 軽め ' })).toEqual({
      ok: true,
      value: { date: '2026-11-23', weightKg: 62.5, reps: 12, note: '軽め' },
    });
  });

  it.each(['0', '1000', '62.5', '1.25', '１００'])('重量 %s は OK', (weight) => {
    expect(validateSetInput({ ...base, weight }).ok).toBe(true);
  });

  it.each(['', '1000.01', '1.255', '-5', 'abc', '5.', '.5'])('重量 %s はエラー', (weight) => {
    expect(validateSetInput({ ...base, weight })).toEqual({ ok: false, errors: [weightError] });
  });

  it.each(['1', '1000', '１２'])('回数 %s は OK', (reps) => {
    expect(validateSetInput({ ...base, reps }).ok).toBe(true);
  });

  it.each(['', '0', '1001', '1.5', '-1'])('回数 %s はエラー', (reps) => {
    expect(validateSetInput({ ...base, reps })).toEqual({ ok: false, errors: [repsError] });
  });

  it('メモは200文字まで', () => {
    expect(validateSetInput({ ...base, note: 'あ'.repeat(200) }).ok).toBe(true);
    expect(validateSetInput({ ...base, note: 'あ'.repeat(201) })).toEqual({
      ok: false,
      errors: ['メモは200文字以内にしてください'],
    });
  });

  it('不正な日付はエラー', () => {
    expect(validateSetInput({ ...base, date: '2026-02-30' })).toEqual({
      ok: false,
      errors: ['日付を入力してください'],
    });
    expect(validateSetInput({ ...base, date: '' }).ok).toBe(false);
  });

  it('複数のエラーをまとめて返す', () => {
    expect(validateSetInput({ ...base, weight: '', reps: '' })).toEqual({
      ok: false,
      errors: [weightError, repsError],
    });
  });
});

describe('createSetLog', () => {
  it('各フィールドを設定する', () => {
    expect(
      createSetLog(
        { date: '2026-11-23', exerciseId: 'ex-1', setNo: 2, weightKg: 60, reps: 8, note: '' },
        { id: 'set-1', now: T1 },
      ),
    ).toEqual({
      id: 'set-1',
      date: '2026-11-23',
      exerciseId: 'ex-1',
      setNo: 2,
      weightKg: 60,
      reps: 8,
      note: '',
      createdAt: T1,
      updatedAt: T1,
      deletedAt: null,
    });
  });
});

describe('setsOf / nextSetNo', () => {
  const sets = [
    set('s3', 'ex-1', '2026-11-23', 2),
    set('s1', 'ex-1', '2026-11-23', 1),
    set('s4', 'ex-1', '2026-11-23', 3, { deletedAt: T2 }),
    set('s5', 'ex-2', '2026-11-23', 5),
    set('s6', 'ex-1', '2026-11-22', 7),
  ];

  it('その日・その種目の削除されていないセットを setNo 順で返す', () => {
    expect(setsOf(sets, 'ex-1', '2026-11-23').map((s) => s.id)).toEqual(['s1', 's3']);
  });

  it('次のセット番号は、削除済み・他の種目・他の日を無視した最大 + 1', () => {
    expect(nextSetNo(sets, 'ex-1', '2026-11-23')).toBe(3);
  });

  it('セットがなければ 1', () => {
    expect(nextSetNo(sets, 'ex-1', '2026-11-24')).toBe(1);
    expect(nextSetNo([], 'ex-1', '2026-11-23')).toBe(1);
  });
});
