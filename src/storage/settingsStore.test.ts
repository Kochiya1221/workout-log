import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { STORES, createIndexedDbRepository, openDatabase } from './indexedDb';
import {
  DEFAULT_SYNC_CONFIG,
  EMPTY_SYNC_STATE,
  createIndexedDbKeyValueStore,
  createMemoryKeyValueStore,
  createSettingsStore,
  maskToken,
} from './settingsStore';

const base = { owner: 'test-owner', repo: 'test-repo', branch: 'main' };

describe('settingsStore', () => {
  it('未保存なら初期値', async () => {
    const store = createSettingsStore(createMemoryKeyValueStore());
    expect(await store.getSyncConfig()).toEqual(DEFAULT_SYNC_CONFIG);
    expect(await store.getSyncState()).toEqual(EMPTY_SYNC_STATE);
  });

  it('保存して読み込める（前後の空白は除く）', async () => {
    const store = createSettingsStore(createMemoryKeyValueStore());
    await store.saveSyncConfig({ owner: ' test-owner ', repo: 'test-repo', branch: 'main', token: ' test-token ' });
    expect(await store.getSyncConfig()).toEqual({ ...base, token: 'test-token' });
  });

  it('トークンが空欄・null なら保存済みのトークンを残す', async () => {
    const store = createSettingsStore(createMemoryKeyValueStore());
    await store.saveSyncConfig({ ...base, token: 'test-token' });
    await store.saveSyncConfig({ ...base, repo: 'test-repo-2', token: '' });
    expect(await store.getSyncConfig()).toEqual({ ...base, repo: 'test-repo-2', token: 'test-token' });
    await store.saveSyncConfig({ ...base, token: null });
    expect((await store.getSyncConfig()).token).toBe('test-token');
  });

  it('トークンを削除できる（他の設定は残る）', async () => {
    const store = createSettingsStore(createMemoryKeyValueStore());
    await store.saveSyncConfig({ ...base, token: 'test-token' });
    await store.clearToken();
    expect(await store.getSyncConfig()).toEqual({ ...base, token: null });
  });

  it('同期状態を保存して読み込める', async () => {
    const store = createSettingsStore(createMemoryKeyValueStore());
    const state = {
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
      files: { 'exercises.json': { sha: 'sha-1', syncedAt: '2026-01-01T00:00:00.000Z' } },
    };
    await store.saveSyncState(state);
    expect(await store.getSyncState()).toEqual(state);
  });

  it('IndexedDB に保存し、開き直しても残る', async () => {
    const factory = new IDBFactory();
    const db1 = await openDatabase('test-db', factory);
    await createSettingsStore(createIndexedDbKeyValueStore(db1)).saveSyncConfig({ ...base, token: 'test-token' });
    db1.close();
    const db2 = await openDatabase('test-db', factory);
    expect(await createSettingsStore(createIndexedDbKeyValueStore(db2)).getSyncConfig()).toEqual({
      ...base,
      token: 'test-token',
    });
  });

  it('バージョン1の DB（設定ストアなし）から開き直しても、既存の記録は残る', async () => {
    const factory = new IDBFactory();
    // バージョン1の DB を手で作る
    await new Promise<void>((resolve, reject) => {
      const req = factory.open('test-db', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('exercises', { keyPath: 'id' });
        req.result.createObjectStore('sets', { keyPath: 'id' });
        req.result.createObjectStore('dummy');
      };
      req.onsuccess = () => {
        const tx = req.result.transaction('exercises', 'readwrite');
        tx.objectStore('exercises').put({ id: 'id-1', name: 'テスト種目A' });
        tx.oncomplete = () => {
          req.result.close();
          resolve();
        };
      };
      req.onerror = () => {
        reject(new Error('open failed'));
      };
    });
    const db = await openDatabase('test-db', factory);
    expect(db.objectStoreNames.contains('settings')).toBe(true);
    expect(db.objectStoreNames.contains('days')).toBe(true);
    const list = await createIndexedDbRepository<{ id: string }>(db, STORES.exercises).list();
    expect(list.map((e) => e.id)).toEqual(['id-1']);
  });
});

describe('maskToken', () => {
  it('種類と末尾4文字だけを見せる', () => {
    expect(maskToken('github_pat_DUMMY_FOR_TEST_1234')).toBe('github_pat_…1234');
    expect(maskToken('ghp_DUMMY_9876')).toBe('ghp_…9876');
    expect(maskToken('test-token-xyz')).toBe('…-xyz');
    expect(maskToken('abc')).toBe('…');
  });
});
