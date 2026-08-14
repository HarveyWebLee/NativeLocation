import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { applyDatabaseUrl } from '../scripts/apply-database-url.cjs';

function findRepoRoot(startDir: string): string | undefined {
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

/**
 * 加载仓库根目录 `.env`。已存在的 process.env 不覆盖（生产 Compose / EAS 注入优先）。
 * 文件不存在时跳过（镜像与云构建不会带开发用 .env）。
 */
export function loadRootEnv(): void {
  const root = findRepoRoot(process.cwd());
  if (!root) {
    return;
  }
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath) || typeof process.loadEnvFile !== 'function') {
    return;
  }
  process.loadEnvFile(envPath);
}

loadRootEnv();
applyDatabaseUrl();
