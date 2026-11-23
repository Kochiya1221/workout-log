import type { SyncResult } from './syncEngine';
import { toSyncError } from './syncError';

export type SyncPhase = 'unconfigured' | 'idle' | 'syncing' | 'ok' | 'offline' | 'error';

export interface SyncStatus {
  readonly phase: SyncPhase;
  readonly lastSyncedAt: string | null;
  /** offline / error のときの説明 */
  readonly message: string | null;
}

export interface SyncSchedulerOptions {
  /** 同期できる設定（トークンなど）が揃っているか */
  readonly isConfigured: () => Promise<boolean>;
  readonly sync: () => Promise<SyncResult>;
  readonly initialLastSyncedAt: string | null;
  /** 変更から同期までの待ち時間 */
  readonly delayMs?: number;
  readonly now?: () => string;
  /** 同期で端末側のデータが変わったとき */
  readonly onPulled?: (count: number) => void;
}

export interface SyncScheduler {
  /** データが変わったことを知らせる（delayMs 後に同期。続けて変わったらまとめる） */
  notifyChange(): void;
  /** すぐに同期する（同期中なら、終わったあともう一度） */
  syncNow(): Promise<void>;
  /** 同期を止める（トークン削除時） */
  cancelPending(): void;
  getStatus(): SyncStatus;
  subscribe(listener: (status: SyncStatus) => void): () => void;
}

export function createSyncScheduler(options: SyncSchedulerOptions): SyncScheduler {
  const delayMs = options.delayMs ?? 5000;
  const now = options.now ?? (() => new Date().toISOString());
  const listeners = new Set<(status: SyncStatus) => void>();
  let status: SyncStatus = {
    phase: 'idle',
    lastSyncedAt: options.initialLastSyncedAt,
    message: null,
  };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  /** 同期中に変更・同期要求があったか（終わったあともう一度実行する） */
  let again = false;
  const takeAgain = (): boolean => {
    const value = again;
    again = false;
    return value;
  };

  function setStatus(next: Partial<SyncStatus>): void {
    status = { ...status, ...next };
    for (const listener of listeners) {
      listener(status);
    }
  }

  async function runOnce(): Promise<void> {
    if (!(await options.isConfigured())) {
      setStatus({ phase: 'unconfigured', message: null });
      return;
    }
    setStatus({ phase: 'syncing', message: null });
    try {
      const result = await options.sync();
      setStatus({ phase: 'ok', lastSyncedAt: now(), message: null });
      if (result.pulled > 0) {
        options.onPulled?.(result.pulled);
      }
    } catch (error) {
      const e = toSyncError(error);
      if (e.kind !== 'network') {
        console.error(`同期エラー: ${e.kind}`);
      }
      setStatus({ phase: e.kind === 'network' ? 'offline' : 'error', message: e.message });
    }
  }

  function syncNow(): Promise<void> {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        again = false;
        do {
          await runOnce();
        } while (takeAgain());
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return {
    notifyChange() {
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        void syncNow();
      }, delayMs);
    },
    syncNow,
    cancelPending() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      again = false;
    },
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
