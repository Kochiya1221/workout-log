import type { Exercise } from '../domain/exercise';

/**
 * 種目の保存先。削除も deletedAt を立てた種目を put で上書きする（物理削除はしない）。
 * M2 ではメモリ実装、M5 で IndexedDB 実装に差し替える。
 */
export interface ExerciseRepository {
  /** 削除済みを含むすべての種目を返す。 */
  list(): Promise<Exercise[]>;
  /** 同じ id があれば上書き、なければ追加する。 */
  put(exercise: Exercise): Promise<void>;
}
