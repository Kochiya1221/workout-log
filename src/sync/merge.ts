export interface Versioned {
  readonly id: string;
  /** ISO 8601 */
  readonly updatedAt: string;
}

export interface MergeResult<T> {
  /** マージ後の全件（ファイルに書く内容） */
  readonly merged: T[];
  /** 端末側に書き戻す必要があるもの（リモートの方が新しい、または端末に無い） */
  readonly toLocal: T[];
}

/**
 * id ごとに updatedAt が新しい方を採用する（後勝ち）。同じ時刻なら端末側を採用する。
 * 削除も deletedAt と updatedAt で表すので、このマージで伝わる。
 */
export function mergeById<T extends Versioned>(
  local: readonly T[],
  remote: readonly T[],
): MergeResult<T> {
  const byId = new Map<string, T>();
  for (const item of local) {
    byId.set(item.id, item);
  }
  const toLocal: T[] = [];
  for (const item of remote) {
    const mine = byId.get(item.id);
    if (!mine || item.updatedAt > mine.updatedAt) {
      byId.set(item.id, item);
      toLocal.push(item);
    }
  }
  return { merged: [...byId.values()], toLocal };
}
