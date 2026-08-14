import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { applyDatabaseUrl } = require('./apply-database-url.cjs');

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(apiRoot, '../..');
const envPath = resolve(repoRoot, '.env');

if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}

applyDatabaseUrl(process.env);

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error(
    '用法: node scripts/run-with-database-url.mjs <命令> [参数...]',
  );
  process.exit(1);
}

const child = spawn(argv[0], argv.slice(1), {
  stdio: 'inherit',
  env: process.env,
  cwd: apiRoot,
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
