import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncResult } from './syncEngine';
import { SYNC_MESSAGES, SyncError } from './syncError';
import { createSyncScheduler, type SyncStatus } from './syncScheduler';

const ok: SyncResult = { pulled: 0, pushedFiles: [], checkedFiles: [] };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(options: { configured?: boolean; sync?: () => Promise<SyncResult> } = {}) {
  const sync = vi.fn(options.sync ?? (() => Promise.resolve(ok)));
  const onPulled = vi.fn();
  const scheduler = createSyncScheduler({
    isConfigured: () => Promise.resolve(options.configured ?? true),
    sync,
    initialLastSyncedAt: null,
    delayMs: 5000,
    now: () => '2026-11-23T05:00:00.000Z',
    onPulled,
  });
  const statuses: SyncStatus[] = [];
  scheduler.subscribe((s) => statuses.push(s));
  return { scheduler, sync, onPulled, statuses };
}

describe('createSyncScheduler', () => {
  it('変更から5秒後に1回だけ同期する（続けて変わったらまとめる）', async () => {
    const { scheduler, sync } = setup();
    scheduler.notifyChange();
    await vi.advanceTimersByTimeAsync(3000);
    scheduler.notifyChange();
    await vi.advanceTimersByTimeAsync(4999);
    expect(sync).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(sync).toHaveBeenCalledTimes(1);
    expect(scheduler.getStatus()).toEqual({
      phase: 'ok',
      lastSyncedAt: '2026-11-23T05:00:00.000Z',
      message: null,
    });
  });

  it('同期中に要求があれば、終わったあともう一度だけ実行する', async () => {
    let release: () => void = () => undefined;
    const { scheduler, sync } = setup({
      sync: () =>
        new Promise((resolve) => {
          release = () => {
            resolve(ok);
          };
        }),
    });
    const first = scheduler.syncNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.getStatus().phase).toBe('syncing');
    void scheduler.syncNow();
    void scheduler.syncNow();
    release();
    await vi.advanceTimersByTimeAsync(0);
    release();
    await first;
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it('設定がなければ同期しない', async () => {
    const { scheduler, sync } = setup({ configured: false });
    await scheduler.syncNow();
    expect(sync).not.toHaveBeenCalled();
    expect(scheduler.getStatus().phase).toBe('unconfigured');
  });

  it('通信できないときは offline、次の要求で再試行する', async () => {
    let fail = true;
    const { scheduler, sync } = setup({
      sync: () =>
        fail
          ? Promise.reject(new SyncError('network', SYNC_MESSAGES.network))
          : Promise.resolve(ok),
    });
    await scheduler.syncNow();
    expect(scheduler.getStatus()).toMatchObject({ phase: 'offline', message: SYNC_MESSAGES.network });
    fail = false;
    await scheduler.syncNow();
    expect(sync).toHaveBeenCalledTimes(2);
    expect(scheduler.getStatus().phase).toBe('ok');
  });

  it('それ以外のエラーは error とメッセージ', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { scheduler } = setup({
      sync: () => Promise.reject(new SyncError('unauthorized', SYNC_MESSAGES.unauthorized)),
    });
    await scheduler.syncNow();
    expect(scheduler.getStatus()).toMatchObject({
      phase: 'error',
      message: SYNC_MESSAGES.unauthorized,
      lastSyncedAt: null,
    });
  });

  it('取り込みがあれば onPulled を呼ぶ', async () => {
    const { scheduler, onPulled } = setup({
      sync: () => Promise.resolve({ ...ok, pulled: 3 }),
    });
    await scheduler.syncNow();
    expect(onPulled).toHaveBeenCalledWith(3);
  });

  it('cancelPending で予約した同期を取り消す', async () => {
    const { scheduler, sync } = setup();
    scheduler.notifyChange();
    scheduler.cancelPending();
    await vi.advanceTimersByTimeAsync(10000);
    expect(sync).not.toHaveBeenCalled();
  });
});
