import { describe, expect, it } from 'vitest';
import type { Exercise } from '../domain/exercise';
import type { SetLog } from '../domain/setLog';
import {
  decodeBase64Utf8,
  encodeBase64Utf8,
  groupSetsByMonth,
  logPath,
  monthKey,
  monthOfLogPath,
  parseExercises,
  parseSets,
  serializeExercises,
  serializeSets,
} from './files';

const T1 = '2026-01-01T00:00:00.000Z';

function exercise(id: string, createdAt: string): Exercise {
  return { id, name: `テスト種目${id}`, bodyPart: 'chest', createdAt, updatedAt: createdAt, deletedAt: null };
}

function set(id: string, date: string, exerciseId = 'ex-1', setNo = 1): SetLog {
  return {
    id,
    date,
    exerciseId,
    setNo,
    weightKg: 62.5,
    reps: 10,
    note: 'メモ',
    createdAt: T1,
    updatedAt: T1,
    deletedAt: null,
  };
}

describe('パス', () => {
  it('月とファイル名', () => {
    expect(monthKey('2026-11-30')).toBe('2026-11');
    expect(logPath('2026-11')).toBe('logs/2026-11.json');
    expect(monthOfLogPath('logs/2026-11.json')).toBe('2026-11');
    expect(monthOfLogPath('logs/readme.md')).toBeNull();
    expect(monthOfLogPath('exercises.json')).toBeNull();
  });
});

describe('groupSetsByMonth', () => {
  it('日付の属する月に振り分ける（月末・年またぎ）', () => {
    const groups = groupSetsByMonth([
      set('a', '2026-11-30'),
      set('b', '2026-12-01'),
      set('c', '2026-12-31'),
      set('d', '2027-01-01'),
    ]);
    expect(Object.fromEntries([...groups].map(([k, v]) => [k, v.map((s) => s.id)]))).toEqual({
      '2026-11': ['a'],
      '2026-12': ['b', 'c'],
      '2027-01': ['d'],
    });
  });
});

describe('serialize / parse', () => {
  it('種目は作成順、整形された JSON で末尾改行', () => {
    const text = serializeExercises([exercise('b', '2026-01-02T00:00:00.000Z'), exercise('a', T1)]);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.startsWith('[\n  {\n    "id": "a",')).toBe(true);
    expect(parseExercises(text).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('並び順に関係なく同じ内容なら同じ文字列になる', () => {
    const a = set('s1', '2026-11-23', 'ex-1', 1);
    const b = set('s2', '2026-11-23', 'ex-1', 2);
    const c = set('s3', '2026-11-20', 'ex-2', 1);
    expect(serializeSets([a, b, c])).toBe(serializeSets([c, b, a]));
    expect(parseSets(serializeSets([a, b, c]), 'logs/2026-11.json').map((s) => s.id)).toEqual([
      's3',
      's1',
      's2',
    ]);
  });

  it('往復しても同じ', () => {
    const sets = [set('s1', '2026-11-23'), { ...set('s2', '2026-11-24'), deletedAt: T1 }];
    expect(parseSets(serializeSets(sets), 'p')).toEqual(sets);
  });

  it('余計なフィールドは落とし、決まった順のフィールドにする', () => {
    const text = JSON.stringify([{ ...exercise('a', T1), extra: 'x' }]);
    expect(Object.keys(parseExercises(text)[0] ?? {})).toEqual([
      'id',
      'name',
      'bodyPart',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]);
  });

  it('不正な JSON・形は例外', () => {
    expect(() => parseExercises('{')).toThrow('JSON を読めません');
    expect(() => parseExercises('{}')).toThrow('形式が正しくありません');
    expect(() => parseExercises(JSON.stringify([{ ...exercise('a', T1), bodyPart: 'push' }]))).toThrow(
      '1 件目',
    );
    expect(() => parseSets(JSON.stringify([{ ...set('s', '2026-11-23'), reps: '10' }]), 'p')).toThrow();
    expect(() => parseSets(JSON.stringify([{ ...set('s', '2026-02-30') }]), 'p')).toThrow();
    const withoutNote: Record<string, unknown> = { ...set('s', '2026-11-23') };
    delete withoutNote.note;
    expect(() => parseSets(JSON.stringify([withoutNote]), 'p')).toThrow();
  });
});

describe('Base64（UTF-8）', () => {
  it('日本語を含めて往復できる', () => {
    const text = '[{"name":"ベンチプレス","note":"きつい💪"}]\n';
    expect(decodeBase64Utf8(encodeBase64Utf8(text))).toBe(text);
  });

  it('GitHub が入れる改行を無視する', () => {
    const encoded = encodeBase64Utf8('あいうえお'.repeat(20));
    const wrapped = encoded.replace(/(.{60})/g, '$1\n');
    expect(decodeBase64Utf8(wrapped)).toBe('あいうえお'.repeat(20));
  });

  it('大きな文字列でも変換できる', () => {
    const text = 'テスト'.repeat(50000);
    expect(decodeBase64Utf8(encodeBase64Utf8(text))).toBe(text);
  });
});
