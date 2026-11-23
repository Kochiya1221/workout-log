import { describe, expect, it } from 'vitest';
import type { WeeklyReport } from './analyze';
import { formatDiff, formatNumber, renderMarkdown } from './markdown';
import { reportPeriod } from './period';

describe('formatNumber / formatDiff', () => {
  it('3桁区切り・小数第1位まで', () => {
    expect(formatNumber(12340)).toBe('12,340');
    expect(formatNumber(62.5)).toBe('62.5');
    expect(formatNumber(83.33333)).toBe('83.3');
    expect(formatNumber(0)).toBe('0');
  });

  it('差の符号', () => {
    expect(formatDiff(3, 2)).toBe('+1');
    expect(formatDiff(2, 2)).toBe('±0');
    expect(formatDiff(60, 62.5)).toBe('−2.5');
    expect(formatDiff(12340, 9800)).toBe('+2,540');
    expect(formatDiff(80.04, 80)).toBe('±0');
  });
});

const period = reportPeriod('2026-11-24');
const zeroParts = (['chest', 'back', 'shoulders', 'arms', 'legs', 'abs'] as const).map((bodyPart) => ({
  bodyPart,
  sets: 0,
  volume: 0,
  prevSets: 0,
  prevVolume: 0,
}));

describe('renderMarkdown', () => {
  const report: WeeklyReport = {
    period,
    current: { days: 3, personalDays: 1, sets: 24, volume: 12340 },
    previous: { days: 2, personalDays: 1, sets: 18, volume: 9800 },
    bodyParts: zeroParts.map((r) =>
      r.bodyPart === 'legs' ? { ...r, sets: 6, volume: 4320, prevSets: 4, prevVolume: 3000 } : r,
    ),
    untrainedParts: ['chest', 'back', 'shoulders', 'arms', 'abs'],
    exercises: [
      {
        exerciseId: 'sq',
        name: 'テスト種目スクワット',
        bodyPart: 'legs',
        sets: 6,
        maxWeight: 80,
        bestE1rm: 96,
        volume: 4320,
        previous: { date: '2026-11-12', maxWeight: 77.5, bestE1rm: 93 },
        personalBest: true,
      },
      {
        exerciseId: 'x',
        name: '不明な種目',
        bodyPart: null,
        sets: 1,
        maxWeight: 10,
        bestE1rm: 13.3333,
        volume: 100,
        previous: null,
        personalBest: false,
      },
    ],
  };
  const md = renderMarkdown(report);

  it('見出しと期間（曜日付き）', () => {
    expect(md.startsWith('# 週次レポート 11/17(火)〜11/23(月)\n')).toBe(true);
    expect(md).toContain('比較: 11/10(火)〜11/16(月)');
  });

  it('概要の表', () => {
    expect(md).toContain('| トレーニング日数 | 3 | 2 | +1 |');
    expect(md).toContain('| うちパーソナル | 1 | 1 | ±0 |');
    expect(md).toContain('| 総重量 | 12,340 kg | 9,800 kg | +2,540 kg |');
  });

  it('部位ごとの表とやっていない部位', () => {
    expect(md).toContain('| 脚 | 6（4） | 4,320 kg（3,000 kg） |');
    expect(md).toContain('| 胸 | 0（0） | 0 kg（0 kg） |');
    expect(md).toContain('やっていない部位: 胸、背中、肩、腕、腹');
  });

  it('種目ごと: 前回比・自己ベストの印・初回・不明は最後', () => {
    expect(md).toContain('### 脚');
    expect(md).toContain('| テスト種目スクワット 🏆 | 6 | 80 kg（+2.5） | 96 kg（+3） | 4,320 kg | 11/12(木) |');
    expect(md).toContain('| 不明な種目 | 1 | 10 kg | 13.3 kg | 100 kg | 初回 |');
    expect(md.indexOf('### 脚')).toBeLessThan(md.indexOf('### 不明'));
  });

  it('記録がない週', () => {
    const empty = renderMarkdown({
      ...report,
      current: { days: 0, personalDays: 0, sets: 0, volume: 0 },
      bodyParts: zeroParts,
      untrainedParts: ['chest', 'back', 'shoulders', 'arms', 'legs', 'abs'],
      exercises: [],
    });
    expect(empty).toContain('この期間の記録はありません。');
    expect(empty).not.toContain('### ');
  });
});
