import type { GitHubClient, RemoteContent } from '../sync/githubClient';
import { SYNC_MESSAGES, SyncError } from '../sync/syncError';

/** テスト用の偽 GitHub。ファイルをメモリに持ち、sha で競合を検知する。 */
export interface FakeGitHub extends GitHubClient {
  readonly files: Map<string, RemoteContent>;
  isPrivate: boolean;
  canPush: boolean;
  putCount: number;
  /** putFile の直前に呼ばれる（同時更新の再現用） */
  beforePut: ((path: string) => void) | null;
  /** 外から書き込む（別の端末の更新の再現用） */
  write(path: string, content: string): void;
}

export function createFakeGitHub(): FakeGitHub {
  let counter = 0;
  const nextSha = (): string => `sha-${String(++counter)}`;
  const fake: FakeGitHub = {
    files: new Map(),
    isPrivate: true,
    canPush: true,
    putCount: 0,
    beforePut: null,
    write(path, content) {
      fake.files.set(path, { content, sha: nextSha() });
    },
    getRepo() {
      return Promise.resolve({ private: fake.isPrivate, canPush: fake.canPush });
    },
    listLogs() {
      return Promise.resolve(
        [...fake.files.entries()]
          .filter(([path]) => path.startsWith('logs/'))
          .map(([path, f]) => ({ path, sha: f.sha })),
      );
    },
    getFile(path) {
      return Promise.resolve(fake.files.get(path) ?? null);
    },
    putFile(path, content, sha) {
      fake.beforePut?.(path);
      const current = fake.files.get(path);
      if ((current?.sha ?? null) !== sha) {
        return Promise.reject(new SyncError('conflict', SYNC_MESSAGES.conflict));
      }
      fake.putCount++;
      const newSha = nextSha();
      fake.files.set(path, { content, sha: newSha });
      return Promise.resolve(newSha);
    },
  };
  return fake;
}
