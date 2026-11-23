import type { Repository } from './repository';

export const DB_NAME = 'workout-log';
/** 1: exercises / sets、2: settings を追加、3: days を追加 */
export const DB_VERSION = 3;
export const STORES = { exercises: 'exercises', sets: 'sets', days: 'days' } as const;
export type StoreName = (typeof STORES)[keyof typeof STORES];
/** 端末だけに置く設定（同期設定・同期状態）。keyPath は 'key'。 */
export const SETTINGS_STORE = 'settings';

/** IDBRequest の結果を Promise で返す。 */
export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB の要求に失敗しました'));
    };
  });
}

/** トランザクションの完了（コミット）を待つ。失敗・中断なら reject。 */
export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error ?? new Error('IndexedDB への保存に失敗しました'));
    };
    tx.onabort = () => {
      reject(tx.error ?? new Error('IndexedDB への保存が中断されました'));
    };
  });
}

/** データベースを開く（初回はストアを作る）。 */
export function openDatabase(
  name: string = DB_NAME,
  factory: IDBFactory = indexedDB,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(name, DB_VERSION);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      // 無いストアだけを作る（既存のデータはそのまま）
      for (const store of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // 別のタブが新しいバージョンで開こうとしたら、こちらは閉じて譲る
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB を開けませんでした'));
    };
    // 古い版を開いている他のタブがあると一時的に blocked になる。
    // 相手は onversionchange で閉じるので、失敗にはせず success を待つ
    request.onblocked = () => {
      console.warn('IndexedDB: 他のタブが閉じるのを待っています');
    };
  });
}

/** IndexedDB の1つのストアを保存先として使う。 */
export function createIndexedDbRepository<T extends { readonly id: string }>(
  db: IDBDatabase,
  storeName: StoreName,
): Repository<T> {
  async function write(items: readonly T[]): Promise<void> {
    const tx = db.transaction(storeName, 'readwrite');
    const done = transactionDone(tx);
    const store = tx.objectStore(storeName);
    try {
      for (const item of items) {
        store.put(item);
      }
    } catch (error) {
      // put が同期的に失敗した場合（不正なデータなど）は、すべて取り消す
      tx.abort();
      await done.catch(() => undefined);
      throw error;
    }
    await done;
  }

  return {
    async list() {
      const tx = db.transaction(storeName, 'readonly');
      return (await requestToPromise(tx.objectStore(storeName).getAll())) as T[];
    },
    put(item) {
      return write([item]);
    },
    putMany(items) {
      return write(items);
    },
  };
}
