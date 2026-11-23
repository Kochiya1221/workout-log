import './style.css';
import type { Exercise } from './domain/exercise';
import type { SetLog } from './domain/setLog';
import { STORES, createIndexedDbRepository, openDatabase } from './storage/indexedDb';
import { requestPersistentStorage } from './storage/persist';
import {
  createMemoryRepository,
  withChangeNotifier,
  type ExerciseRepository,
  type SetLogRepository,
} from './storage/repository';
import {
  createIndexedDbKeyValueStore,
  createMemoryKeyValueStore,
  createSettingsStore,
  type SettingsStore,
} from './storage/settingsStore';
import { createGitHubClient } from './sync/githubClient';
import { runSync } from './sync/syncEngine';
import { createSyncScheduler } from './sync/syncScheduler';
import { mountExerciseScreen } from './ui/exerciseScreen';
import { mountHistoryScreen } from './ui/historyScreen';
import { showError, showPermanentWarning } from './ui/notice';
import { mountRecordScreen } from './ui/recordScreen';
import { startRouter, type Router } from './ui/router';
import { mountSettingsScreen } from './ui/settingsScreen';

interface Storage {
  readonly exercises: ExerciseRepository;
  readonly sets: SetLogRepository;
  readonly settings: SettingsStore;
}

/** IndexedDB を開く。使えない環境ではメモリ保存に切り替えて警告を出す。 */
async function openStorage(): Promise<Storage> {
  try {
    const db = await openDatabase();
    void requestPersistentStorage();
    return {
      exercises: createIndexedDbRepository<Exercise>(db, STORES.exercises),
      sets: createIndexedDbRepository<SetLog>(db, STORES.sets),
      settings: createSettingsStore(createIndexedDbKeyValueStore(db)),
    };
  } catch (error) {
    console.error(error);
    showPermanentWarning('この端末では記録を保存できません。再読み込みすると消えます');
    return {
      exercises: createMemoryRepository<Exercise>(),
      sets: createMemoryRepository<SetLog>(),
      settings: createSettingsStore(createMemoryKeyValueStore()),
    };
  }
}

async function main(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) {
    throw new Error('#app が見つかりません');
  }

  const storage = await openStorage();
  const { settings } = storage;
  let router: Router | null = null;

  const scheduler = createSyncScheduler({
    isConfigured: async () => {
      const config = await settings.getSyncConfig();
      return config.token !== null && config.owner !== '';
    },
    sync: async () => {
      const config = await settings.getSyncConfig();
      if (config.token === null) {
        throw new Error('トークンが設定されていません');
      }
      return runSync({
        client: createGitHubClient({ ...config, token: config.token }),
        // 同期での書き戻しは、変更通知を付けていない保存先に書く（同期が繰り返されないように）
        exercises: storage.exercises,
        sets: storage.sets,
        loadState: () => settings.getSyncState(),
        saveState: (state) => settings.saveSyncState(state),
        now: () => new Date().toISOString(),
      });
    },
    initialLastSyncedAt: (await settings.getSyncState()).lastSyncedAt,
    onPulled: () => {
      router?.refresh();
    },
  });

  // 同期エラーは画面上部にも出す（同じエラーは続けて出さない）
  let lastShown: string | null = null;
  scheduler.subscribe((status) => {
    if (status.phase === 'error' && status.message !== null && status.message !== lastShown) {
      lastShown = status.message;
      showError(`同期できませんでした: ${status.message}`);
    } else if (status.phase === 'ok') {
      lastShown = null;
    }
  });

  // 画面からの保存は、変更を知らせて数秒後に自動同期する
  const notify = (): void => {
    scheduler.notifyChange();
  };
  const repos = {
    exercises: withChangeNotifier(storage.exercises, notify),
    sets: withChangeNotifier(storage.sets, notify),
  };

  router = startRouter(app, [
    { path: '/record', label: '記録', mount: (c) => mountRecordScreen(c, repos) },
    { path: '/history', label: '履歴', mount: (c) => mountHistoryScreen(c, repos) },
    { path: '/exercises', label: '種目', mount: (c) => mountExerciseScreen(c, repos.exercises) },
    {
      path: '/settings',
      label: '設定',
      mount: (c) =>
        mountSettingsScreen(c, {
          settings,
          scheduler,
          createClient: (target) => createGitHubClient(target),
        }),
    },
  ]);

  // 起動時・通信が戻ったとき・アプリが前面に戻ったときに同期する
  void scheduler.syncNow();
  window.addEventListener('online', () => {
    void scheduler.syncNow();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void scheduler.syncNow();
    }
  });
}

void main();
