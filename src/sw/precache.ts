/** ビルド時に sw.js の中で置き換える目印。 */
export const PRECACHE_PLACEHOLDER = '__PRECACHE__';
export const VERSION_PLACEHOLDER = '__VERSION__';
export const SW_FILE_NAME = 'sw.js';
export const CACHE_PREFIX = 'workout-log-';

/**
 * 事前にキャッシュする URL の一覧を作る（base 付き、順序は安定）。
 * sw.js 自身・ソースマップ・隠しファイルは含めない。アプリの入口（base そのもの）は含める。
 */
export function buildPrecacheList(
  bundleFiles: readonly string[],
  publicFiles: readonly string[],
  base: string,
): string[] {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const urls = new Set<string>([prefix]);
  for (const file of [...bundleFiles, ...publicFiles]) {
    const name = file.replace(/^\/+/, '').replace(/\\/g, '/');
    if (
      name === '' ||
      name === SW_FILE_NAME ||
      name.endsWith('.map') ||
      name.split('/').some((part) => part.startsWith('.'))
    ) {
      continue;
    }
    urls.add(`${prefix}${name}`);
  }
  return [...urls].sort();
}

/** 文字列から 32 ビットの FNV-1a ハッシュを作る。 */
function fnv1a(text: string, seed = 0x811c9dc5): number {
  let hash = seed;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * キャッシュの版。ファイル名と中身から作るので、どちらかが変われば変わる。
 * contents はファイル名 → 中身（文字列）。
 */
export function precacheVersion(
  list: readonly string[],
  contents: Readonly<Record<string, string>>,
): string {
  let hash = fnv1a(list.join('\n'));
  for (const key of Object.keys(contents).sort()) {
    hash = fnv1a(`${key}\n${contents[key] ?? ''}`, hash);
  }
  return hash.toString(16).padStart(8, '0');
}
