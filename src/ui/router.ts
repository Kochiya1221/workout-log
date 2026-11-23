import { el } from './dom';
import { LOAD_ERROR, runSafely } from './notice';

export interface Route {
  /** '#/record' の '/record' 部分 */
  readonly path: string;
  /** タブに表示する名前 */
  readonly label: string;
  /** 画面を container に描画する */
  readonly mount: (container: HTMLElement) => Promise<void>;
}

/**
 * ハッシュ（#/record など）で画面を切り替え、画面下にタブバーを表示する。
 * 未知のハッシュは最初の画面に置き換える。
 */
export interface Router {
  /** 今の画面を描き直す（同期で端末のデータが変わったときなど） */
  refresh(): void;
}

export function startRouter(app: HTMLElement, routes: readonly [Route, ...Route[]]): Router {
  const main = el('main', { className: 'screen' });
  const tabs = routes.map((route) =>
    el('a', { href: `#${route.path}`, className: 'tab' }, [route.label]),
  );
  const nav = el('nav', { className: 'tabbar' }, tabs);
  nav.setAttribute('aria-label', '画面の切り替え');
  app.replaceChildren(main, nav);

  let current: Route | null = null;

  function show(): void {
    const path = location.hash.replace(/^#/, '');
    const route = routes.find((r) => r.path === path) ?? routes[0];
    if (route.path !== path) {
      history.replaceState(null, '', `#${route.path}`);
    }
    routes.forEach((r, i) => {
      const active = r === route;
      tabs[i]?.classList.toggle('active', active);
      if (active) {
        tabs[i]?.setAttribute('aria-current', 'page');
      } else {
        tabs[i]?.removeAttribute('aria-current');
      }
    });
    const keepScroll = current === route;
    current = route;
    // 画面ごとに新しい入れ物を使う（前の画面の非同期処理が新しい画面を書き換えないように）
    const container = el('div');
    main.replaceChildren(container);
    if (!keepScroll) {
      window.scrollTo(0, 0);
    }
    runSafely(() => route.mount(container), LOAD_ERROR);
  }

  window.addEventListener('hashchange', show);
  show();
  return { refresh: show };
}
