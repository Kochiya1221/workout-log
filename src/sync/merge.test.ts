import { describe, expect, it } from 'vitest';
import { mergeById } from './merge';

interface Row {
  id: string;
  updatedAt: string;
  value: string;
  deletedAt: string | null;
}

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';

function row(id: string, updatedAt: string, value: string, deletedAt: string | null = null): Row {
  return { id, updatedAt, value, deletedAt };
}

describe('mergeById', () => {
  it('片方にしかない id はそのまま入る。リモートにしかないものは端末へ', () => {
    const { merged, toLocal } = mergeById([row('a', T1, 'local')], [row('b', T1, 'remote')]);
    expect(merged.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(toLocal).toEqual([row('b', T1, 'remote')]);
  });

  it('updatedAt が新しい方を採用する', () => {
    const local = [row('a', T2, 'local-new'), row('b', T1, 'local-old')];
    const remote = [row('a', T1, 'remote-old'), row('b', T2, 'remote-new')];
    const { merged, toLocal } = mergeById(local, remote);
    expect(Object.fromEntries(merged.map((r) => [r.id, r.value]))).toEqual({
      a: 'local-new',
      b: 'remote-new',
    });
    expect(toLocal.map((r) => r.id)).toEqual(['b']);
  });

  it('同じ時刻なら端末側を採用し、書き戻さない', () => {
    const { merged, toLocal } = mergeById([row('a', T1, 'local')], [row('a', T1, 'remote')]);
    expect(merged).toEqual([row('a', T1, 'local')]);
    expect(toLocal).toEqual([]);
  });

  it('削除フラグもマージで伝わる', () => {
    const { merged, toLocal } = mergeById([row('a', T1, 'x')], [row('a', T2, 'x', T2)]);
    expect(merged[0]?.deletedAt).toBe(T2);
    expect(toLocal).toHaveLength(1);
  });

  it('両方空なら空', () => {
    expect(mergeById([], [])).toEqual({ merged: [], toLocal: [] });
  });
});
