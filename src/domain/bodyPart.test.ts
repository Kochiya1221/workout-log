import { describe, expect, it } from 'vitest';
import { BODY_PARTS, bodyPartLabel, isBodyPart } from './bodyPart';

describe('bodyPartLabel', () => {
  it('すべての部位に日本語名がある', () => {
    expect(BODY_PARTS.map(bodyPartLabel)).toEqual(['胸', '背中', '肩', '腕', '脚', '腹']);
  });
});

describe('isBodyPart', () => {
  it('部位の値なら true', () => {
    for (const part of BODY_PARTS) {
      expect(isBodyPart(part)).toBe(true);
    }
  });

  it('部位でない値なら false', () => {
    expect(isBodyPart('')).toBe(false);
    expect(isBodyPart('胸')).toBe(false);
    expect(isBodyPart('Chest')).toBe(false);
    expect(isBodyPart('push')).toBe(false);
  });
});
