import type { Exercise } from '../domain/exercise';
import type { SetLog } from '../domain/setLog';

/**
 * 保存先。削除も deletedAt を立てたものを put で上書きする（物理削除はしない）。
 * M5 までメモリ実装、M5 で IndexedDB 実装に差し替える。
 */
export interface Repository<T extends { readonly id: string }> {
  /** 削除済みを含むすべてを返す。 */
  list(): Promise<T[]>;
  /** 同じ id があれば上書き、なければ追加する。 */
  put(item: T): Promise<void>;
}

export type ExerciseRepository = Repository<Exercise>;
export type SetLogRepository = Repository<SetLog>;

/** メモリ上だけに保存する実装（ページを再読み込みすると消える）。 */
export function createMemoryRepository<T extends { readonly id: string }>(): Repository<T> {
  const store = new Map<string, T>();
  return {
    list() {
      return Promise.resolve([...store.values()]);
    },
    put(item) {
      store.set(item.id, item);
      return Promise.resolve();
    },
  };
}
