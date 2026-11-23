import './style.css';
import type { Exercise } from './domain/exercise';
import type { SetLog } from './domain/setLog';
import { STORES, createIndexedDbRepository, openDatabase } from './storage/indexedDb';
import { requestPersistentStorage } from './storage/persist';
import {
  createMemoryRepository,
  type ExerciseRepository,
  type SetLogRepository,
} from './storage/repository';
import { mountExerciseScreen } from './ui/exerciseScreen';
import { mountHistoryScreen } from './ui/historyScreen';
import { showPermanentWarning } from './ui/notice';
import { mountRecordScreen } from './ui/recordScreen';
import { startRouter } from './ui/router';

interface Repos {
  readonly exercises: ExerciseRepository;
  readonly sets: SetLogRepository;
}

/** IndexedDB を開く。使えない環境ではメモリ保存に切り替えて警告を出す。 */
async function openRepos(): Promise<Repos> {
  try {
    const db = await openDatabase();
    void requestPersistentStorage();
    return {
      exercises: createIndexedDbRepository<Exercise>(db, STORES.exercises),
      sets: createIndexedDbRepository<SetLog>(db, STORES.sets),
    };
  } catch (error) {
    console.error(error);
    showPermanentWarning('この端末では記録を保存できません。再読み込みすると消えます');
    return {
      exercises: createMemoryRepository<Exercise>(),
      sets: createMemoryRepository<SetLog>(),
    };
  }
}

async function main(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) {
    throw new Error('#app が見つかりません');
  }

  // すべての画面で同じ保存先を使う
  const repos = await openRepos();

  startRouter(app, [
    { path: '/record', label: '記録', mount: (c) => mountRecordScreen(c, repos) },
    { path: '/history', label: '履歴', mount: (c) => mountHistoryScreen(c, repos) },
    { path: '/exercises', label: '種目', mount: (c) => mountExerciseScreen(c, repos.exercises) },
  ]);
}

void main();
