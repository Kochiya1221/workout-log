import './style.css';
import { createMemoryExerciseRepository } from './storage/memoryExerciseRepository';
import { mountExerciseScreen } from './ui/exerciseScreen';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('#app が見つかりません');
}

void mountExerciseScreen(app, createMemoryExerciseRepository());
