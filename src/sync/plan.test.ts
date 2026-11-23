import { describe, expect, it } from 'vitest';
import type { SetLog } from '../domain/setLog';
import { EMPTY_SYNC_STATE } from '../storage/settingsStore';
import { logFilesToSync } from './plan';

function set(date: string, updatedAt: string): SetLog {
  return {
    id: `${date}-${updatedAt}`,
    date,
    exerciseId: 'ex-1',
    setNo: 1,
    weightKg: 50,
    reps: 10,
    note: '',
    createdAt: updatedAt,
    updatedAt,
    deletedAt: null,
  };
}

const SYNCED = '2026-11-20T00:00:00.000Z';
const BEFORE = '2026-11-19T00:00:00.000Z';
const AFTER = '2026-11-21T00:00:00.000Z';

describe('logFilesToSync', () => {
  it('初回は端末とリモートにある月をすべて（古い順）', () => {
    const local = [set('2026-11-03', BEFORE), set('2026-10-05', BEFORE)];
    const remote = [{ path: 'logs/2026-09.json', sha: 'r9' }];
    expect(logFilesToSync(local, remote, EMPTY_SYNC_STATE)).toEqual([
      'logs/2026-09.json',
      'logs/2026-10.json',
      'logs/2026-11.json',
    ]);
  });

  it('リモートの sha が前回と同じで、端末に変更が無い月は飛ばす', () => {
    const local = [set('2026-10-05', BEFORE), set('2026-11-03', AFTER)];
    const remote = [
      { path: 'logs/2026-10.json', sha: 's10' },
      { path: 'logs/2026-11.json', sha: 's11' },
    ];
    const state = {
      lastSyncedAt: SYNCED,
      files: {
        'logs/2026-10.json': { sha: 's10', syncedAt: SYNCED },
        'logs/2026-11.json': { sha: 's11', syncedAt: SYNCED },
      },
    };
    expect(logFilesToSync(local, remote, state)).toEqual(['logs/2026-11.json']);
  });

  it('リモートが前回から変わった月は取得する', () => {
    const remote = [{ path: 'logs/2026-10.json', sha: 'changed' }];
    const state = { lastSyncedAt: SYNCED, files: { 'logs/2026-10.json': { sha: 's10', syncedAt: SYNCED } } };
    expect(logFilesToSync([set('2026-10-05', BEFORE)], remote, state)).toEqual(['logs/2026-10.json']);
  });

  it('端末が空でもリモートにある月は取得する（新しい端末への復元）', () => {
    const remote = [
      { path: 'logs/2026-10.json', sha: 's10' },
      { path: 'logs/notes.md', sha: 'x' },
    ];
    expect(logFilesToSync([], remote, EMPTY_SYNC_STATE)).toEqual(['logs/2026-10.json']);
  });

  it('リモートから消えた月は、前回の記録があっても書き直す', () => {
    const state = { lastSyncedAt: SYNCED, files: { 'logs/2026-10.json': { sha: 's10', syncedAt: SYNCED } } };
    expect(logFilesToSync([set('2026-10-05', BEFORE)], [], state)).toEqual(['logs/2026-10.json']);
  });
});
