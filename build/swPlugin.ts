import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin, ResolvedConfig, Rollup } from 'vite';
import {
  PRECACHE_PLACEHOLDER,
  SW_FILE_NAME,
  VERSION_PLACEHOLDER,
  buildPrecacheList,
  precacheVersion,
} from '../src/sw/precache.ts';

const SW_ENTRY = 'src/sw/serviceWorker.ts';

/** public/ 以下のファイル（public からの相対パス）。 */
function listFiles(dir: string, root = dir): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full, root) : [relative(root, full)];
  });
}

function contentOf(item: Rollup.OutputChunk | Rollup.OutputAsset): string {
  return item.type === 'chunk'
    ? item.code
    : typeof item.source === 'string'
      ? item.source
      : Buffer.from(item.source).toString('base64');
}

/**
 * ビルド時に Service Worker を sw.js（固定名）として出力し、
 * 事前キャッシュの一覧と版を埋め込む。開発サーバーでは何もしない。
 */
export function serviceWorkerPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'workout-log-service-worker',
    apply: 'build',
    // index.html などが出力されたあとに一覧を作る
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      this.emitFile({ type: 'chunk', id: SW_ENTRY, fileName: SW_FILE_NAME });
    },
    generateBundle(_options, bundle) {
      const sw = bundle[SW_FILE_NAME];
      if (sw?.type !== 'chunk') {
        this.error('sw.js が出力されていません');
      }
      const publicFiles = config.publicDir ? listFiles(config.publicDir) : [];
      const bundleFiles = Object.keys(bundle).filter((name) => name !== SW_FILE_NAME);
      const list = buildPrecacheList(bundleFiles, publicFiles, config.base);
      if (!list.includes(`${config.base}index.html`)) {
        this.error('事前キャッシュの一覧に index.html がありません');
      }

      const contents: Record<string, string> = {};
      for (const name of bundleFiles) {
        const item = bundle[name];
        if (item) {
          contents[name] = contentOf(item);
        }
      }
      for (const name of publicFiles) {
        contents[`public/${name}`] = readFileSync(join(config.publicDir, name)).toString('base64');
      }
      const version = precacheVersion(list, contents);

      const pattern = new RegExp(`JSON\\.parse\\((["'\`])${PRECACHE_PLACEHOLDER}\\1\\)`);
      if (!pattern.test(sw.code) || !sw.code.includes(VERSION_PLACEHOLDER)) {
        this.error('sw.js の中に置き換える目印が見つかりません');
      }
      sw.code = sw.code
        .replace(pattern, JSON.stringify(list))
        .replaceAll(VERSION_PLACEHOLDER, version);
    },
  };
}
