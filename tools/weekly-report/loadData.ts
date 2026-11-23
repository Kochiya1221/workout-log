import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  DAYS_PATH,
  EXERCISES_PATH,
  LOGS_DIR,
  monthOfLogPath,
  parseDays,
  parseExercises,
  parseSets,
} from '../../src/sync/files';
import type { WorkoutData } from './analyze';

function readIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

/**
 * workout-log-data のフォルダから記録を読む。
 * 無いファイルは空として扱い、形が不正なら例外（アプリの同期と同じ検証）。
 */
export function loadWorkoutData(dataDir: string): WorkoutData {
  if (!existsSync(dataDir)) {
    throw new Error(`データのフォルダが見つかりません: ${dataDir}`);
  }
  const exercisesText = readIfExists(join(dataDir, EXERCISES_PATH));
  const daysText = readIfExists(join(dataDir, DAYS_PATH));
  const logsDir = join(dataDir, LOGS_DIR);
  const logFiles = existsSync(logsDir)
    ? readdirSync(logsDir)
        .map((name) => `${LOGS_DIR}/${name}`)
        .filter((path) => monthOfLogPath(path) !== null)
        .sort()
    : [];
  return {
    exercises: exercisesText === null ? [] : parseExercises(exercisesText),
    days: daysText === null ? [] : parseDays(daysText),
    sets: logFiles.flatMap((path) => parseSets(readFileSync(join(dataDir, path), 'utf8'), path)),
  };
}
