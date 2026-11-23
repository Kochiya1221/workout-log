import { isValidDateString } from '../../src/domain/date';

export interface ReportPeriod {
  /** 対象週の初日（YYYY-MM-DD、含む） */
  readonly start: string;
  /** 対象週の最終日（含む） */
  readonly end: string;
  /** 比較する前の週 */
  readonly prevStart: string;
  readonly prevEnd: string;
}

/** 'YYYY-MM-DD' に n 日足す（タイムゾーンの影響を受けないよう UTC で計算）。 */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + n));
  return t.toISOString().slice(0, 10);
}

/**
 * 分析する期間。既定は「実行した日を含まない過去7日間」と、その前の7日間。
 * end を指定したら、その日を最終日にする。
 */
export function reportPeriod(today: string, end?: string): ReportPeriod {
  if (end !== undefined && !isValidDateString(end)) {
    throw new Error(`日付の形式が正しくありません: ${end}（YYYY-MM-DD で指定してください）`);
  }
  const last = end ?? addDays(today, -1);
  const start = addDays(last, -6);
  const prevEnd = addDays(start, -1);
  return { start, end: last, prevStart: addDays(prevEnd, -6), prevEnd };
}

/** date が [start, end] に含まれるか（文字列比較で足りる形式）。 */
export function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}
