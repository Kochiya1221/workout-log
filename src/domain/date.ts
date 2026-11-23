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
