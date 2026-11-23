import { BODY_PARTS, bodyPartLabel, isBodyPart, type BodyPart } from '../domain/bodyPart';
import {
  MAX_NAME_LENGTH,
  createExercise,
  deleteExercise,
  groupByBodyPart,
  updateExercise,
  validateExerciseName,
  type Exercise,
} from '../domain/exercise';
import type { ExerciseRepository } from '../storage/repository';
import { el } from './dom';
import { SAVE_ERROR, runSafely } from './notice';

interface State {
  exercises: Exercise[];
  /** 編集中の種目の id。null なら新規追加。 */
  editingId: string | null;
  nameDraft: string;
  bodyPartDraft: BodyPart;
  error: string | null;
}

/** 種目画面を root に描画する。 */
export async function mountExerciseScreen(
  root: HTMLElement,
  repo: ExerciseRepository,
): Promise<void> {
  const state: State = {
    exercises: await repo.list(),
    editingId: null,
    nameDraft: '',
    bodyPartDraft: 'chest',
    error: null,
  };

  const now = (): string => new Date().toISOString();

  async function reload(): Promise<void> {
    state.exercises = await repo.list();
  }

  function resetForm(): void {
    state.editingId = null;
    state.nameDraft = '';
    state.error = null;
  }

  async function submit(): Promise<void> {
    const result = validateExerciseName(
      state.nameDraft,
      state.exercises,
      state.editingId ?? undefined,
    );
    if (!result.ok) {
      state.error = result.error;
      render();
      return;
    }
    const input = { name: result.name, bodyPart: state.bodyPartDraft };
    const editing = state.exercises.find((e) => e.id === state.editingId);
    const saved = editing
      ? updateExercise(editing, input, now())
      : createExercise(input, { id: crypto.randomUUID(), now: now() });
    await repo.put(saved);
    await reload();
    resetForm();
    render();
  }

  function startEdit(exercise: Exercise): void {
    state.editingId = exercise.id;
    state.nameDraft = exercise.name;
    state.bodyPartDraft = exercise.bodyPart;
    state.error = null;
    render();
  }

  async function remove(exercise: Exercise): Promise<void> {
    if (!window.confirm(`「${exercise.name}」を削除しますか？`)) {
      return;
    }
    await repo.put(deleteExercise(exercise, now()));
    await reload();
    if (state.editingId === exercise.id) {
      resetForm();
    }
    render();
  }

  function renderForm(): HTMLFormElement {
    const nameInput = el('input', {
      type: 'text',
      id: 'exercise-name',
      value: state.nameDraft,
      maxLength: MAX_NAME_LENGTH,
      autocomplete: 'off',
      placeholder: '例: ベンチプレス',
    });
    nameInput.addEventListener('input', () => {
      state.nameDraft = nameInput.value;
    });

    const select = el(
      'select',
      { id: 'exercise-body-part' },
      BODY_PARTS.map((part) =>
        el('option', { value: part, selected: part === state.bodyPartDraft }, [
          bodyPartLabel(part),
        ]),
      ),
    );
    select.addEventListener('change', () => {
      if (isBodyPart(select.value)) {
        state.bodyPartDraft = select.value;
      }
    });

    const isEditing = state.editingId !== null;
    const buttons = el('div', { className: 'form-buttons' }, [
      el('button', { type: 'submit', className: 'primary' }, [isEditing ? '更新' : '追加']),
    ]);
    if (isEditing) {
      const cancel = el('button', { type: 'button' }, ['キャンセル']);
      cancel.addEventListener('click', () => {
        resetForm();
        render();
      });
      buttons.append(cancel);
    }

    const form = el('form', { className: 'exercise-form' }, [
      el('label', { htmlFor: 'exercise-name' }, ['種目名']),
      nameInput,
      el('label', { htmlFor: 'exercise-body-part' }, ['部位']),
      select,
      buttons,
    ]);
    if (state.error !== null) {
      form.append(el('p', { className: 'error', role: 'alert' }, [state.error]));
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      runSafely(submit, SAVE_ERROR);
    });
    return form;
  }

  function renderList(): HTMLElement {
    const groups = groupByBodyPart(state.exercises);
    if (groups.length === 0) {
      return el('p', { className: 'empty' }, ['種目が登録されていません']);
    }
    return el(
      'div',
      { className: 'exercise-list' },
      groups.map((group) =>
        el('section', {}, [
          el('h2', {}, [bodyPartLabel(group.bodyPart)]),
          el(
            'ul',
            {},
            group.exercises.map((exercise) => {
              const edit = el('button', { type: 'button' }, ['編集']);
              edit.addEventListener('click', () => {
                startEdit(exercise);
              });
              const del = el('button', { type: 'button', className: 'danger' }, ['削除']);
              del.addEventListener('click', () => {
                runSafely(() => remove(exercise), SAVE_ERROR);
              });
              return el(
                'li',
                { className: exercise.id === state.editingId ? 'editing' : '' },
                [
                  el('span', { className: 'name' }, [exercise.name]),
                  el('span', { className: 'actions' }, [edit, del]),
                ],
              );
            }),
          ),
        ]),
      ),
    );
  }

  function render(): void {
    root.replaceChildren(el('h1', {}, ['種目']), renderForm(), renderList());
  }

  render();
}
