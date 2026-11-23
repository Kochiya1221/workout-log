import { SETTINGS_STORE, requestToPromise, transactionDone } from './indexedDb';

/** GitHub 同期の設定。端末内だけに保存する（リポジトリには入れない）。 */
export interface SyncConfig {
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
  /** 書き込み用トークン。未設定なら null */
  readonly token: string | null;
}

export interface SyncedFile {
  readonly sha: string;
  /** そのファイルを最後に同期した時刻（ISO 8601） */
  readonly syncedAt: string;
}

/** 前回の同期の記録。 */
export interface SyncState {
  readonly lastSyncedAt: string | null;
  readonly files: Readonly<Record<string, SyncedFile>>;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  owner: '',
  repo: 'workout-log-data',
  branch: 'main',
  token: null,
};

export const EMPTY_SYNC_STATE: SyncState = { lastSyncedAt: null, files: {} };

/** キーと値で保存する小さな保存先。 */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export function createIndexedDbKeyValueStore(db: IDBDatabase): KeyValueStore {
  return {
    async get(key) {
      const tx = db.transaction(SETTINGS_STORE, 'readonly');
      const row: unknown = await requestToPromise(tx.objectStore(SETTINGS_STORE).get(key));
      return isRecord(row) ? row.value : undefined;
    },
    async set(key, value) {
      const tx = db.transaction(SETTINGS_STORE, 'readwrite');
      const done = transactionDone(tx);
      tx.objectStore(SETTINGS_STORE).put({ key, value });
      await done;
    },
  };
}

export function createMemoryKeyValueStore(): KeyValueStore {
  const map = new Map<string, unknown>();
  return {
    get(key) {
      return Promise.resolve(map.get(key));
    },
    set(key, value) {
      map.set(key, structuredClone(value));
      return Promise.resolve();
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

const CONFIG_KEY = 'sync';
const STATE_KEY = 'syncState';

export interface SettingsStore {
  getSyncConfig(): Promise<SyncConfig>;
  /** token が null のときは、保存済みのトークンをそのまま残す。 */
  saveSyncConfig(input: Omit<SyncConfig, 'token'> & { readonly token: string | null }): Promise<SyncConfig>;
  clearToken(): Promise<void>;
  getSyncState(): Promise<SyncState>;
  saveSyncState(state: SyncState): Promise<void>;
}

export function createSettingsStore(kv: KeyValueStore): SettingsStore {
  async function getSyncConfig(): Promise<SyncConfig> {
    const raw = await kv.get(CONFIG_KEY);
    if (!isRecord(raw)) {
      return DEFAULT_SYNC_CONFIG;
    }
    const token = typeof raw.token === 'string' && raw.token !== '' ? raw.token : null;
    return {
      owner: str(raw.owner, DEFAULT_SYNC_CONFIG.owner),
      repo: str(raw.repo, DEFAULT_SYNC_CONFIG.repo),
      branch: str(raw.branch, DEFAULT_SYNC_CONFIG.branch),
      token,
    };
  }

  return {
    getSyncConfig,
    async saveSyncConfig(input) {
      const current = await getSyncConfig();
      const next: SyncConfig = {
        owner: input.owner.trim(),
        repo: input.repo.trim(),
        branch: input.branch.trim(),
        token: input.token === null || input.token.trim() === '' ? current.token : input.token.trim(),
      };
      await kv.set(CONFIG_KEY, next);
      return next;
    },
    async clearToken() {
      const current = await getSyncConfig();
      await kv.set(CONFIG_KEY, { ...current, token: null });
    },
    async getSyncState() {
      const raw = await kv.get(STATE_KEY);
      if (!isRecord(raw) || !isRecord(raw.files)) {
        return EMPTY_SYNC_STATE;
      }
      const files: Record<string, SyncedFile> = {};
      for (const [path, value] of Object.entries(raw.files)) {
        if (isRecord(value) && typeof value.sha === 'string' && typeof value.syncedAt === 'string') {
          files[path] = { sha: value.sha, syncedAt: value.syncedAt };
        }
      }
      return {
        lastSyncedAt: typeof raw.lastSyncedAt === 'string' ? raw.lastSyncedAt : null,
        files,
      };
    },
    async saveSyncState(state) {
      await kv.set(STATE_KEY, state);
    },
  };
}

/** 画面表示用に伏せ字にする（先頭の種類と末尾4文字だけ見せる）。 */
export function maskToken(token: string): string {
  const prefix = /^(github_pat_|ghp_)/.exec(token)?.[1] ?? '';
  const tail = token.length > prefix.length + 4 ? token.slice(-4) : '';
  return `${prefix}…${tail}`;
}
