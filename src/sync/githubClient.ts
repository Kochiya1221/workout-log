import { LOGS_DIR, decodeBase64Utf8, encodeBase64Utf8 } from './files';
import type { RemoteFile } from './plan';
import { SYNC_MESSAGES, SyncError } from './syncError';

export interface GitHubTarget {
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
  readonly token: string;
}

export interface RepoInfo {
  readonly private: boolean;
  readonly canPush: boolean;
}

export interface RemoteContent {
  readonly content: string;
  readonly sha: string;
}

/** 同期に使う GitHub の操作。 */
export interface GitHubClient {
  getRepo(): Promise<RepoInfo>;
  /** logs/ にある月ごとのファイル。フォルダが無ければ空配列。 */
  listLogs(): Promise<RemoteFile[]>;
  /** ファイルが無ければ null。 */
  getFile(path: string): Promise<RemoteContent | null>;
  /** 書き込み、新しい sha を返す。新規作成は sha に null。 */
  putFile(path: string, content: string, sha: string | null, message: string): Promise<string>;
}

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

const API = 'https://api.github.com';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export function createGitHubClient(
  target: GitHubTarget,
  fetchFn: FetchFn = (input, init) => fetch(input, init),
): GitHubClient {
  const repoUrl = `${API}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`;
  const ref = `ref=${encodeURIComponent(target.branch)}`;

  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    let response: Response;
    try {
      response = await fetchFn(url, {
        ...init,
        // ブラウザのキャッシュで古い sha を使わないように
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${target.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
      });
    } catch {
      throw new SyncError('network', SYNC_MESSAGES.network);
    }
    return response;
  }

  /** 失敗したレスポンスを SyncError にする（本文の message だけ使い、トークンは含めない）。 */
  async function fail(response: Response): Promise<never> {
    let detail = '';
    try {
      const body: unknown = await response.json();
      if (isRecord(body) && typeof body.message === 'string') {
        detail = body.message;
      }
    } catch {
      // 本文が JSON でなければ無視
    }
    switch (response.status) {
      case 401:
        throw new SyncError('unauthorized', SYNC_MESSAGES.unauthorized);
      case 403:
        throw new SyncError('forbidden', SYNC_MESSAGES.forbidden);
      case 404:
        throw new SyncError('notFound', SYNC_MESSAGES.notFound);
      case 409:
        throw new SyncError('conflict', SYNC_MESSAGES.conflict);
      case 422:
        if (/sha/i.test(detail)) {
          throw new SyncError('conflict', SYNC_MESSAGES.conflict);
        }
        break;
    }
    throw new SyncError('other', `${SYNC_MESSAGES.other}（HTTP ${String(response.status)}）`);
  }

  async function json(response: Response): Promise<unknown> {
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new SyncError('other', SYNC_MESSAGES.other);
    }
  }

  return {
    async getRepo() {
      const response = await request(repoUrl);
      if (!response.ok) {
        return fail(response);
      }
      const body = await json(response);
      if (!isRecord(body) || typeof body.private !== 'boolean') {
        throw new SyncError('other', SYNC_MESSAGES.other);
      }
      const permissions = isRecord(body.permissions) ? body.permissions : {};
      return {
        private: body.private,
        // 権限情報が無い場合は書き込めるとみなし、実際の書き込みで判断する
        canPush: typeof permissions.push === 'boolean' ? permissions.push : true,
      };
    },

    async listLogs() {
      const response = await request(`${repoUrl}/contents/${LOGS_DIR}?${ref}`);
      if (response.status === 404) {
        return [];
      }
      if (!response.ok) {
        return fail(response);
      }
      const body = await json(response);
      if (!Array.isArray(body)) {
        return [];
      }
      return body.flatMap((item: unknown) =>
        isRecord(item) &&
        item.type === 'file' &&
        typeof item.path === 'string' &&
        typeof item.sha === 'string'
          ? [{ path: item.path, sha: item.sha }]
          : [],
      );
    },

    async getFile(path) {
      const response = await request(`${repoUrl}/contents/${encodePath(path)}?${ref}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        return fail(response);
      }
      const body = await json(response);
      if (!isRecord(body) || typeof body.sha !== 'string' || typeof body.content !== 'string') {
        throw new SyncError('other', `${path} を読めませんでした`);
      }
      if (body.encoding !== 'base64' || (body.content === '' && body.size !== 0)) {
        throw new SyncError('other', `${path} が大きすぎるため読めませんでした`);
      }
      return { content: decodeBase64Utf8(body.content), sha: body.sha };
    },

    async putFile(path, content, sha, message) {
      const response = await request(`${repoUrl}/contents/${encodePath(path)}`, {
        method: 'PUT',
        body: JSON.stringify({
          message,
          content: encodeBase64Utf8(content),
          branch: target.branch,
          ...(sha === null ? {} : { sha }),
        }),
      });
      if (!response.ok) {
        return fail(response);
      }
      const body = await json(response);
      const newSha = isRecord(body) && isRecord(body.content) ? body.content.sha : undefined;
      if (typeof newSha !== 'string') {
        throw new SyncError('other', SYNC_MESSAGES.other);
      }
      return newSha;
    },
  };
}
