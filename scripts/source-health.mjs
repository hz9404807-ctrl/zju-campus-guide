import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { DEFAULT_LIMITS, runSourceHealth, renderMarkdown } from './source-health-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const options = { limits: { ...DEFAULT_LIMITS } };
for (const argument of process.argv.slice(2)) {
  if (argument === '--offline') options.offline = true;
  else if (/^--max-requests=\d+$/.test(argument)) options.limits.maxRequests = Number(argument.split('=')[1]);
  else if (/^--as-of=\d{4}-\d{2}-\d{2}$/.test(argument)) options.asOf = argument.split('=')[1];
  else {
    console.error('只接受 --offline、--max-requests=1..100、--as-of=YYYY-MM-DD；不接受任意 URL 或外部输入文件。');
    process.exitCode = 1;
  }
}
if (!process.exitCode) {
  try {
    const [guides, websites, accounts, windows] = await Promise.all(['guides', 'websites', 'accounts', 'service-windows'].map(async (name) => JSON.parse(await readFile(join(root, 'src', 'data', `${name}.json`), 'utf8'))));
    const report = await runSourceHealth({ guides, websites, accounts, windows }, options);
    const output = join(root, 'outputs');
    await mkdir(output, { recursive: true });
    await Promise.all([writeFile(join(output, 'source-health.json'), JSON.stringify(report, null, 2) + '\n'), writeFile(join(output, 'source-health.md'), renderMarkdown(report))]);
    console.log(`资料检查已写入 outputs/source-health.json 和 .md：${report.summary.uniqueLinks} 个去重来源，${report.requests} 次请求，${report.summary.dateCandidates} 条日期候选，${report.summary.conflictCandidates} 条疑似冲突，${report.summary.missingSources} 条缺少在线核查依据。HTTP成功不代表内容已核实。`);
  } catch (error) {
    console.error(`资料检查未完成：${error.code?.startsWith('INVALID_') ? error.code : '读取配置或输出报告失败'}。`);
    process.exitCode = 1;
  }
}
