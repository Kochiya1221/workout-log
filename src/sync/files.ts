import { isBodyPart } from '../domain/bodyPart';
import { isValidDateString } from '../domain/date';
import type { Exercise } from '../domain/exercise';
import type { SetLog } from '../domain/setLog';

export const EXERCISES_PATH = 'exercises.json';
export const LOGS_DIR = 'logs';

/** '2026-11-23' → '2026-11' */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** '2026-11' → 'logs/2026-11.json' */
export function logPath(month: string): string {
  return `${LOGS_DIR}/${month}.json`;
}

/** 'logs/2026-11.json' → '2026-11'。月ごとのファイルでなければ null。 */
export function monthOfLogPath(path: string): string | null {
  return /^logs\/(\d{4}-\d{2})\.json$/.exec(path)?.[1] ?? null;
}

/** セットを日付の属する月ごとに分ける（削除済みも含める）。 */
export function groupSetsByMonth(sets: readonly SetLog[]): Map<string, SetLog[]> {
  const map = new Map<string, SetLog[]>();
  for (const s of sets) {
    const key = monthKey(s.date);
    const list = map.get(key);
    if (list) {
      list.push(s);
    } else {
      map.set(key, [s]);
    }
  }
  return map;
}

function cmp(a: string | number, b: string | number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** フィールドの順番を REQUIREMENTS.md の表の順にそろえる。 */
function exerciseFields(e: Exercise): Exercise {
  return {
    id: e.id,
    name: e.name,
    bodyPart: e.bodyPart,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    deletedAt: e.deletedAt,
  };
}

function setFields(s: SetLog): SetLog {
  return {
    id: s.id,
    date: s.date,
    exerciseId: s.exerciseId,
    setNo: s.setNo,
    weightKg: s.weightKg,
    reps: s.reps,
    note: s.note,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    deletedAt: s.deletedAt,
  };
}

/** 種目を決まった順・整形した JSON にする（git の差分を読みやすくするため）。 */
export function serializeExercises(list: readonly Exercise[]): string {
  const sorted = [...list].sort((a, b) => cmp(a.createdAt, b.createdAt) || cmp(a.id, b.id));
  return `${JSON.stringify(sorted.map(exerciseFields), null, 2)}\n`;
}

/** セットを決まった順・整形した JSON にする。 */
export function serializeSets(list: readonly SetLog[]): string {
  const sorted = [...list].sort(
    (a, b) =>
      cmp(a.date, b.date) ||
      cmp(a.exerciseId, b.exerciseId) ||
      cmp(a.setNo, b.setNo) ||
      cmp(a.id, b.id),
  );
  return `${JSON.stringify(sorted.map(setFields), null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isNullableString = (v: unknown): v is string | null => v === null || typeof v === 'string';
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function parseArray(text: string, label: string): unknown[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${label} の JSON を読めません`);
  }
  if (!Array.isArray(data)) {
    throw new Error(`${label} の形式が正しくありません`);
  }
  return data;
}

/** exercises.json を読む。形が不正なら例外（壊れたデータで端末を上書きしないため）。 */
export function parseExercises(text: string): Exercise[] {
  return parseArray(text, EXERCISES_PATH).map((item, i) => {
    if (
      !isRecord(item) ||
      !isString(item.id) ||
      !isString(item.name) ||
      !isString(item.bodyPart) ||
      !isBodyPart(item.bodyPart) ||
      !isString(item.createdAt) ||
      !isString(item.updatedAt) ||
      !isNullableString(item.deletedAt)
    ) {
      throw new Error(`${EXERCISES_PATH} の ${String(i + 1)} 件目の形式が正しくありません`);
    }
    return exerciseFields({
      id: item.id,
      name: item.name,
      bodyPart: item.bodyPart,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      deletedAt: item.deletedAt,
    });
  });
}

/** logs/YYYY-MM.json を読む。形が不正なら例外。 */
export function parseSets(text: string, path: string): SetLog[] {
  return parseArray(text, path).map((item, i) => {
    if (
      !isRecord(item) ||
      !isString(item.id) ||
      !isString(item.date) ||
      !isValidDateString(item.date) ||
      !isString(item.exerciseId) ||
      !isFiniteNumber(item.setNo) ||
      !isFiniteNumber(item.weightKg) ||
      !isFiniteNumber(item.reps) ||
      !isString(item.note) ||
      !isString(item.createdAt) ||
      !isString(item.updatedAt) ||
      !isNullableString(item.deletedAt)
    ) {
      throw new Error(`${path} の ${String(i + 1)} 件目の形式が正しくありません`);
    }
    return setFields({
      id: item.id,
      date: item.date,
      exerciseId: item.exerciseId,
      setNo: item.setNo,
      weightKg: item.weightKg,
      reps: item.reps,
      note: item.note,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      deletedAt: item.deletedAt,
    });
  });
}

/** 文字列を UTF-8 の Base64 にする（GitHub Contents API 用。日本語を含むため）。 */
export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** UTF-8 の Base64 を文字列に戻す（GitHub が入れる改行は無視）。 */
export function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
