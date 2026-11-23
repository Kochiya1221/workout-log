import { formatDateWithWeekday, formatShortDate, toLocalDateString } from '../domain/date';
import { buildHistory, type HistoryEntry } from '../domain/history';
import { deleteSetLog, updateSetLog, validateSetInput, type SetLog } from '../domain/setLog';
import type { ExerciseRepository, SetLogRepository } from '../storage/repository';
import { el } from './dom';

interface EditState {
  id: string;
  weight: string;
  reps: string;
  note: string;
  errors: readonly string[];
}

/** 履歴画面を root に描画する。 */
export async function mountHistoryScreen(
  root: HTMLElement,
  repos: { readonly exercises: ExerciseRepository; readonly sets: SetLogRepository },
): Promise<void> {
  const exercises = await repos.exercises.list();
  let sets: SetLog[] = await repos.sets.list();
  /** 編集中の行（同時に1行だけ） */
  let editing: EditState | null = null;
  const now = (): string => new Date().toISOString();

  function startEdit(s: SetLog): void {
    editing = {
      id: s.id,
      weight: String(s.weightKg),
      reps: String(s.reps),
      note: s.note,
      errors: [],
    };
    render();
  }

  async function save(s: SetLog, edit: EditState): Promise<void> {
    const result = validateSetInput({ date: s.date, ...edit });
    if (!result.ok) {
      editing = { ...edit, errors: result.errors };
      render();
      return;
    }
    await repos.sets.put(updateSetLog(s, result.value, now()));
    sets = await repos.sets.list();
    editing = null;
    render();
  }

  async function remove(s: SetLog, entry: HistoryEntry): Promise<void> {
    const label = `${formatShortDate(s.date)} ${entry.exerciseName} ${String(s.setNo)}セット目（${String(s.weightKg)}kg×${String(s.reps)}）`;
    if (!window.confirm(`${label}を削除しますか？`)) {
      return;
    }
    for (const changed of deleteSetLog(sets, s.id, now())) {
      await repos.sets.put(changed);
    }
    sets = await repos.sets.list();
    if (editing?.id === s.id) {
      editing = null;
    }
    render();
  }

  function renderEditForm(s: SetLog, edit: EditState): HTMLElement {
    const field = (
      key: 'weight' | 'reps' | 'note',
      label: string,
      inputMode: string,
    ): HTMLElement => {
      const input = el('input', {
        type: 'text',
        inputMode,
        autocomplete: 'off',
        value: edit[key],
        ariaLabel: label,
      });
      input.addEventListener('input', () => {
        edit[key] = input.value;
      });
      return el('label', { className: `field-${key}` }, [label, input]);
    };

    const cancel = el('button', { type: 'button' }, ['キャンセル']);
    cancel.addEventListener('click', () => {
      editing = null;
      render();
    });

    const form = el('form', { className: 'history-edit' }, [
      el('span', { className: 'set-no' }, [String(s.setNo)]),
      el('div', { className: 'history-edit-fields' }, [
        field('weight', '重量(kg)', 'decimal'),
        field('reps', '回数', 'numeric'),
        field('note', 'メモ', 'text'),
        el('div', { className: 'form-buttons' }, [
          el('button', { type: 'submit', className: 'primary' }, ['保存']),
          cancel,
        ]),
        ...edit.errors.map((m) => el('p', { className: 'error', role: 'alert' }, [m])),
      ]),
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void save(s, edit);
    });
    return form;
  }

  function renderSetRow(s: SetLog, entry: HistoryEntry): HTMLElement {
    if (editing?.id === s.id) {
      return el('li', { className: 'editing' }, [renderEditForm(s, editing)]);
    }
    const edit = el('button', { type: 'button' }, ['編集']);
    edit.addEventListener('click', () => {
      startEdit(s);
    });
    const del = el('button', { type: 'button', className: 'danger' }, ['削除']);
    del.addEventListener('click', () => {
      void remove(s, entry);
    });
    return el('li', {}, [
      el('span', { className: 'set-no' }, [String(s.setNo)]),
      el('span', { className: 'history-set-body' }, [
        el('span', { className: 'set-values' }, [`${String(s.weightKg)}kg × ${String(s.reps)}`]),
        el('span', { className: 'set-note' }, [s.note]),
      ]),
      el('span', { className: 'actions' }, [edit, del]),
    ]);
  }

  function render(): void {
    const history = buildHistory(sets, exercises);
    const today = toLocalDateString(new Date());
    const body =
      history.length === 0
        ? [el('p', { className: 'empty' }, ['まだ記録がありません'])]
        : history.map((day) =>
            el('section', { className: 'history-day' }, [
              el('h2', {}, [formatDateWithWeekday(day.date, today)]),
              ...day.entries.map((entry) =>
                el('div', { className: 'history-entry' }, [
                  el('h3', { className: entry.exerciseDeleted ? 'deleted' : '' }, [
                    entry.exerciseName,
                  ]),
                  el(
                    'ol',
                    {},
                    entry.sets.map((s) => renderSetRow(s, entry)),
                  ),
                ]),
              ),
            ]),
          );
    root.replaceChildren(el('h1', {}, ['履歴']), ...body);
  }

  render();
}
