import { maskToken, type SettingsStore, type SyncConfig } from '../storage/settingsStore';
import type { GitHubClient, GitHubTarget } from '../sync/githubClient';
import { SYNC_MESSAGES, toSyncError } from '../sync/syncError';
import type { SyncScheduler, SyncStatus } from '../sync/syncScheduler';
import { el } from './dom';
import { SAVE_ERROR, runSafely } from './notice';

export interface SettingsDeps {
  readonly settings: SettingsStore;
  readonly scheduler: SyncScheduler;
  readonly createClient: (target: GitHubTarget) => GitHubClient;
}

interface Draft {
  owner: string;
  repo: string;
  branch: string;
  /** 新しく入力したトークン（空なら保存済みのものを使う） */
  token: string;
}

type CheckResult = { readonly ok: boolean; readonly message: string } | null;

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const BRANCH_PATTERN = /^[^\s~^:?*[\\]+$/;

/** 入力欄の検証。問題がなければ空配列。 */
export function validateSyncForm(draft: Draft, hasSavedToken: boolean): string[] {
  const errors: string[] = [];
  if (!OWNER_PATTERN.test(draft.owner.trim())) {
    errors.push('オーナーには GitHub のユーザー名を入力してください');
  }
  if (!REPO_PATTERN.test(draft.repo.trim())) {
    errors.push('リポジトリ名を正しく入力してください');
  }
  if (!BRANCH_PATTERN.test(draft.branch.trim())) {
    errors.push('ブランチ名を正しく入力してください');
  }
  if (draft.token.trim() === '' && !hasSavedToken) {
    errors.push('トークンを入力してください');
  }
  return errors;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${String(d.getMonth() + 1)}/${String(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusText(status: SyncStatus): string {
  switch (status.phase) {
    case 'unconfigured':
      return 'トークンが設定されていません';
    case 'idle':
      return '待機中';
    case 'syncing':
      return '同期中…';
    case 'ok':
      return '同期済み';
    case 'offline':
      return status.message ?? SYNC_MESSAGES.network;
    case 'error':
      return `エラー: ${status.message ?? SYNC_MESSAGES.other}`;
  }
}

/** 設定画面を root に描画する。 */
export async function mountSettingsScreen(root: HTMLElement, deps: SettingsDeps): Promise<void> {
  let config: SyncConfig = await deps.settings.getSyncConfig();
  const draft: Draft = { owner: config.owner, repo: config.repo, branch: config.branch, token: '' };
  let errors: readonly string[] = [];
  let check: CheckResult = null;
  let checking = false;

  async function saveAndCheck(): Promise<void> {
    errors = validateSyncForm(draft, config.token !== null);
    check = null;
    if (errors.length > 0) {
      render();
      return;
    }
    config = await deps.settings.saveSyncConfig({ ...draft, token: draft.token });
    draft.token = '';
    if (config.token === null) {
      render();
      return;
    }
    checking = true;
    render();
    try {
      const repo = await deps.createClient({ ...config, token: config.token }).getRepo();
      if (!repo.private) {
        check = { ok: false, message: SYNC_MESSAGES.publicRepo };
      } else if (!repo.canPush) {
        check = { ok: false, message: SYNC_MESSAGES.noPush };
      } else {
        check = { ok: true, message: '接続できました（非公開リポジトリ・書き込み可）' };
      }
    } catch (error) {
      check = { ok: false, message: toSyncError(error).message };
    } finally {
      checking = false;
    }
    render();
    if (check.ok) {
      void deps.scheduler.syncNow();
    }
  }

  async function removeToken(): Promise<void> {
    if (!window.confirm('この端末に保存したトークンを削除しますか？（記録は消えません）')) {
      return;
    }
    deps.scheduler.cancelPending();
    await deps.settings.clearToken();
    config = await deps.settings.getSyncConfig();
    check = null;
    render();
    void deps.scheduler.syncNow(); // 状態を「未設定」に更新する
  }

  function input(
    key: keyof Draft,
    label: string,
    attrs: Partial<HTMLInputElement> = {},
  ): HTMLElement {
    const id = `sync-${key}`;
    const field = el('input', {
      id,
      type: 'text',
      value: draft[key],
      autocomplete: 'off',
      spellcheck: false,
      autocapitalize: 'off',
      ...attrs,
    });
    field.addEventListener('input', () => {
      draft[key] = field.value;
    });
    return el('div', { className: 'settings-field' }, [el('label', { htmlFor: id }, [label]), field]);
  }

  function renderSyncForm(): HTMLElement {
    const saved = config.token === null ? '未設定' : `保存済み: ${maskToken(config.token)}`;
    const save = el('button', { type: 'submit', className: 'primary', disabled: checking }, [
      checking ? '確認中…' : '保存して接続を確認',
    ]);
    const buttons = el('div', { className: 'form-buttons' }, [save]);
    if (config.token !== null) {
      const remove = el('button', { type: 'button', className: 'danger' }, ['トークンを削除']);
      remove.addEventListener('click', () => {
        runSafely(removeToken, SAVE_ERROR);
      });
      buttons.append(remove);
    }
    const form = el('form', { className: 'settings-form' }, [
      el('h2', {}, ['GitHub 同期']),
      input('owner', 'オーナー（GitHub のユーザー名）', { placeholder: 'ユーザー名' }),
      input('repo', 'リポジトリ（非公開）'),
      input('branch', 'ブランチ'),
      input('token', 'トークン', {
        type: 'password',
        placeholder: config.token === null ? 'github_pat_…' : '変更するときだけ入力',
      }),
      el('p', { className: 'hint' }, [`トークン: ${saved}（この端末の中にだけ保存されます）`]),
      buttons,
      ...errors.map((m) => el('p', { className: 'error', role: 'alert' }, [m])),
    ]);
    if (check) {
      form.append(
        el('p', { className: check.ok ? 'success' : 'error', role: 'status' }, [check.message]),
      );
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      runSafely(saveAndCheck, SAVE_ERROR);
    });
    return form;
  }

  function renderStatus(status: SyncStatus): HTMLElement {
    const syncButton = el(
      'button',
      { type: 'button', disabled: status.phase === 'syncing' || config.token === null },
      ['今すぐ同期'],
    );
    syncButton.addEventListener('click', () => {
      void deps.scheduler.syncNow();
    });
    return el('section', { className: 'sync-status' }, [
      el('h2', {}, ['同期の状態']),
      el('p', {}, [
        `最後の同期: ${status.lastSyncedAt === null ? 'まだありません' : formatDateTime(status.lastSyncedAt)}`,
      ]),
      el(
        'p',
        { className: status.phase === 'error' ? 'error' : '', role: 'status', id: 'sync-status-text' },
        [`状態: ${statusText(status)}`],
      ),
      syncButton,
    ]);
  }

  function renderHelp(): HTMLElement {
    const steps = [
      'GitHub の Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token',
      'Repository access で「Only select repositories」を選び、記録用の非公開リポジトリだけを指定',
      'Permissions の Repository permissions で「Contents」を「Read and write」にする（ほかは付けない）',
      '作成されたトークンをコピーして、上の「トークン」に貼り付ける',
    ];
    return el('details', { className: 'settings-help' }, [
      el('summary', {}, ['トークンの作り方']),
      el(
        'ol',
        {},
        steps.map((s) => el('li', {}, [s])),
      ),
      el('p', { className: 'hint' }, [
        'トークンはこの端末の中にだけ保存し、どこにも送りません（GitHub との通信を除く）。',
      ]),
    ]);
  }

  let statusSection: HTMLElement | null = null;

  function render(): void {
    statusSection = renderStatus(deps.scheduler.getStatus());
    root.replaceChildren(el('h1', {}, ['設定']), renderSyncForm(), statusSection, renderHelp());
  }

  // 同期の状態が変わったら、状態の欄だけ描き直す（入力中の内容は消さない）
  const unsubscribe = deps.scheduler.subscribe((status) => {
    if (!root.isConnected) {
      unsubscribe();
      return;
    }
    const next = renderStatus(status);
    statusSection?.replaceWith(next);
    statusSection = next;
  });

  render();
}
