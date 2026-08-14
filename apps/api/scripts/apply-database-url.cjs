'use strict';

const REQUIRED_KEYS = [
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
];

const GENERATE_PLACEHOLDER_URL =
  'postgresql://nativelocation:nativelocation@127.0.0.1:16875/nativelocation?schema=public';

/**
 * @param {string} host
 * @returns {string}
 */
function formatHost(host) {
  if (host.includes(':') && !host.startsWith('[')) {
    return `[${host}]`;
  }
  return host;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ user: string, password: string, database: string, host: string, port: string } | null}
 */
function readPostgresParts(env = process.env) {
  const user = env.POSTGRES_USER?.trim() ?? '';
  const password = env.POSTGRES_PASSWORD?.trim() ?? '';
  const database = env.POSTGRES_DB?.trim() ?? '';
  const host = env.POSTGRES_HOST?.trim() ?? '';
  const port = env.POSTGRES_PORT?.trim() ?? '';

  if (!user || !password || !database || !host || !port) {
    return null;
  }

  return { user, password, database, host, port };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
function buildDatabaseUrl(env = process.env) {
  const parts = readPostgresParts(env);
  if (!parts) {
    throw new Error(
      `缺少 PostgreSQL 环境变量（需要 ${REQUIRED_KEYS.join('、')}），无法拼接连接串`,
    );
  }

  const user = encodeURIComponent(parts.user);
  const password = encodeURIComponent(parts.password);
  const database = encodeURIComponent(parts.database);
  const host = formatHost(parts.host);

  return `postgresql://${user}:${password}@${host}:${parts.port}/${database}?schema=public`;
}

/**
 * 由 POSTGRES_* 写入 process.env.DATABASE_URL，供 Prisma 读取。
 * 不要在 .env 里再配 DATABASE_URL。
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ optional?: boolean }} [options]
 * @returns {void}
 */
function applyDatabaseUrl(env = process.env, options = {}) {
  const parts = readPostgresParts(env);
  if (!parts) {
    if (options.optional) {
      env.DATABASE_URL = GENERATE_PLACEHOLDER_URL;
      return;
    }
    throw new Error(
      `缺少 PostgreSQL 环境变量（需要 ${REQUIRED_KEYS.join('、')}），无法拼接连接串`,
    );
  }

  env.DATABASE_URL = buildDatabaseUrl(env);
}

module.exports = {
  REQUIRED_KEYS,
  buildDatabaseUrl,
  applyDatabaseUrl,
};
