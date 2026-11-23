import { buildMonthGrid, daySummary, shiftMonth, trainedDates } from '../domain/calendar';
import { formatDateWithWeekday, formatYearMonth, toLocalDateString } from '../domain/date';
import type { SetLog } from '../domain/setLog';
import { isPersonalDay, type TrainingDay } from '../domain/trainingDay';
import type {
  ExerciseRepository,
  SetLogRepository,
  TrainingDayRepository,
} from '../storage/repository';
import { el } from './dom';
import { SAVE_ERROR, runSafely } from './notice';
import { personalToggle, savePersonalDay } from './personalToggle';
import { selectRecordDate } from './recordScreen';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** タブを切り替えて戻っても保持する表示（再読み込みで今月・今日に戻る）。 */
const today = new Date();
const view = {
  year: today.getFullYear(),
  month: today.getMonth() + 1,
  selected: toLocalDateString(today),
};

function formatSet(s: Pick<SetLog, 'weightKg' | 'reps'>): string {
  return `${String(s.weightKg)}kg×${String(s.reps)}`;
}

/** カレンダー画面を root に描画する。 */
export async function mountCalendarScreen(
  root: HTMLElement,
  repos: {
    readonly exercises: ExerciseRepository;
    readonly sets: SetLogRepository;
    readonly days: TrainingDayRepository;
  },
): Promise<void> {
  const exercises = await repos.exercises.list();
  const sets = await repos.sets.list();
  let days: TrainingDay[] = await repos.days.list();

  function moveMonth(delta: number): void {
    const next = shiftMonth(view.year, view.month, delta);
    view.year = next.year;
    view.month = next.month;
    render();
  }

  function renderHeader(): HTMLElement {
    const prev = el('button', { type: 'button', className: 'month-nav', ariaLabel: '前の月' }, ['‹']);
    prev.addEventListener('click', () => {
      moveMonth(-1);
    });
    const next = el('button', { type: 'button', className: 'month-nav', ariaLabel: '次の月' }, ['›']);
    next.addEventListener('click', () => {
      moveMonth(1);
    });
    const thisMonth = el('button', { type: 'button', className: 'this-month' }, ['今月']);
    thisMonth.addEventListener('click', () => {
      const now = new Date();
      view.year = now.getFullYear();
      view.month = now.getMonth() + 1;
      view.selected = toLocalDateString(now);
      render();
    });
    return el('div', { className: 'calendar-header' }, [
      prev,
      el('h2', { className: 'calendar-title' }, [formatYearMonth(view.year, view.month)]),
      next,
      thisMonth,
    ]);
  }

  function renderGrid(): HTMLElement {
    const trained = trainedDates(sets);
    const todayStr = toLocalDateString(new Date());
    const head = WEEKDAYS.map((w, i) =>
      el('div', { className: `weekday${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}` }, [w]),
    );
    const cells = buildMonthGrid(view.year, view.month)
      .flat()
      .map((cell) => {
        if (!cell) {
          return el('div', { className: 'day-cell empty' });
        }
        const hasRecord = trained.has(cell.date);
        const personal = isPersonalDay(days, cell.date);
        const classes = [
          'day-cell',
          hasRecord ? 'trained' : '',
          personal ? 'personal' : '',
          cell.date === todayStr ? 'today' : '',
          cell.date === view.selected ? 'selected' : '',
        ].filter((c) => c !== '');
        const label = [
          `${String(view.month)}月${String(cell.day)}日`,
          hasRecord ? '記録あり' : '',
          personal ? 'パーソナル' : '',
        ]
          .filter((t) => t !== '')
          .join(' ');
        const button = el(
          'button',
          { type: 'button', className: classes.join(' '), ariaLabel: label },
          [
            el('span', { className: 'day-number' }, [String(cell.day)]),
            ...(personal ? [el('span', { className: 'day-mark' }, ['P'])] : []),
          ],
        );
        button.dataset.date = cell.date;
        button.setAttribute('aria-pressed', String(cell.date === view.selected));
        button.addEventListener('click', () => {
          view.selected = cell.date;
          render();
        });
        return button;
      });
    return el('div', { className: 'calendar-grid' }, [...head, ...cells]);
  }

  function renderLegend(): HTMLElement {
    return el('p', { className: 'calendar-legend' }, [
      el('span', { className: 'legend-trained' }, ['記録あり']),
      el('span', { className: 'legend-personal' }, ['P パーソナル']),
    ]);
  }

  function renderDetail(): HTMLElement {
    const date = view.selected;
    const summary = daySummary(sets, exercises, date);
    const toggle = personalToggle('calendar-personal', isPersonalDay(days, date), (checked) => {
      runSafely(async () => {
        await savePersonalDay(repos.days, date, checked);
        days = await repos.days.list();
        render();
      }, SAVE_ERROR);
    });
    const recordButton = el('button', { type: 'button', className: 'primary' }, [
      'この日を記録する',
    ]);
    recordButton.addEventListener('click', () => {
      selectRecordDate(date);
      location.hash = '#/record';
    });
    return el('section', { className: 'calendar-detail' }, [
      el('h2', {}, [formatDateWithWeekday(date, toLocalDateString(new Date()))]),
      toggle,
      summary.length === 0
        ? el('p', { className: 'empty' }, ['この日の記録はありません'])
        : el(
            'ul',
            { className: 'day-summary' },
            summary.map((entry) =>
              el('li', {}, [
                el('span', { className: 'summary-name' }, [entry.exerciseName]),
                el('span', { className: 'summary-sets' }, [entry.sets.map(formatSet).join(', ')]),
              ]),
            ),
          ),
      recordButton,
    ]);
  }

  function render(): void {
    root.replaceChildren(
      el('h1', {}, ['カレンダー']),
      renderHeader(),
      renderGrid(),
      renderLegend(),
      renderDetail(),
    );
  }

  render();
}
