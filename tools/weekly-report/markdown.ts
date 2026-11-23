import { BODY_PARTS, bodyPartLabel, type BodyPart } from '../../src/domain/bodyPart';
import { formatDateWithWeekday, formatShortDate } from '../../src/domain/date';
import type { ExerciseRow, Totals, WeeklyReport } from './analyze';

const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 });

/** 小数第1位までに丸め、3桁区切りにする。 */
export function formatNumber(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return numberFormat.format(rounded === 0 ? 0 : rounded);
}

/** 差を符号付きで（+1 / ±0 / −2.5）。 */
export function formatDiff(value: number, previous: number): string {
  const diff = Math.round((value - previous) * 10) / 10;
  if (diff === 0) {
    return '±0';
  }
  return diff > 0 ? `+${formatNumber(diff)}` : `−${formatNumber(-diff)}`;
}

const kg = (value: number): string => `${formatNumber(value)} kg`;
const day = (date: string, end: string): string => formatDateWithWeekday(date, end);

function overviewTable(current: Totals, previous: Totals): string[] {
  const rows: [string, number, number, (v: number) => string][] = [
    ['トレーニング日数', current.days, previous.days, formatNumber],
    ['うちパーソナル', current.personalDays, previous.personalDays, formatNumber],
    ['総セット数', current.sets, previous.sets, formatNumber],
    ['総重量', current.volume, previous.volume, kg],
  ];
  return [
    '| | 今週 | 前週 | 差 |',
    '|---|---:|---:|---:|',
    ...rows.map(([label, now, before, fmt]) => {
      const diff = formatDiff(now, before);
      return `| ${label} | ${fmt(now)} | ${fmt(before)} | ${label === '総重量' ? `${diff} kg` : diff} |`;
    }),
  ];
}

function exerciseLine(row: ExerciseRow, end: string): string {
  const prev = row.previous;
  const max = prev ? `${kg(row.maxWeight)}（${formatDiff(row.maxWeight, prev.maxWeight)}）` : kg(row.maxWeight);
  const e1rm = prev ? `${kg(row.bestE1rm)}（${formatDiff(row.bestE1rm, prev.bestE1rm)}）` : kg(row.bestE1rm);
  const name = row.personalBest ? `${row.name} 🏆` : row.name;
  const prevLabel = prev ? day(prev.date, end) : '初回';
  return `| ${name} | ${String(row.sets)} | ${max} | ${e1rm} | ${kg(row.volume)} | ${prevLabel} |`;
}

/** 集計結果を Markdown にする（数値の表まで。所見はスキル側で書き足す）。 */
export function renderMarkdown(report: WeeklyReport): string {
  const { period } = report;
  const lines: string[] = [
    `# 週次レポート ${day(period.start, period.end)}〜${day(period.end, period.end)}`,
    '',
    `比較: ${day(period.prevStart, period.end)}〜${day(period.prevEnd, period.end)}`,
    '',
    '## 概要',
    '',
    ...overviewTable(report.current, report.previous),
    '',
    '## 部位ごと',
    '',
    '| 部位 | セット数（前週） | 総重量（前週） |',
    '|---|---:|---:|',
    ...report.bodyParts.map(
      (r) =>
        `| ${bodyPartLabel(r.bodyPart)} | ${String(r.sets)}（${String(r.prevSets)}） | ${kg(r.volume)}（${kg(r.prevVolume)}） |`,
    ),
    '',
    report.untrainedParts.length === 0
      ? 'すべての部位をトレーニングしました。'
      : `やっていない部位: ${report.untrainedParts.map(bodyPartLabel).join('、')}`,
    '',
    '## 種目ごと',
    '',
  ];

  if (report.exercises.length === 0) {
    lines.push('この期間の記録はありません。', '');
  } else {
    lines.push(
      '最大重量・推定1RM の（）は前回との差。🏆 はそれまでの自己ベストを更新した種目。',
      '',
    );
    const groups: (BodyPart | null)[] = [...BODY_PARTS, null];
    for (const part of groups) {
      const rows = report.exercises.filter((e) => e.bodyPart === part);
      if (rows.length === 0) {
        continue;
      }
      lines.push(
        `### ${part === null ? '不明' : bodyPartLabel(part)}`,
        '',
        '| 種目 | セット | 最大重量 | 推定1RM | 総重量 | 前回 |',
        '|---|---:|---:|---:|---:|---|',
        ...rows.map((r) => exerciseLine(r, period.end)),
        '',
      );
    }
  }

  lines.push(
    '※ 総重量は「重量 × 回数」の合計。体重種目は重量欄に体重を入れているため、体重を含みます。',
    `※ 推定1RM は Epley 式（重量 ×（1 + 回数 ÷ 30））。前回の日付は ${formatShortDate(period.start)} より前で最後にその種目を行った日。`,
    '',
  );
  return lines.join('\n');
}
