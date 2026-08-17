/**
 * 宿主机 APK 构建代理：仅监听 127.0.0.1，供 Compose 内 API 经 host.docker.internal 调用。
 * 用法：pnpm apk:agent
 */
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { buildAndroidApk, readApkBuildStatus } from './build-android-apk.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const envProductionPath = path.join(repoRoot, '.env.production');

function loadApiKeyFromProduction() {
  if (!existsSync(envProductionPath)) {
    throw new Error('请先配置仓库根目录 .env.production');
  }
  const text = readFileSync(envProductionPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('API_KEY=')) {
      continue;
    }
    let value = line.slice('API_KEY='.length).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  throw new Error('.env.production 未设置 API_KEY');
}

const API_KEY = loadApiKeyFromProduction();
const PORT = Number(process.env.APK_BUILD_AGENT_PORT ?? 18210);
const HOST = process.env.APK_BUILD_AGENT_HOST ?? '127.0.0.1';

let building = false;

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

function readApiKey(request) {
  const header = request.headers['x-api-key'];
  if (Array.isArray(header)) {
    return header[0];
  }
  return header;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/status') {
    sendJson(response, 200, readApkBuildStatus());
    return;
  }

  if (request.method === 'POST' && url.pathname === '/build') {
    if (readApiKey(request) !== API_KEY) {
      sendJson(response, 401, { message: 'invalid api key' });
      return;
    }
    if (building) {
      sendJson(response, 409, {
        message: '已有构建任务进行中',
        ...readApkBuildStatus(),
      });
      return;
    }
    building = true;
    sendJson(response, 202, {
      message: '已接受构建任务',
      ...readApkBuildStatus(),
      status: 'running',
    });
    void buildAndroidApk()
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        building = false;
      });
    return;
  }

  sendJson(response, 404, { message: 'not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`APK build agent listening on http://${HOST}:${PORT}`);
  console.log('POST /build (X-Api-Key) · GET /status · GET /health');
});
