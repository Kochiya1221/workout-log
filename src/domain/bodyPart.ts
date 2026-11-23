/** 部位（表示順）。 */
export const BODY_PARTS = ['chest', 'back', 'shoulders', 'arms', 'legs', 'abs'] as const;

export type BodyPart = (typeof BODY_PARTS)[number];

const LABELS: Record<BodyPart, string> = {
  chest: '胸',
  back: '背中',
  shoulders: '肩',
  arms: '腕',
  legs: '脚',
  abs: '腹',
};

/** 部位の日本語表示名を返す。 */
export function bodyPartLabel(part: BodyPart): string {
  return LABELS[part];
}

/** 文字列が部位の値かどうかを判定する。 */
export function isBodyPart(value: string): value is BodyPart {
  return (BODY_PARTS as readonly string[]).includes(value);
}
