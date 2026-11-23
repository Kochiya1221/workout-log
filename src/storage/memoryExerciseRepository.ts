import type { Exercise } from '../domain/exercise';
import type { ExerciseRepository } from './exerciseRepository';

/** メモリ上だけに保存する実装（ページを再読み込みすると消える）。 */
export function createMemoryExerciseRepository(): ExerciseRepository {
  const store = new Map<string, Exercise>();
  return {
    list() {
      return Promise.resolve([...store.values()]);
    },
    put(exercise) {
      store.set(exercise.id, exercise);
      return Promise.resolve();
    },
  };
}
