#!/usr/bin/env node
/**
 * afterFileEdit：对 Agent 改过的源码跑 prettier + eslint --fix（含 import 顺序）
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CODE_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.css',
]);

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function run(bin, args, cwd) {
  execFileSync(bin, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
}

const raw = await readStdin();
let payload;
try {
  payload = JSON.parse(raw || '{}');
} catch {
  process.exit(0);
}

const filePath = payload.file_path;
if (!filePath || !fs.existsSync(filePath)) {
  process.exit(0);
}

const ext = path.extname(filePath).toLowerCase();
if (!CODE_EXT.has(ext)) {
  process.exit(0);
}

const roots = payload.workspace_roots?.length
  ? payload.workspace_roots
  : [process.cwd()];
const root = roots[0];

try {
  run('pnpm', ['exec', 'prettier', '--write', filePath], root);
  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    run(
      'pnpm',
      ['exec', 'eslint', '--fix', '--no-warn-ignored', filePath],
      root,
    );
  }
} catch {
  // 格式化失败不阻断 Agent；正式门禁在 git pre-commit
  process.exit(0);
}

process.exit(0);
