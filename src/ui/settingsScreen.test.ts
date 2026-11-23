import { describe, expect, it } from 'vitest';
import { validateSyncForm } from './settingsScreen';

const valid = { owner: 'test-owner', repo: 'test-repo', branch: 'main', token: 'test-token' };

describe('validateSyncForm', () => {
  it('正しい入力ならエラーなし', () => {
    expect(validateSyncForm(valid, false)).toEqual([]);
  });

  it('トークンが空でも、保存済みなら OK', () => {
    expect(validateSyncForm({ ...valid, token: '' }, true)).toEqual([]);
    expect(validateSyncForm({ ...valid, token: '' }, false)).toEqual(['トークンを入力してください']);
  });

  it('オーナー・リポジトリ・ブランチの形式', () => {
    expect(validateSyncForm({ ...valid, owner: '' }, true)).toHaveLength(1);
    expect(validateSyncForm({ ...valid, owner: 'a/b' }, true)).toHaveLength(1);
    expect(validateSyncForm({ ...valid, repo: 'a b' }, true)).toHaveLength(1);
    expect(validateSyncForm({ ...valid, branch: 'a b' }, true)).toHaveLength(1);
    expect(validateSyncForm({ ...valid, branch: 'feature/x' }, true)).toEqual([]);
  });
});
