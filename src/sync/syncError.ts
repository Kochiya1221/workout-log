export type SyncErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'network'
  | 'publicRepo'
  | 'invalidData'
  | 'other';

/** 同期のエラー。メッセージは画面にそのまま出せる日本語で、トークンを含めない。 */
export class SyncError extends Error {
  readonly kind: SyncErrorKind;

  constructor(kind: SyncErrorKind, message: string) {
    super(message);
    this.name = 'SyncError';
    this.kind = kind;
  }
}

export const SYNC_MESSAGES = {
  unauthorized: 'トークンが無効か期限切れです',
  forbidden: 'リポジトリにアクセスできません（トークンの対象リポジトリと権限を確認してください）',
  notFound: 'リポジトリにアクセスできません（トークンの対象リポジトリと権限を確認してください）',
  noPush: 'このトークンではリポジトリに書き込めません',
  conflict: '他の更新と重なったため保存できませんでした。もう一度同期してください',
  network: '通信できません。つながったら自動で同期します',
  publicRepo: '公開リポジトリには同期できません。非公開リポジトリを指定してください',
  other: '同期に失敗しました',
} as const;

/** どんなエラーも SyncError にそろえる（画面表示用）。 */
export function toSyncError(error: unknown): SyncError {
  if (error instanceof SyncError) {
    return error;
  }
  return new SyncError('other', SYNC_MESSAGES.other);
}
