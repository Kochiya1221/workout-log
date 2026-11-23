import { isValidDateString } from './date';

/** セット。REQUIREMENTS.md「データ設計 > セット」に対応する。 */
export interface SetLog {
  readonly id: string;
  /** YYYY-MM-DD */
  readonly date: string;
  readonly exerciseId: string;
  /** 1 始まり */
  readonly setNo: number;
  readonly weightKg: number;
  readonly reps: number;
  readonly note: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export interface SetValues {
  readonly date: string;
  readonly weightKg: number;
  readonly reps: number;
  readonly note: string;
}

export interface SetFormInput {
  readonly date: string;
  readonly weight: string;
  readonly reps: string;
  readonly note: string;
}

export type SetValidation =
  | { readonly ok: true; readonly value: SetValues }
  | { readonly ok: false; readonly errors: readonly string[] };

export const MAX_WEIGHT_KG = 1000;
export const MAX_REPS = 1000;
export const MAX_NOTE_LENGTH = 200;

/** 全角の数字・小数点を半角にし、前後の空白を除く。 */
export function toHalfWidthNumber(value: string): string {
  return value
    .trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.');
}

/** 入力欄の文字列を検証し、保存できる値に変換する。 */
export function validateSetInput(input: SetFormInput): SetValidation {
  const errors: string[] = [];

  if (!isValidDateString(input.date)) {
    errors.push('日付を入力してください');
  }

  const weightText = toHalfWidthNumber(input.weight);
  const weightKg = Number(weightText);
  if (!/^\d+(\.\d{1,2})?$/.test(weightText) || weightKg > MAX_WEIGHT_KG) {
    errors.push(`重量は0〜${String(MAX_WEIGHT_KG)}kg、小数第2位までで入力してください`);
  }

  const repsText = toHalfWidthNumber(input.reps);
  const reps = Number(repsText);
  if (!/^\d+$/.test(repsText) || reps < 1 || reps > MAX_REPS) {
    errors.push(`回数は1〜${String(MAX_REPS)}の整数で入力してください`);
  }

  const note = input.note.trim();
  if (note.length > MAX_NOTE_LENGTH) {
    errors.push(`メモは${String(MAX_NOTE_LENGTH)}文字以内にしてください`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { date: input.date, weightKg, reps, note } };
}

/** 新しいセットを作る。 */
export function createSetLog(
  values: SetValues & { readonly exerciseId: string; readonly setNo: number },
  meta: { readonly id: string; readonly now: string },
): SetLog {
  return {
    id: meta.id,
    date: values.date,
    exerciseId: values.exerciseId,
    setNo: values.setNo,
    weightKg: values.weightKg,
    reps: values.reps,
    note: values.note,
    createdAt: meta.now,
    updatedAt: meta.now,
    deletedAt: null,
  };
}

/** 削除されていないセットだけを返す。 */
export function activeSets(sets: readonly SetLog[]): SetLog[] {
  return sets.filter((s) => s.deletedAt === null);
}

/** その日・その種目の削除されていないセットを setNo 順で返す。 */
export function setsOf(sets: readonly SetLog[], exerciseId: string, date: string): SetLog[] {
  return activeSets(sets)
    .filter((s) => s.exerciseId === exerciseId && s.date === date)
    .sort((a, b) => a.setNo - b.setNo);
}

/** その日・その種目の次のセット番号（最大の setNo + 1。なければ 1）。 */
export function nextSetNo(sets: readonly SetLog[], exerciseId: string, date: string): number {
  return setsOf(sets, exerciseId, date).reduce((max, s) => Math.max(max, s.setNo), 0) + 1;
}
