import { setPersonal } from '../domain/trainingDay';
import type { TrainingDayRepository } from '../storage/repository';
import { el } from './dom';

/** 「パーソナル」の切り替え（スイッチ風のチェックボックス）。 */
export function personalToggle(
  id: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): HTMLElement {
  const input = el('input', { type: 'checkbox', id, checked, className: 'switch-input' });
  input.addEventListener('change', () => {
    onChange(input.checked);
  });
  return el('label', { className: 'personal-toggle', htmlFor: id }, [
    input,
    el('span', { className: 'switch', ariaHidden: 'true' }),
    el('span', {}, ['パーソナル（トレーナー付き）']),
  ]);
}

/** その日のパーソナル／自主トレを保存する（既存があれば更新、なければ作成）。 */
export async function savePersonalDay(
  repo: TrainingDayRepository,
  date: string,
  personal: boolean,
): Promise<void> {
  const existing = (await repo.list()).find((d) => d.id === date);
  await repo.put(setPersonal(existing, date, personal, new Date().toISOString()));
}
