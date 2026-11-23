import { showUpdateNotice } from '../ui/notice';

/**
 * Service Worker を登録し、新しい版が届いたら「更新」のお知らせを出す。
 * 開発サーバーでは登録しない。失敗してもアプリはそのまま動く。
 */
export async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }
  const base = import.meta.env.BASE_URL;
  try {
    const registration = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });

    // 既に動いている版がある状態で、新しい版が待機していたら知らせる
    const notifyIfWaiting = (): void => {
      const waiting = registration.waiting;
      if (waiting && navigator.serviceWorker.controller) {
        showUpdateNotice(() => {
          waiting.postMessage('SKIP_WAITING');
        });
      }
    };
    notifyIfWaiting();
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          notifyIfWaiting();
        }
      });
    });

    // 新しい版に切り替わったら、1回だけ読み込み直す
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloaded && navigator.serviceWorker.controller) {
        reloaded = true;
        location.reload();
      }
    });

    // ホーム画面のアプリは自動で確認されにくいので、前面に戻ったときに新しい版を確認する
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update().catch(() => undefined);
      }
    });
  } catch (error) {
    console.error('Service Worker を登録できませんでした', error);
  }
}
