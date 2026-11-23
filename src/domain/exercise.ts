import { BODY_PARTS, type BodyPart } from './bodyPart';

/** 種目。REQUIREMENTS.md「データ設計 > 種目」に対応する。 */
export interface Exercise {
  readonly id: string;
  readonly name: string;
  readonly bodyPart: BodyPart;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export interface ExerciseInput {
  readonly name: string;
  readonly bodyPart: BodyPart;
}

export const MAX_NAME_LENGTH = 50;

export type NameValidation =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly error: string };

/** 種目名の前後の空白を取り除く。 */
export function normalizeName(name: string): string {
  return name.trim();
}

/**
 * 種目名を検証する。
 * 削除済みの種目、および編集中の種目自身（editingId）とは重複判定しない。
 */
export function validateExerciseName(
  name: string,
  existing: readonly Exercise[],
  editingId?: string,
): NameValidation {
  const normalized = normalizeName(name);
  if (normalized === '') {
    return { ok: false, error: '種目名を入力してください' };
  }
  // 入力欄の maxLength と同じ数え方（UTF-16 単位）にそろえる
  if (normalized.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `種目名は${String(MAX_NAME_LENGTH)}文字以内にしてください` };
  }
  const duplicated = existing.some(
    (e) => e.deletedAt === null && e.id !== editingId && normalizeName(e.name) === normalized,
  );
  if (duplicated) {
    return { ok: false, error: '同じ名前の種目があります' };
  }
  return { ok: true, name: normalized };
}

/** 新しい種目を作る。 */
export function createExercise(
  input: ExerciseInput,
  meta: { readonly id: string; readonly now: string },
): Exercise {
  return {
    id: meta.id,
    name: normalizeName(input.name),
    bodyPart: input.bodyPart,
    createdAt: meta.now,
    updatedAt: meta.now,
    deletedAt: null,
  };
}

/** 種目の名前・部位を変更した新しいオブジェクトを返す。 */
export function updateExercise(exercise: Exercise, input: ExerciseInput, now: string): Exercise {
  return {
    ...exercise,
    name: normalizeName(input.name),
    bodyPart: input.bodyPart,
    updatedAt: now,
  };
}

/** 削除フラグを立てた新しいオブジェクトを返す（物理削除はしない）。 */
export function deleteExercise(exercise: Exercise, now: string): Exercise {
  return { ...exercise, deletedAt: now, updatedAt: now };
}

/** 削除されていない種目だけを返す。 */
export function activeExercises(list: readonly Exercise[]): Exercise[] {
  return list.filter((e) => e.deletedAt === null);
}

export interface ExerciseGroup {
  readonly bodyPart: BodyPart;
  readonly exercises: readonly Exercise[];
}

/**
 * 削除されていない種目を部位ごとにまとめる。
 * 部位は BODY_PARTS の順、部位内は名前順。種目のない部位は含めない。
 */
export function groupByBodyPart(list: readonly Exercise[]): ExerciseGroup[] {
  const active = activeExercises(list);
  return BODY_PARTS.map((bodyPart) => ({
    bodyPart,
    exercises: active
      .filter((e) => e.bodyPart === bodyPart)
      .sort((a, b) => a.name.localeCompare(b.name, 'ja')),
  })).filter((g) => g.exercises.length > 0);
}
