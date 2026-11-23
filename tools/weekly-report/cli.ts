/**
 * 週次レポートの集計（Claude Code の workout-weekly スキルから使う）。
 *
 * 使い方（workout-log のフォルダで）:
 *   npm run -s report -- --data-dir ~/dev/workout-log-data [--end YYYY-MM-DD] [--format markdown|json]
 *
 * - 期間は既定で「実行した日を含まない過去7日間」。--end でその日を最終日にできる
 * - 結果は標準出力に出すだけで、ファイルは書かない（記録データをこのリポジトリに入れないため）
 */
import { toLocalDateString } from '../../src/domain/date';
import { buildWeeklyReport } from './analyze';
import { loadWorkoutData } from './loadData';
import { renderMarkdown } from './markdown';
import { reportPeriod } from './period';

interface Options {
  dataDir: string;
  end: string | undefined;
  format: 'markdown' | 'json';
}

export function parseArgs(args: readonly string[]): Options {
  let dataDir: string | undefined;
  let end: string | undefined;
  let format: Options['format'] = 'markdown';
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];
    if (arg === '--data-dir' && value !== undefined) {
      dataDir = value;
      i++;
    } else if (arg === '--end' && value !== undefined) {
      end = value;
      i++;
    } else if (arg === '--format' && (value === 'markdown' || value === 'json')) {
      format = value;
      i++;
    } else {
      throw new Error(`不明な引数です: ${arg ?? ''}`);
    }
  }
  if (dataDir === undefined) {
    throw new Error('--data-dir でデータのフォルダを指定してください');
  }
  return { dataDir, end, format };
}

function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2));
    const period = reportPeriod(toLocalDateString(new Date()), options.end);
    const report = buildWeeklyReport(loadWorkoutData(options.dataDir), period);
    process.stdout.write(
      options.format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report),
    );
  } catch (error) {
    process.stderr.write(`エラー: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

// テストから読み込まれたときは実行しない
if (process.env.VITEST === undefined) {
  main();
}
