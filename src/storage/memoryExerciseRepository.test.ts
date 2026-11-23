import { describe, expect, it } from 'vitest';
import { createExercise, deleteExercise } from '../domain/exercise';
import { createMemoryExerciseRepository } from './memoryExerciseRepository';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';

describe('createMemoryExerciseRepository', () => {
  it('最初は空', async () => {
    const repo = createMemoryExerciseRepository();
    expect(await repo.list()).toEqual([]);
  });

  it('put した種目を list で返し、同じ id は上書きする', async () => {
    const repo = createMemoryExerciseRepository();
    const a = createExercise({ name: 'テスト種目A', bodyPart: 'chest' }, { id: 'id-1', now: T1 });
    const b = createExercise({ name: 'テスト種目B', bodyPart: 'legs' }, { id: 'id-2', now: T1 });
    await repo.put(a);
    await repo.put(b);
    await repo.put(deleteExercise(a, T2));

    const list = await repo.list();
    expect(list).toHaveLength(2);
    expect(list.find((e) => e.id === 'id-1')?.deletedAt).toBe(T2);
  });
});
