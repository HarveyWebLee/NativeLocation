import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const driveMatch = root.match(/^([A-Za-z]):[\\/]/);

if (!driveMatch) {
  console.error('无法将项目路径转换为 WSL 路径:', root);
  process.exit(1);
}

const wslRoot = `/mnt/${driveMatch[1].toLowerCase()}/${root
  .slice(driveMatch[0].length)
  .replace(/\\/g, '/')}`;

const composeArgs = process.argv.slice(2);
if (composeArgs.length === 0) {
  console.error('用法: node scripts/wsl-compose.mjs <docker compose 参数...>');
  process.exit(1);
}

const remoteCommand = [
  'cd',
  JSON.stringify(wslRoot),
  '&&',
  'docker',
  'compose',
  '--env-file',
  '.env',
  ...composeArgs.map((arg) => JSON.stringify(arg)),
].join(' ');

const result = spawnSync('wsl', ['-e', 'bash', '-lc', remoteCommand], {
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
