/// <reference lib="webworker" />
// アプリ本体（HTML・JS・CSS・アイコン）をキャッシュして、オフラインでも開けるようにする。
// 記録データは IndexedDB、同期は GitHub API への直接通信なので、ここでは扱わない。
import { CACHE_PREFIX } from './precache';

declare const self: ServiceWorkerGlobalScope;

// ビルド時に build/swPlugin.ts が実際の一覧と版に置き換える
const PRECACHE = JSON.parse('__PRECACHE__') as string[];
const VERSION = '__VERSION__';
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;

/** sw.js の場所（/workout-log/sw.js）から base（/workout-log/）を求める。 */
const BASE = new URL('./', self.location.href).pathname;
/** アプリの入口（中身は index.html）。事前キャッシュに必ず含まれる */
const APP_SHELL = BASE;
const precached = new Set(PRECACHE);

self.addEventListener('install', (event) => {
  // 自動では切り替えない（入力中に版が混ざらないように）。「更新」ボタンで切り替える
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

/**
 * キャッシュから探す。URL のパスだけで探し、Vary も無視する
 * （JS・CSS は crossorigin 付きで Origin ヘッダが付くため、Vary: Origin だと見つからなくなる）。
 */
async function fromCache(path: string): Promise<Response | undefined> {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(path, { ignoreSearch: true, ignoreVary: true });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // 他のオリジン（GitHub API など）と GET 以外には一切手を出さない
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate' && url.pathname.startsWith(BASE)) {
    // ページの読み込みは、キャッシュしたアプリ本体を返す（オフラインでも開ける）
    event.respondWith(
      (async () => (await fromCache(APP_SHELL)) ?? fetch(request))(),
    );
    return;
  }

  if (precached.has(url.pathname)) {
    event.respondWith((async () => (await fromCache(url.pathname)) ?? fetch(request))());
  }
});
