import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { createExercise, type Exercise } from '../domain/exercise';
import { createSetLog, type SetLog } from '../domain/setLog';
import { STORES, createIndexedDbRepository, openDatabase } from './indexedDb';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';

function exercise(id: string, name: string): Exercise {
  return createExercise({ name, bodyPart: 'chest' }, { id, now: T1 });
}

function setLog(id: string, setNo: number): SetLog {
  return createSetLog(
    { date: '2026-11-23', exerciseId: 'ex-1', setNo, weightKg: 50, reps: 10, note: '' },
    { id, now: T1 },
  );
}

let factory: IDBFactory;

beforeEach(() => {
  // テストごとに空の IndexedDB を使う
  factory = new IDBFactory();
});

async function open() {
  const db = await openDatabase('test-db', factory);
  return {
    db,
    exercises: createIndexedDbRepository<Exercise>(db, STORES.exercises),
    sets: createIndexedDbRepository<SetLog>(db, STORES.sets),
  };
}

describe('IndexedDB リポジトリ', () => {
  it('最初は空', async () => {
    const { exercises, sets } = await open();
    expect(await exercises.list()).toEqual([]);
    expect(await sets.list()).toEqual([]);
  });

  it('put したものを list で返し、同じ id は上書きする', async () => {
    const { exercises } = await open();
    await exercises.put(exercise('id-1', 'テスト種目A'));
    await exercises.put(exercise('id-2', 'テスト種目B'));
    await exercises.put({ ...exercise('id-1', 'テスト種目A2'), updatedAt: T2 });

    const list = await exercises.list();
    expect(list).toHaveLength(2);
    expect(list.find((e) => e.id === 'id-1')).toMatchObject({ name: 'テスト種目A2', updatedAt: T2 });
  });

  it('putMany で複数件を保存し、空配列でもエラーにならない', async () => {
    const { sets } = await open();
    await sets.putMany([setLog('s1', 1), setLog('s2', 2), setLog('s3', 3)]);
    await sets.putMany([]);
    expect((await sets.list()).map((s) => s.id).sort()).toEqual(['s1', 's2', 's3']);
  });

  it('閉じて開き直してもデータが残る（再読み込み相当）', async () => {
    const first = await open();
    await first.exercises.put(exercise('id-1', 'テスト種目A'));
    await first.sets.put(setLog('s1', 1));
    first.db.close();

    const second = await open();
    expect(await second.exercises.list()).toEqual([exercise('id-1', 'テスト種目A')]);
    expect(await second.sets.list()).toEqual([setLog('s1', 1)]);
  });

  it('種目とセットは別のストアで混ざらない', async () => {
    const { exercises, sets } = await open();
    await exercises.put(exercise('same-id', 'テスト種目A'));
    await sets.put({ ...setLog('same-id', 1) });
    expect(await exercises.list()).toHaveLength(1);
    expect((await sets.list())[0]?.setNo).toBe(1);
    expect((await exercises.list())[0]?.name).toBe('テスト種目A');
  });

  it('putMany の途中に不正なデータがあると、すべて取り消す', async () => {
    const { sets } = await open();
    await sets.put(setLog('s0', 1));
    const broken = { setNo: 9 } as unknown as SetLog; // id がない
    await expect(sets.putMany([setLog('s1', 2), broken, setLog('s3', 3)])).rejects.toThrow();
    expect((await sets.list()).map((s) => s.id)).toEqual(['s0']);
  });
});
