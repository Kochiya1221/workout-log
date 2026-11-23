/**
 * ブラウザに「このサイトのデータを自動で消さないで」と依頼する。
 * 対応していない・断られた場合は何もしない（結果は記録に影響しない）。
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator.storage.persist !== 'function') {
      return false;
    }
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
