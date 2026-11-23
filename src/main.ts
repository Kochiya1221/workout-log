import './style.css';
import type { Exercise } from './domain/exercise';
import type { SetLog } from './domain/setLog';
import { createMemoryRepository } from './storage/repository';
import { mountExerciseScreen } from './ui/exerciseScreen';
import { mountHistoryScreen } from './ui/historyScreen';
import { mountRecordScreen } from './ui/recordScreen';
import { startRouter } from './ui/router';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('#app が見つかりません');
}

// 両方の画面で同じ保存先を使う
const repos = {
  exercises: createMemoryRepository<Exercise>(),
  sets: createMemoryRepository<SetLog>(),
};

startRouter(app, [
  { path: '/record', label: '記録', mount: (c) => mountRecordScreen(c, repos) },
  { path: '/history', label: '履歴', mount: (c) => mountHistoryScreen(c, repos) },
  { path: '/exercises', label: '種目', mount: (c) => mountExerciseScreen(c, repos.exercises) },
]);
