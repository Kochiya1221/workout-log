import type { Exercise } from '../domain/exercise';
import type { SetLog } from '../domain/setLog';

/**
 * 保存先。削除も deletedAt を立てたものを put で上書きする（物理削除はしない）。
 * 本番は IndexedDB 実装（indexedDb.ts）、使えない環境とテストではメモリ実装を使う。
 */
export interface Repository<T extends { readonly id: string }> {
  /** 削除済みを含むすべてを返す。 */
  list(): Promise<T[]>;
  /** 同じ id があれば上書き、なければ追加する。 */
  put(item: T): Promise<void>;
  /** まとめて保存する。全部成功するか、全部失敗する。 */
  putMany(items: readonly T[]): Promise<void>;
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
    putMany(items) {
      for (const item of items) {
        store.set(item.id, item);
      }
      return Promise.resolve();
    },
  };
}
