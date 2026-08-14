import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function findRepoRoot(startDir = process.cwd()) {
  let dir = startDir;
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return undefined;
}

/** 加载根目录 `.env`；已有环境变量不覆盖。文件不存在则跳过。 */
export function loadRootEnv(startDir = process.cwd()) {
  const root = findRepoRoot(startDir);
  if (!root) {
    return;
  }
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath) || typeof process.loadEnvFile !== 'function') {
    return;
  }
  process.loadEnvFile(envPath);
}
