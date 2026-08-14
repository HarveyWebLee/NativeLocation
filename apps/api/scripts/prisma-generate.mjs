import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const apiRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const repoRoot = path.resolve(apiRoot, '../..');
const schemaPath = path.join(apiRoot, 'prisma', 'schema.prisma');
const clientDir = path.join(repoRoot, 'node_modules', '.prisma', 'client');
const clientMarker = path.join(clientDir, 'index.d.ts');
const hashPath = path.join(clientDir, '.schema-hash');
const prismaPkgPath = path.join(
  repoRoot,
  'node_modules',
  'prisma',
  'package.json',
);

function schemaFingerprint() {
  const schema = readFileSync(schemaPath);
  const prismaVersion = existsSync(prismaPkgPath)
    ? JSON.parse(readFileSync(prismaPkgPath, 'utf8')).version
    : '';
  return createHash('sha256')
    .update(schema)
    .update('\0')
    .update(prismaVersion)
    .digest('hex');
}

function clientExists() {
  return existsSync(clientMarker);
}

function storedHash() {
  return existsSync(hashPath) ? readFileSync(hashPath, 'utf8').trim() : null;
}

function persistHash(hash) {
  writeFileSync(hashPath, `${hash}\n`);
}

const hash = schemaFingerprint();

if (clientExists() && storedHash() === hash) {
  console.log('Prisma Client 已是当前 schema，跳过 generate');
  process.exit(0);
}

const result = spawnSync('prisma', ['generate'], {
  cwd: apiRoot,
  encoding: 'utf8',
  env: process.env,
  shell: true,
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.status === 0) {
  persistHash(hash);
  process.exit(0);
}

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const engineLocked = /EPERM|operation not permitted/i.test(output);
const firstRunWithExistingClient = clientExists() && storedHash() === null;

if (engineLocked && firstRunWithExistingClient) {
  persistHash(hash);
  console.warn(
    'Prisma generate 未能覆盖引擎（pnpm dev:api 占用了 Windows DLL）。已记录当前 schema hash，后续 typecheck 将跳过 generate。',
  );
  process.exit(0);
}

console.error(
  'Prisma generate 失败。若正在运行 pnpm dev:api，改过 schema 后必须先停掉 API，再 generate，然后重新启动。',
);
process.exit(result.status ?? 1);
