import { describe, expect, it } from 'vitest';
import { buildPrecacheList, precacheVersion } from './precache';

describe('buildPrecacheList', () => {
  it('base を付け、入口・index.html・アセット・public のファイルを含める', () => {
    expect(
      buildPrecacheList(
        ['index.html', 'assets/index-abc.js', 'assets/index-def.css'],
        ['manifest.webmanifest', 'icons/icon-192.png'],
        '/workout-log/',
      ),
    ).toEqual([
      '/workout-log/',
      '/workout-log/assets/index-abc.js',
      '/workout-log/assets/index-def.css',
      '/workout-log/icons/icon-192.png',
      '/workout-log/index.html',
      '/workout-log/manifest.webmanifest',
    ]);
  });

  it('sw.js・ソースマップ・隠しファイルは除き、重複は1つにする', () => {
    expect(
      buildPrecacheList(
        ['sw.js', 'assets/index-abc.js', 'assets/index-abc.js.map', 'index.html'],
        ['.DS_Store', 'icons/.keep', 'index.html'],
        '/workout-log',
      ),
    ).toEqual(['/workout-log/', '/workout-log/assets/index-abc.js', '/workout-log/index.html']);
  });

  it('入力の順序に関係なく同じ並び', () => {
    const a = buildPrecacheList(['b.js', 'a.js'], ['z.png'], '/x/');
    const b = buildPrecacheList(['a.js', 'b.js'], ['z.png'], '/x/');
    expect(a).toEqual(b);
  });
});

describe('precacheVersion', () => {
  const list = ['/x/', '/x/a.js'];

  it('同じ入力なら同じ版（8桁の16進）', () => {
    const v = precacheVersion(list, { 'index.html': '<html>' });
    expect(v).toMatch(/^[0-9a-f]{8}$/);
    expect(precacheVersion(list, { 'index.html': '<html>' })).toBe(v);
  });

  it('ファイル名か中身が変われば版が変わる', () => {
    const v = precacheVersion(list, { 'index.html': '<html>' });
    expect(precacheVersion(['/x/', '/x/b.js'], { 'index.html': '<html>' })).not.toBe(v);
    expect(precacheVersion(list, { 'index.html': '<html lang="ja">' })).not.toBe(v);
  });
});
