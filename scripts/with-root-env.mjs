import { spawn } from 'node:child_process';
import process from 'node:process';

import { loadRootEnv } from './load-root-env.mjs';

loadRootEnv();

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error('用法: node scripts/with-root-env.mjs <命令> [参数...]');
  process.exit(1);
}

const child = spawn(argv[0], argv.slice(1), {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
