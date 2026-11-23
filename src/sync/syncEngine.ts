import type { Exercise } from '../domain/exercise';
import type { SetLog } from '../domain/setLog';
import type { TrainingDay } from '../domain/trainingDay';
import type { Repository } from '../storage/repository';
import type { SyncState, SyncedFile } from '../storage/settingsStore';
import {
  DAYS_PATH,
  EXERCISES_PATH,
  monthKey,
  monthOfLogPath,
  parseDays,
  parseExercises,
  parseSets,
  serializeDays,
  serializeExercises,
  serializeSets,
} from './files';
import type { GitHubClient } from './githubClient';
import { mergeById, type Versioned } from './merge';
import { logFilesToSync } from './plan';
import { SYNC_MESSAGES, SyncError } from './syncError';

export interface SyncDeps {
  readonly client: GitHubClient;
  /** 変更通知を付けていない保存先（同期で書き戻しても自動同期が再度走らないように） */
  readonly exercises: Repository<Exercise>;
  readonly sets: Repository<SetLog>;
  readonly days: Repository<TrainingDay>;
  readonly loadState: () => Promise<SyncState>;
  readonly saveState: (state: SyncState) => Promise<void>;
  readonly now: () => string;
}

export interface SyncResult {
  /** リモートから端末に取り込んだ件数 */
  readonly pulled: number;
  /** 書き込んだファイル */
  readonly pushedFiles: readonly string[];
  /** 確認したファイル（書き込み不要だったものを含む） */
  readonly checkedFiles: readonly string[];
}

const MAX_ATTEMPTS = 3;

interface FileSpec<T extends Versioned> {
  readonly path: string;
  readonly loadLocal: () => Promise<T[]>;
  readonly parse: (text: string) => T[];
  readonly serialize: (items: readonly T[]) => string;
  readonly writeLocal: (items: readonly T[]) => Promise<void>;
}

interface FileOutcome {
  readonly pulled: number;
  readonly pushed: boolean;
  /** ファイルが存在しない（どちらにもデータが無い）なら null */
  readonly synced: SyncedFile | null;
}

/** 1ファイルを同期する: 取得 → マージ → 端末へ書き戻し → 差分があれば sha 付きで書き込み。 */
async function syncFile<T extends Versioned>(
  deps: SyncDeps,
  spec: FileSpec<T>,
): Promise<FileOutcome> {
  let pulled = 0;
  for (let attempt = 1; ; attempt++) {
    const startedAt = deps.now();
    const remote = await deps.client.getFile(spec.path);
    let remoteItems: T[];
    try {
      remoteItems = remote ? spec.parse(remote.content) : [];
    } catch (error) {
      // 壊れたファイルで端末のデータを変えない
      throw new SyncError(
        'invalidData',
        error instanceof Error ? error.message : `${spec.path} の形式が正しくありません`,
      );
    }

    const { merged, toLocal } = mergeById(await spec.loadLocal(), remoteItems);
    if (toLocal.length > 0) {
      await spec.writeLocal(toLocal);
      pulled += toLocal.length;
    }

    if (!remote && merged.length === 0) {
      return { pulled, pushed: false, synced: null };
    }
    const content = spec.serialize(merged);
    if (remote && content === spec.serialize(remoteItems)) {
      return { pulled, pushed: false, synced: { sha: remote.sha, syncedAt: startedAt } };
    }
    try {
      const sha = await deps.client.putFile(
        spec.path,
        content,
        remote?.sha ?? null,
        `同期: ${spec.path}`,
      );
      return { pulled, pushed: true, synced: { sha, syncedAt: startedAt } };
    } catch (error) {
      // 取得してから書き込むまでに更新されていたら、取得からやり直す
      if (error instanceof SyncError && error.kind === 'conflict' && attempt < MAX_ATTEMPTS) {
        continue;
      }
      throw error;
    }
  }
}

/** 端末（IndexedDB）と GitHub の非公開リポジトリを同期する。 */
export async function runSync(deps: SyncDeps): Promise<SyncResult> {
  const repo = await deps.client.getRepo();
  if (!repo.private) {
    // 記録データは公開リポジトリに絶対に入れない
    throw new SyncError('publicRepo', SYNC_MESSAGES.publicRepo);
  }
  if (!repo.canPush) {
    throw new SyncError('forbidden', SYNC_MESSAGES.noPush);
  }

  const state = await deps.loadState();
  const files: Record<string, SyncedFile> = { ...state.files };
  let pulled = 0;
  const pushedFiles: string[] = [];
  const checkedFiles: string[] = [];

  async function record(path: string, outcome: FileOutcome): Promise<void> {
    pulled += outcome.pulled;
    checkedFiles.push(path);
    if (outcome.pushed) {
      pushedFiles.push(path);
    }
    if (outcome.synced) {
      files[path] = outcome.synced;
      // 途中で失敗しても、済んだファイルの記録は残す
      await deps.saveState({ lastSyncedAt: state.lastSyncedAt, files });
    }
  }

  await record(
    EXERCISES_PATH,
    await syncFile(deps, {
      path: EXERCISES_PATH,
      loadLocal: () => deps.exercises.list(),
      parse: parseExercises,
      serialize: serializeExercises,
      writeLocal: (items) => deps.exercises.putMany(items),
    }),
  );

  await record(
    DAYS_PATH,
    await syncFile(deps, {
      path: DAYS_PATH,
      loadLocal: () => deps.days.list(),
      parse: parseDays,
      serialize: serializeDays,
      writeLocal: (items) => deps.days.putMany(items),
    }),
  );

  const remoteLogs = await deps.client.listLogs();
  const paths = logFilesToSync(await deps.sets.list(), remoteLogs, { ...state, files });
  for (const path of paths) {
    const month = monthOfLogPath(path);
    if (month === null) {
      continue;
    }
    await record(
      path,
      await syncFile(deps, {
        path,
        loadLocal: async () => (await deps.sets.list()).filter((s) => monthKey(s.date) === month),
        parse: (text) => {
          const items = parseSets(text, path);
          if (items.some((s) => monthKey(s.date) !== month)) {
            throw new Error(`${path} に別の月の記録が含まれています`);
          }
          return items;
        },
        serialize: serializeSets,
        writeLocal: (items) => deps.sets.putMany(items),
      }),
    );
  }

  await deps.saveState({ lastSyncedAt: deps.now(), files });
  return { pulled, pushedFiles, checkedFiles };
}
