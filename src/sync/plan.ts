import type { SetLog } from '../domain/setLog';
import type { SyncState } from '../storage/settingsStore';
import { groupSetsByMonth, logPath, monthOfLogPath } from './files';

export interface RemoteFile {
  readonly path: string;
  readonly sha: string;
}

/**
 * 同期する月ごとのファイルを決める（古い月から順）。
 * 対象 = 端末にある月 + リモートにある月（新しい端末への復元のため）。
 * ただし「リモートの sha が前回同期時と同じ」かつ「前回同期以降に端末で変更が無い」月は飛ばす。
 */
export function logFilesToSync(
  localSets: readonly SetLog[],
  remoteLogs: readonly RemoteFile[],
  state: SyncState,
): string[] {
  const localByMonth = groupSetsByMonth(localSets);
  const remoteSha = new Map<string, string>();
  for (const f of remoteLogs) {
    if (monthOfLogPath(f.path) !== null) {
      remoteSha.set(f.path, f.sha);
    }
  }
  const paths = new Set<string>([...[...localByMonth.keys()].map(logPath), ...remoteSha.keys()]);

  return [...paths].sort().filter((path) => {
    const previous = state.files[path];
    const sha = remoteSha.get(path);
    if (!previous || sha === undefined || sha !== previous.sha) {
      return true;
    }
    const month = monthOfLogPath(path);
    const local = month === null ? [] : (localByMonth.get(month) ?? []);
    return local.some((s) => s.updatedAt > previous.syncedAt);
  });
}
