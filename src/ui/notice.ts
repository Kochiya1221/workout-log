import { el } from './dom';

export const SAVE_ERROR = '保存に失敗しました。もう一度お試しください';
export const LOAD_ERROR = 'データを読み込めませんでした。ページを再読み込みしてください';

let area: HTMLElement | null = null;

/** お知らせを出す場所（画面上部）。最初に呼ばれたときに作る。 */
function noticeArea(): HTMLElement {
  if (!area) {
    area = el('div', { className: 'notices' });
    document.body.prepend(area);
  }
  return area;
}

/** エラーを画面上部に表示する（× で閉じられる。同じ文言は重ねて出さない）。 */
export function showError(message: string): void {
  const container = noticeArea();
  const exists = [...container.querySelectorAll('.notice-text')].some(
    (n) => n.textContent === message,
  );
  if (exists) {
    return;
  }
  const close = el('button', { type: 'button', className: 'notice-close' }, ['×']);
  close.setAttribute('aria-label', '閉じる');
  const notice = el('div', { className: 'notice error-notice', role: 'alert' }, [
    el('span', { className: 'notice-text' }, [message]),
    close,
  ]);
  close.addEventListener('click', () => {
    notice.remove();
  });
  container.append(notice);
}

/** 閉じられない警告を表示する（保存できない環境など）。 */
export function showPermanentWarning(message: string): void {
  noticeArea().append(
    el('div', { className: 'notice warning-notice', role: 'status' }, [
      el('span', { className: 'notice-text' }, [message]),
    ]),
  );
}

/** 非同期処理を実行し、失敗したらエラーを表示する。 */
export function runSafely(task: () => Promise<void>, message: string): void {
  task().catch((error: unknown) => {
    console.error(error);
    showError(message);
  });
}
