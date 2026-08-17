import { spawn } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const apkDir = path.join(repoRoot, 'deploy', 'apk');
const statusPath = path.join(apkDir, 'build-status.json');
const apkFileName = 'native-location-preview.apk';
const apkPath = path.join(apkDir, apkFileName);
const mobileDir = path.join(repoRoot, 'apps', 'mobile');
const androidDir = path.join(mobileDir, 'android');

/**
 * @typedef {'idle' | 'running' | 'success' | 'failed'} ApkBuildPhase
 * @typedef {{
 *   status: ApkBuildPhase;
 *   message: string;
 *   startedAt: string | null;
 *   finishedAt: string | null;
 *   apkAvailable: boolean;
 *   downloadPath: string;
 *   logTail?: string;
 * }} ApkBuildStatus
 */

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`缺少环境文件: ${filePath}`);
  }
  const text = readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function writeStatus(partial) {
  mkdirSync(apkDir, { recursive: true });
  /** @type {ApkBuildStatus} */
  let current = {
    status: 'idle',
    message: '尚未构建',
    startedAt: null,
    finishedAt: null,
    apkAvailable: existsSync(apkPath),
    downloadPath: `/downloads/${apkFileName}`,
  };
  if (existsSync(statusPath)) {
    try {
      current = { ...current, ...JSON.parse(readFileSync(statusPath, 'utf8')) };
    } catch {
      // ignore corrupt status
    }
  }
  const next = {
    ...current,
    ...partial,
    apkAvailable: existsSync(apkPath),
    downloadPath: `/downloads/${apkFileName}`,
  };
  writeFileSync(statusPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function readApkBuildStatus() {
  return writeStatus({});
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...options.env },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(' ')} 退出码 ${code}\n${stderr || stdout}`.trim(),
        ),
      );
    });
  });
}

function findDebugApk() {
  const candidates = [
    path.join(
      androidDir,
      'app',
      'build',
      'outputs',
      'apk',
      'debug',
      'app-debug.apk',
    ),
    path.join(
      androidDir,
      'app',
      'build',
      'outputs',
      'apk',
      'debug',
      'app-debug-unsigned.apk',
    ),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

/**
 * 本机构建 debug APK，写入 deploy/apk。
 * @returns {Promise<ApkBuildStatus>}
 */
export async function buildAndroidApk() {
  loadEnvFile(path.join(repoRoot, '.env.production'));

  const httpUrl = process.env.EXPO_PUBLIC_API_HTTP_URL?.trim();
  const wsUrl = process.env.EXPO_PUBLIC_API_WS_URL?.trim();
  const apiKey = process.env.EXPO_PUBLIC_API_KEY?.trim();
  if (!httpUrl || !wsUrl || !apiKey) {
    throw new Error(
      '.env.production 须设置 EXPO_PUBLIC_API_HTTP_URL / EXPO_PUBLIC_API_WS_URL / EXPO_PUBLIC_API_KEY',
    );
  }

  const startedAt = new Date().toISOString();
  writeStatus({
    status: 'running',
    message: '正在本机构建 Android debug APK…',
    startedAt,
    finishedAt: null,
    logTail: '',
  });

  const buildEnv = {
    EXPO_PUBLIC_API_HTTP_URL: httpUrl,
    EXPO_PUBLIC_API_WS_URL: wsUrl,
    EXPO_PUBLIC_API_KEY: apiKey,
    EXPO_NO_TELEMETRY: '1',
    CI: '1',
  };

  try {
    await run('pnpm', ['--filter', '@native-location/shared', 'build'], {
      env: buildEnv,
    });
    await run(
      'pnpm',
      [
        '--filter',
        '@native-location/mobile',
        'exec',
        'expo',
        'prebuild',
        '--platform',
        'android',
        '--non-interactive',
      ],
      { env: buildEnv, cwd: repoRoot },
    );

    if (!existsSync(androidDir)) {
      throw new Error('expo prebuild 后未找到 apps/mobile/android');
    }

    if (process.platform !== 'win32') {
      await run('chmod', ['+x', 'gradlew'], { cwd: androidDir });
    }

    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    await run(gradlew, ['assembleDebug'], {
      cwd: androidDir,
      env: buildEnv,
    });

    const builtApk = findDebugApk();
    if (!builtApk) {
      throw new Error('未找到 assembleDebug 产物 APK');
    }

    mkdirSync(apkDir, { recursive: true });
    const tempPath = `${apkPath}.tmp`;
    copyFileSync(builtApk, tempPath);
    renameSync(tempPath, apkPath);

    return writeStatus({
      status: 'success',
      message: '构建成功，可公开下载',
      startedAt,
      finishedAt: new Date().toISOString(),
      logTail: `APK → ${apkPath}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return writeStatus({
      status: 'failed',
      message: '构建失败',
      startedAt,
      finishedAt: new Date().toISOString(),
      logTail: message.slice(-4000),
    });
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  buildAndroidApk()
    .then((status) => {
      console.log(JSON.stringify(status, null, 2));
      process.exit(status.status === 'success' ? 0 : 1);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
