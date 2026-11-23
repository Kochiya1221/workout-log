import { bodyPartLabel } from '../domain/bodyPart';
import { formatShortDate, toLocalDateString } from '../domain/date';
import { groupByBodyPart, type Exercise } from '../domain/exercise';
import { findPreviousSession, suggestInitialValues } from '../domain/previousValues';
import { createSetLog, nextSetNo, setsOf, validateSetInput, type SetLog } from '../domain/setLog';
import type { ExerciseRepository, SetLogRepository } from '../storage/repository';
import { el } from './dom';
import { SAVE_ERROR, runSafely } from './notice';

/** タブを切り替えて戻っても保持する選択（再読み込みで初期化される）。 */
const selection: { date: string; exerciseId: string | null } = {
  date: toLocalDateString(new Date()),
  exerciseId: null,
};

interface Draft {
  weight: string;
  reps: string;
  note: string;
}

function formatSet(s: Pick<SetLog, 'weightKg' | 'reps'>): string {
  return `${String(s.weightKg)}kg×${String(s.reps)}`;
}

/** 記録画面を root に描画する。 */
export async function mountRecordScreen(
  root: HTMLElement,
  repos: { readonly exercises: ExerciseRepository; readonly sets: SetLogRepository },
): Promise<void> {
  const exercises: Exercise[] = await repos.exercises.list();
  let sets: SetLog[] = await repos.sets.list();
  let errors: readonly string[] = [];
  const draft: Draft = { weight: '', reps: '', note: '' };

  const groups = groupByBodyPart(exercises);
  const isSelectable = (id: string | null): id is string =>
    id !== null && groups.some((g) => g.exercises.some((e) => e.id === id));
  if (!isSelectable(selection.exerciseId)) {
    selection.exerciseId = null;
  }

  /** 選択中の種目・日付・セット番号から、重量・回数の初期値を入れ直す。 */
  function refillDraft(): void {
    errors = [];
    draft.note = '';
    const exerciseId = selection.exerciseId;
    if (exerciseId === null) {
      draft.weight = '';
      draft.reps = '';
      return;
    }
    const setNo = nextSetNo(sets, exerciseId, selection.date);
    const initial = suggestInitialValues(sets, exerciseId, selection.date, setNo);
    draft.weight = initial ? String(initial.weightKg) : '';
    draft.reps = initial ? String(initial.reps) : '';
  }

  async function submit(exerciseId: string): Promise<void> {
    const result = validateSetInput({ date: selection.date, ...draft });
    if (!result.ok) {
      errors = result.errors;
      render();
      return;
    }
    const setLog = createSetLog(
      { ...result.value, exerciseId, setNo: nextSetNo(sets, exerciseId, result.value.date) },
      { id: crypto.randomUUID(), now: new Date().toISOString() },
    );
    await repos.sets.put(setLog);
    sets = await repos.sets.list();
    refillDraft();
    render();
  }

  function renderSelectors(): HTMLElement {
    const dateInput = el('input', { type: 'date', id: 'record-date', value: selection.date });
    dateInput.addEventListener('change', () => {
      // 空にされた場合は今日に戻す
      selection.date = dateInput.value === '' ? toLocalDateString(new Date()) : dateInput.value;
      refillDraft();
      render();
    });

    const placeholder = el('option', { value: '', selected: selection.exerciseId === null }, [
      '選択してください',
    ]);
    const select = el('select', { id: 'record-exercise' }, [
      placeholder,
      ...groups.map((g) =>
        el(
          'optgroup',
          { label: bodyPartLabel(g.bodyPart) },
          g.exercises.map((e) =>
            el('option', { value: e.id, selected: e.id === selection.exerciseId }, [e.name]),
          ),
        ),
      ),
    ]);
    select.addEventListener('change', () => {
      selection.exerciseId = isSelectable(select.value) ? select.value : null;
      refillDraft();
      render();
    });

    return el('div', { className: 'record-selectors' }, [
      el('label', { htmlFor: 'record-date' }, ['日付']),
      dateInput,
      el('label', { htmlFor: 'record-exercise' }, ['種目']),
      select,
    ]);
  }

  function renderPrevious(exerciseId: string): HTMLElement {
    const previous = findPreviousSession(sets, exerciseId, selection.date);
    if (!previous) {
      return el('p', { className: 'previous' }, ['前回の記録はありません']);
    }
    return el('p', { className: 'previous' }, [
      `前回 ${formatShortDate(previous.date)}: ${previous.sets.map(formatSet).join(', ')}`,
    ]);
  }

  function renderForm(exerciseId: string): HTMLFormElement {
    const setNo = nextSetNo(sets, exerciseId, selection.date);

    const weight = el('input', {
      type: 'text',
      id: 'record-weight',
      inputMode: 'decimal',
      autocomplete: 'off',
      value: draft.weight,
    });
    weight.addEventListener('input', () => {
      draft.weight = weight.value;
    });
    const reps = el('input', {
      type: 'text',
      id: 'record-reps',
      inputMode: 'numeric',
      autocomplete: 'off',
      value: draft.reps,
    });
    reps.addEventListener('input', () => {
      draft.reps = reps.value;
    });
    const note = el('input', {
      type: 'text',
      id: 'record-note',
      autocomplete: 'off',
      value: draft.note,
    });
    note.addEventListener('input', () => {
      draft.note = note.value;
    });

    const form = el('form', { className: 'record-form' }, [
      el('h2', {}, [`${String(setNo)}セット目`]),
      el('div', { className: 'record-numbers' }, [
        el('div', {}, [el('label', { htmlFor: 'record-weight' }, ['重量(kg)']), weight]),
        el('div', {}, [el('label', { htmlFor: 'record-reps' }, ['回数']), reps]),
      ]),
      el('label', { htmlFor: 'record-note' }, ['メモ']),
      note,
      el('button', { type: 'submit', className: 'primary' }, ['記録する']),
      ...errors.map((message) => el('p', { className: 'error', role: 'alert' }, [message])),
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      runSafely(() => submit(exerciseId), SAVE_ERROR);
    });
    return form;
  }

  function renderDaySets(exerciseId: string): HTMLElement {
    const daySets = setsOf(sets, exerciseId, selection.date);
    const heading = el('h2', {}, ['この日のセット']);
    if (daySets.length === 0) {
      return el('section', { className: 'day-sets' }, [
        heading,
        el('p', { className: 'empty' }, ['まだ記録がありません']),
      ]);
    }
    return el('section', { className: 'day-sets' }, [
      heading,
      el(
        'ol',
        {},
        daySets.map((s) =>
          el('li', {}, [
            el('span', { className: 'set-no' }, [String(s.setNo)]),
            el('span', { className: 'set-values' }, [
              `${String(s.weightKg)}kg × ${String(s.reps)}`,
            ]),
            el('span', { className: 'set-note' }, [s.note]),
          ]),
        ),
      ),
    ]);
  }

  function render(): void {
    const children: HTMLElement[] = [el('h1', {}, ['記録'])];
    if (groups.length === 0) {
      children.push(
        el('p', { className: 'empty' }, ['先に「種目」タブで種目を登録してください']),
      );
    } else {
      children.push(renderSelectors());
      const exerciseId = selection.exerciseId;
      if (exerciseId !== null) {
        children.push(renderPrevious(exerciseId), renderForm(exerciseId), renderDaySets(exerciseId));
      }
    }
    root.replaceChildren(...children);
  }

  refillDraft();
  render();
}
