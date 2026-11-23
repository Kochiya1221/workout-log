import { beforeEach, describe, expect, it } from 'vitest';
import type { Exercise } from '../domain/exercise';
import type { SetLog } from '../domain/setLog';
import { createMemoryRepository, type Repository } from '../storage/repository';
import { EMPTY_SYNC_STATE, type SyncState } from '../storage/settingsStore';
import { createFakeGitHub, type FakeGitHub } from '../test/fakeGitHub';
import { parseExercises, parseSets, serializeExercises, serializeSets } from './files';
import { runSync, type SyncDeps } from './syncEngine';
import { SyncError } from './syncError';

const T1 = '2026-11-01T00:00:00.000Z';
const T2 = '2026-11-02T00:00:00.000Z';
const T3 = '2026-11-03T00:00:00.000Z';

function exercise(id: string, name: string, updatedAt = T1): Exercise {
  return { id, name, bodyPart: 'legs', createdAt: T1, updatedAt, deletedAt: null };
}

function set(id: string, date: string, setNo: number, weightKg: number, updatedAt = T1): SetLog {
  return {
    id,
    date,
    exerciseId: 'ex-1',
    setNo,
    weightKg,
    reps: 10,
    note: '',
    createdAt: T1,
    updatedAt,
    deletedAt: null,
  };
}

interface Device {
  exercises: Repository<Exercise>;
  sets: Repository<SetLog>;
  state: SyncState;
  deps: SyncDeps;
}

let github: FakeGitHub;
let clock: number;

function createDevice(): Device {
  const device: Device = {
    exercises: createMemoryRepository<Exercise>(),
    sets: createMemoryRepository<SetLog>(),
    state: EMPTY_SYNC_STATE,
    deps: undefined as unknown as SyncDeps,
  };
  device.deps = {
    client: github,
    exercises: device.exercises,
    sets: device.sets,
    loadState: () => Promise.resolve(device.state),
    saveState: (s) => {
      device.state = s;
      return Promise.resolve();
    },
    // 同期のたびに時刻を進める
    now: () => new Date(Date.UTC(2026, 11, 1, 0, 0, clock++)).toISOString(),
  };
  return device;
}

beforeEach(() => {
  github = createFakeGitHub();
  clock = 0;
});

function remoteSets(path: string): SetLog[] {
  const file = github.files.get(path);
  return file ? parseSets(file.content, path) : [];
}

describe('runSync', () => {
  it('初回（リモートが空）: 種目と月ごとのファイルを作る', async () => {
    const d = createDevice();
    await d.exercises.put(exercise('ex-1', 'テスト種目A'));
    await d.sets.putMany([set('s1', '2026-10-31', 1, 60), set('s2', '2026-11-01', 1, 62.5)]);

    const result = await runSync(d.deps);
    expect(result.pushedFiles).toEqual(['exercises.json', 'logs/2026-10.json', 'logs/2026-11.json']);
    expect(result.pulled).toBe(0);
    expect(parseExercises(github.files.get('exercises.json')?.content ?? '')).toEqual([
      exercise('ex-1', 'テスト種目A'),
    ]);
    expect(remoteSets('logs/2026-10.json').map((s) => s.id)).toEqual(['s1']);
    expect(remoteSets('logs/2026-11.json').map((s) => s.id)).toEqual(['s2']);
    expect(d.state.lastSyncedAt).not.toBeNull();
    expect(Object.keys(d.state.files).sort()).toEqual([
      'exercises.json',
      'logs/2026-10.json',
      'logs/2026-11.json',
    ]);
  });

  it('端末もリモートも空なら何も書かない', async () => {
    const result = await runSync(createDevice().deps);
    expect(result.pushedFiles).toEqual([]);
    expect(github.files.size).toBe(0);
  });

  it('新しい端末（端末が空）: リモートから全部復元し、書き込みはしない', async () => {
    github.write('exercises.json', serializeExercises([exercise('ex-1', 'テスト種目A')]));
    github.write('logs/2026-10.json', serializeSets([set('s1', '2026-10-31', 1, 60)]));
    github.write('logs/2026-11.json', serializeSets([set('s2', '2026-11-01', 1, 62.5)]));

    const d = createDevice();
    const result = await runSync(d.deps);
    expect(result.pulled).toBe(3);
    expect(result.pushedFiles).toEqual([]);
    expect(github.putCount).toBe(0);
    expect((await d.exercises.list()).map((e) => e.id)).toEqual(['ex-1']);
    expect((await d.sets.list()).map((s) => s.id).sort()).toEqual(['s1', 's2']);
  });

  it('両方に差分があるとき: 新しい方を採用し、端末にもリモートにも反映', async () => {
    github.write(
      'logs/2026-11.json',
      serializeSets([set('s1', '2026-11-01', 1, 70, T3), set('s2', '2026-11-01', 2, 60, T1)]),
    );
    const d = createDevice();
    await d.sets.putMany([set('s1', '2026-11-01', 1, 65, T2), set('s2', '2026-11-01', 2, 55, T2)]);

    const result = await runSync(d.deps);
    expect(result.pulled).toBe(1);
    const local = Object.fromEntries((await d.sets.list()).map((s) => [s.id, s.weightKg]));
    expect(local).toEqual({ s1: 70, s2: 55 });
    const remote = Object.fromEntries(remoteSets('logs/2026-11.json').map((s) => [s.id, s.weightKg]));
    expect(remote).toEqual({ s1: 70, s2: 55 });
  });

  it('削除（deletedAt）もリモートに伝わり、行は残る', async () => {
    const d = createDevice();
    await d.sets.put(set('s1', '2026-11-01', 1, 60));
    await runSync(d.deps);
    // 削除は前回の同期より後の時刻になる
    const deletedAt = '2026-12-31T00:00:00.000Z';
    const deleted = { ...set('s1', '2026-11-01', 1, 60, deletedAt), deletedAt };
    await d.sets.put(deleted);
    await runSync(d.deps);
    expect(remoteSets('logs/2026-11.json')).toEqual([deleted]);
  });

  it('変化がなければ書き込まない（2回目は月のファイルも読まない）', async () => {
    const d = createDevice();
    await d.exercises.put(exercise('ex-1', 'テスト種目A'));
    await d.sets.put(set('s1', '2026-11-01', 1, 60));
    await runSync(d.deps);
    const puts = github.putCount;

    const second = await runSync(d.deps);
    expect(github.putCount).toBe(puts);
    expect(second.pushedFiles).toEqual([]);
    expect(second.checkedFiles).toEqual(['exercises.json']);
  });

  it('前回の同期以降に変えた月だけを書き込む', async () => {
    const d = createDevice();
    await d.sets.putMany([set('s1', '2026-10-01', 1, 60), set('s2', '2026-11-01', 1, 60)]);
    await runSync(d.deps);
    await d.sets.put(set('s2', '2026-11-01', 1, 65, '2026-12-31T00:00:00.000Z'));
    const result = await runSync(d.deps);
    expect(result.pushedFiles).toEqual(['logs/2026-11.json']);
  });

  it('書き込みの直前に別の更新があったら、取り直してマージし直す', async () => {
    const d = createDevice();
    await d.sets.put(set('s1', '2026-11-01', 1, 60));
    let once = true;
    github.beforePut = (path) => {
      if (once && path === 'logs/2026-11.json') {
        once = false;
        github.write(path, serializeSets([set('s9', '2026-11-01', 2, 80)]));
      }
    };
    const result = await runSync(d.deps);
    expect(result.pushedFiles).toContain('logs/2026-11.json');
    expect(remoteSets('logs/2026-11.json').map((s) => s.id).sort()).toEqual(['s1', 's9']);
    expect((await d.sets.list()).map((s) => s.id).sort()).toEqual(['s1', 's9']);
  });

  it('競合が続く場合はあきらめてエラーにする', async () => {
    const d = createDevice();
    await d.sets.put(set('s1', '2026-11-01', 1, 60));
    github.beforePut = (path) => {
      github.write(path, '[]\n');
    };
    await expect(runSync(d.deps)).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('公開リポジトリには何も書かず、何も読まない', async () => {
    github.isPrivate = false;
    const d = createDevice();
    await d.exercises.put(exercise('ex-1', 'テスト種目A'));
    await d.sets.put(set('s1', '2026-11-01', 1, 60));
    const error = await runSync(d.deps).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SyncError);
    expect((error as SyncError).kind).toBe('publicRepo');
    expect(github.files.size).toBe(0);
    expect(github.putCount).toBe(0);
  });

  it('書き込み権限がなければ中止', async () => {
    github.canPush = false;
    const d = createDevice();
    await d.sets.put(set('s1', '2026-11-01', 1, 60));
    await expect(runSync(d.deps)).rejects.toMatchObject({ kind: 'forbidden' });
    expect(github.putCount).toBe(0);
  });

  it('壊れたリモートファイルでは端末のデータを変えない', async () => {
    github.write('exercises.json', '{ broken');
    const d = createDevice();
    await d.exercises.put(exercise('ex-1', 'テスト種目A'));
    await expect(runSync(d.deps)).rejects.toMatchObject({ kind: 'invalidData' });
    expect(await d.exercises.list()).toEqual([exercise('ex-1', 'テスト種目A')]);
    expect(github.files.get('exercises.json')?.content).toBe('{ broken');
  });

  it('月のファイルに別の月の記録があれば取り込まない', async () => {
    github.write('logs/2026-11.json', serializeSets([set('s1', '2026-10-31', 1, 60)]));
    const d = createDevice();
    await expect(runSync(d.deps)).rejects.toMatchObject({ kind: 'invalidData' });
    expect(await d.sets.list()).toEqual([]);
  });
});
