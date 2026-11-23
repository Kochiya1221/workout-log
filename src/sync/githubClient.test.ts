import { describe, expect, it } from 'vitest';
import { decodeBase64Utf8, encodeBase64Utf8 } from './files';
import { createGitHubClient, type FetchFn } from './githubClient';
import { SyncError } from './syncError';

const TOKEN = 'test-token-do-not-log';
const target = { owner: 'test-owner', repo: 'test-repo', branch: 'main', token: TOKEN };

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(respond: (call: Call) => Response | Promise<Response>): {
  fetchFn: FetchFn;
  calls: Call[];
} {
  const calls: Call[] = [];
  return {
    calls,
    fetchFn: (url, init) => {
      const call = { url, init };
      calls.push(call);
      return Promise.resolve(respond(call));
    },
  };
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function bodyOf(call: Call | undefined): unknown {
  const body = call?.init.body;
  return JSON.parse(typeof body === 'string' ? body : 'null');
}

function headersOf(call: Call | undefined): Record<string, string> {
  return (call?.init.headers ?? {}) as Record<string, string>;
}

async function errorOf(promise: Promise<unknown>): Promise<SyncError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof SyncError) {
      return error;
    }
    throw error;
  }
  throw new Error('エラーになりませんでした');
}

describe('createGitHubClient', () => {
  it('getRepo: URL・ヘッダ・非公開と書き込み権限', async () => {
    const { fetchFn, calls } = fakeFetch(() =>
      json(200, { private: true, permissions: { push: true } }),
    );
    const repo = await createGitHubClient(target, fetchFn).getRepo();
    expect(repo).toEqual({ private: true, canPush: true });
    expect(calls[0]?.url).toBe('https://api.github.com/repos/test-owner/test-repo');
    expect(headersOf(calls[0])).toMatchObject({
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    });
    expect(calls[0]?.init.cache).toBe('no-store');
  });

  it('getRepo: 公開・権限なし', async () => {
    const { fetchFn } = fakeFetch(() => json(200, { private: false, permissions: { push: false } }));
    expect(await createGitHubClient(target, fetchFn).getRepo()).toEqual({
      private: false,
      canPush: false,
    });
  });

  it('getFile: Base64 を UTF-8 で戻し、ブランチを指定する', async () => {
    const content = '[{"name":"テスト種目"}]\n';
    const { fetchFn, calls } = fakeFetch(() =>
      json(200, { sha: 'abc', encoding: 'base64', size: 10, content: encodeBase64Utf8(content) }),
    );
    const file = await createGitHubClient(target, fetchFn).getFile('logs/2026-11.json');
    expect(file).toEqual({ content, sha: 'abc' });
    expect(calls[0]?.url).toBe(
      'https://api.github.com/repos/test-owner/test-repo/contents/logs/2026-11.json?ref=main',
    );
  });

  it('getFile: 404 なら null', async () => {
    const { fetchFn } = fakeFetch(() => json(404, { message: 'Not Found' }));
    expect(await createGitHubClient(target, fetchFn).getFile('exercises.json')).toBeNull();
  });

  it('listLogs: ファイルだけを返し、フォルダが無ければ空', async () => {
    const { fetchFn } = fakeFetch(() =>
      json(200, [
        { type: 'file', path: 'logs/2026-11.json', sha: 's1' },
        { type: 'dir', path: 'logs/old', sha: 's2' },
      ]),
    );
    expect(await createGitHubClient(target, fetchFn).listLogs()).toEqual([
      { path: 'logs/2026-11.json', sha: 's1' },
    ]);
    const empty = fakeFetch(() => json(404, {}));
    expect(await createGitHubClient(target, empty.fetchFn).listLogs()).toEqual([]);
  });

  it('putFile: PUT の本文（Base64・sha・branch）と新しい sha', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(200, { content: { sha: 'new-sha' } }));
    const client = createGitHubClient(target, fetchFn);
    expect(await client.putFile('exercises.json', '[]\n', 'old-sha', '同期: exercises.json')).toBe(
      'new-sha',
    );
    expect(calls[0]?.init.method).toBe('PUT');
    const body = bodyOf(calls[0]) as Record<string, string>;
    expect(body).toEqual({
      message: '同期: exercises.json',
      content: encodeBase64Utf8('[]\n'),
      branch: 'main',
      sha: 'old-sha',
    });
    expect(decodeBase64Utf8(body.content ?? '')).toBe('[]\n');

    await client.putFile('logs/2026-11.json', '[]\n', null, 'm');
    expect(bodyOf(calls[1])).not.toHaveProperty('sha');
  });

  it.each([
    [401, {}, 'unauthorized'],
    [403, {}, 'forbidden'],
    [404, {}, 'notFound'],
    [409, {}, 'conflict'],
    [422, { message: 'Invalid request. "sha" wasn\'t supplied.' }, 'conflict'],
    [422, { message: 'Something else' }, 'other'],
    [500, {}, 'other'],
  ])('HTTP %i を %s のエラーにする（トークンを含めない）', async (status, body, kind) => {
    const { fetchFn } = fakeFetch(() => json(status, body));
    const error = await errorOf(
      createGitHubClient(target, fetchFn).putFile('exercises.json', '[]', null, 'm'),
    );
    expect(error.kind).toBe(kind);
    expect(error.message).not.toContain(TOKEN);
    expect(String(error.stack)).not.toContain(TOKEN);
  });

  it('通信できなければ network', async () => {
    const fetchFn: FetchFn = () => Promise.reject(new TypeError(`Failed: ${TOKEN}`));
    const error = await errorOf(createGitHubClient(target, fetchFn).getRepo());
    expect(error.kind).toBe('network');
    expect(error.message).not.toContain(TOKEN);
  });

  it('オーナー名・パスをエンコードする', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(404, {}));
    await createGitHubClient({ ...target, owner: 'a b', branch: 'x/y' }, fetchFn).getFile(
      'logs/2026-11.json',
    );
    expect(calls[0]?.url).toBe(
      'https://api.github.com/repos/a%20b/test-repo/contents/logs/2026-11.json?ref=x%2Fy',
    );
  });
});
