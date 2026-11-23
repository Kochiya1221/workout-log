function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 端末のローカル時刻での日付を YYYY-MM-DD で返す（toISOString は UTC なので使わない）。 */
export function toLocalDateString(d: Date): string {
  return `${String(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** YYYY-MM-DD 形式で、実在する日付かどうか。 */
export function isValidDateString(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) {
    return false;
  }
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
  );
}

/** '2026-11-05' → '11/5'。 */
export function formatShortDate(value: string): string {
  const [, mo, d] = value.split('-');
  return `${String(Number(mo))}/${String(Number(d))}`;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/**
 * 履歴用の日付表記。today と同じ年なら '11/23(月)'、違う年なら '2025/11/23(日)'。
 * 曜日は UTC で計算し、端末のタイムゾーンの影響を受けない。
 */
export function formatDateWithWeekday(date: string, today: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y ?? 0, (mo ?? 1) - 1, d ?? 1)).getUTCDay()] ?? '';
  const md = `${String(mo)}/${String(d)}(${weekday})`;
  return date.slice(0, 4) === today.slice(0, 4) ? md : `${String(y)}/${md}`;
}

/** (2026, 11) → '2026年11月' */
export function formatYearMonth(year: number, month: number): string {
  return `${String(year)}年${String(month)}月`;
}
