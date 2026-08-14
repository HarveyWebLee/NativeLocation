import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootLower = root.toLowerCase();
const isWindows = process.platform === 'win32';
const lockErrorCodes = new Set(['EPERM', 'EBUSY', 'EACCES']);
const maxDeleteAttempts = 8;
const retryDelayMs = 400;
const killableNames = new Set(['node.exe', 'node', 'turbo.exe', 'turbo']);
const serviceCommandPattern =
  /nest\s+start|prisma\s|expo\s|metro|turbo\s+run\s+dev|@native-location\/(api|mobile)/i;

/**
 * @typedef {{ pid: number, parentPid: number, name: string, commandLine: string }} ProcInfo
 */

/** @type {string[]} */
const targets = [];

/**
 * @param {string} dir
 */
function collectNodeModules(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    console.error(`无法读取目录 ${dir}:`, error);
    process.exit(1);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.name === '.git') {
      continue;
    }
    if (entry.name === 'node_modules') {
      targets.push(fullPath);
      continue;
    }

    collectNodeModules(fullPath);
  }
}

/**
 * @param {unknown} error
 * @returns {error is NodeJS.ErrnoException}
 */
function isLockError(error) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    lockErrorCodes.has(error.code)
  );
}

/**
 * @param {number} ms
 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * @returns {Set<number>}
 */
function collectSelfAncestry() {
  const protectedPids = new Set([process.pid]);
  if (process.ppid) {
    protectedPids.add(process.ppid);
  }

  if (!isWindows) {
    return protectedPids;
  }

  const map = toProcessMap(getWindowsProcesses());
  let current = process.pid;
  const seen = new Set();
  while (current && !seen.has(current)) {
    seen.add(current);
    protectedPids.add(current);
    current = map.get(current)?.parentPid ?? 0;
  }

  return protectedPids;
}

/**
 * @returns {ProcInfo[]}
 */
function listWindowsProcesses() {
  const script = [
    'Get-CimInstance Win32_Process |',
    'Select-Object ProcessId, ParentProcessId, Name, CommandLine |',
    'ConvertTo-Json -Compress',
  ].join(' ');

  try {
    const output = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-Command', script],
      {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
        windowsHide: true,
      },
    ).trim();

    if (output === '') {
      return [];
    }

    const parsed = JSON.parse(output);
    const rows = Array.isArray(parsed) ? parsed : [parsed];

    return rows.map((row) => ({
      pid: Number(row.ProcessId),
      parentPid: Number(row.ParentProcessId ?? 0),
      name: String(row.Name ?? ''),
      commandLine: String(row.CommandLine ?? ''),
    }));
  } catch {
    return [];
  }
}

/** @type {ProcInfo[] | undefined} */
let windowsProcessCache;

/**
 * @param {boolean} [force]
 * @returns {ProcInfo[]}
 */
function getWindowsProcesses(force = false) {
  if (force || windowsProcessCache === undefined) {
    windowsProcessCache = listWindowsProcesses();
  }
  return windowsProcessCache;
}

/**
 * @param {string} filePath
 * @returns {number[]}
 */
function getLockingPidsWindows(filePath) {
  const script = `
$ErrorActionPreference = 'Stop'
$code = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using FILETIME = System.Runtime.InteropServices.ComTypes.FILETIME;
public static class NativeLocationRm {
  [StructLayout(LayoutKind.Sequential)]
  struct RM_UNIQUE_PROCESS {
    public int dwProcessId;
    public FILETIME ProcessStartTime;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct RM_PROCESS_INFO {
    public RM_UNIQUE_PROCESS Process;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
    public string strAppName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
    public string strServiceShortName;
    public uint ApplicationType;
    public uint AppStatus;
    public uint TSSessionId;
    [MarshalAs(UnmanagedType.Bool)]
    public bool bRestartable;
  }
  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
  static extern int RmStartSession(out uint pSessionHandle, int dwSessionFlags, string strSessionKey);
  [DllImport("rstrtmgr.dll")]
  static extern int RmEndSession(uint pSessionHandle);
  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
  static extern int RmRegisterResources(uint pSessionHandle, uint nFiles, string[] rgsFilenames, uint nApplications, IntPtr rgApplications, uint nServices, string[] rgsServiceNames);
  [DllImport("rstrtmgr.dll")]
  static extern int RmGetList(uint pSessionHandle, out uint pnProcInfoNeeded, ref uint pnProcInfo, [In, Out] RM_PROCESS_INFO[] rgAffectedApps, ref uint lpdwRebootReasons);
  public static int[] GetPids(string path) {
    uint handle;
    if (RmStartSession(out handle, 0, Guid.NewGuid().ToString()) != 0) return new int[0];
    try {
      string[] files = new string[] { path };
      if (RmRegisterResources(handle, 1, files, 0, IntPtr.Zero, 0, null) != 0) return new int[0];
      uint needed = 0, count = 0, reboot = 0;
      int result = RmGetList(handle, out needed, ref count, null, ref reboot);
      if (result == 234) {
        count = needed;
        RM_PROCESS_INFO[] infos = new RM_PROCESS_INFO[count];
        result = RmGetList(handle, out needed, ref count, infos, ref reboot);
        if (result != 0) return new int[0];
        List<int> pids = new List<int>();
        for (int i = 0; i < count; i++) pids.Add(infos[i].Process.dwProcessId);
        return pids.ToArray();
      }
      return new int[0];
    } finally {
      RmEndSession(handle);
    }
  }
}
'@
Add-Type -TypeDefinition $code -Language CSharp
[NativeLocationRm]::GetPids($env:CLEAN_LOCKED_PATH) -join ','
`;

  try {
    const output = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-Command', script],
      {
        encoding: 'utf8',
        windowsHide: true,
        env: { ...process.env, CLEAN_LOCKED_PATH: filePath },
      },
    ).trim();

    if (output === '') {
      return [];
    }

    return output
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

/**
 * @param {string} filePath
 * @returns {number[]}
 */
function getLockingPidsUnix(filePath) {
  try {
    const output = execFileSync('lsof', ['-t', '--', filePath], {
      encoding: 'utf8',
    }).trim();
    if (output === '') {
      return [];
    }
    return output
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

/**
 * @param {ProcInfo[]} procs
 * @returns {Map<number, ProcInfo>}
 */
function toProcessMap(procs) {
  return new Map(procs.map((proc) => [proc.pid, proc]));
}

/**
 * @param {number} lockPid
 * @param {Map<number, ProcInfo>} map
 * @param {Set<number>} protectedPids
 * @returns {number}
 */
function findKillRoot(lockPid, map, protectedPids) {
  let current = lockPid;
  let killPid = lockPid;
  const seen = new Set();

  while (current && !seen.has(current)) {
    seen.add(current);
    if (protectedPids.has(current)) {
      break;
    }

    const proc = map.get(current);
    if (!proc) {
      break;
    }

    if (!killableNames.has(proc.name.toLowerCase())) {
      break;
    }

    killPid = current;
    current = proc.parentPid;
  }

  return killPid;
}

/**
 * @param {number} pid
 * @param {ProcInfo | undefined} proc
 */
function killPid(pid, proc) {
  const label = proc ? `${String(pid)} (${proc.name})` : String(pid);
  console.log(`终止占用进程 ${label}`);

  try {
    if (isWindows) {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch {
    // 进程可能已退出
  }
}

/**
 * @param {string} filePath
 * @param {Set<number>} protectedPids
 */
function stopLockingServices(filePath, protectedPids) {
  const relativePath = path.relative(root, filePath);
  console.log(`文件被占用，尝试终止对应服务: ${relativePath}`);

  const lockingPids = isWindows
    ? getLockingPidsWindows(filePath)
    : getLockingPidsUnix(filePath);

  const procs = isWindows ? getWindowsProcesses(true) : [];
  const map = toProcessMap(procs);
  /** @type {Set<number>} */
  const toKill = new Set();

  for (const pid of lockingPids) {
    if (protectedPids.has(pid)) {
      continue;
    }
    toKill.add(isWindows ? findKillRoot(pid, map, protectedPids) : pid);
  }

  if (toKill.size === 0 && isWindows) {
    for (const proc of procs) {
      if (protectedPids.has(proc.pid)) {
        continue;
      }
      if (!killableNames.has(proc.name.toLowerCase())) {
        continue;
      }
      if (!proc.commandLine.toLowerCase().includes(rootLower)) {
        continue;
      }
      if (proc.commandLine.includes('clean-node-modules')) {
        continue;
      }
      if (!serviceCommandPattern.test(proc.commandLine)) {
        continue;
      }
      toKill.add(findKillRoot(proc.pid, map, protectedPids));
    }
  }

  if (toKill.size === 0) {
    console.error(`未找到占用 ${relativePath} 的进程`);
    return;
  }

  for (const pid of toKill) {
    if (protectedPids.has(pid)) {
      continue;
    }
    killPid(pid, map.get(pid));
  }
}

/**
 * @param {string} dir
 * @param {Set<number>} protectedPids
 */
function removeDir(dir, protectedPids) {
  const relativePath = path.relative(root, dir);
  console.log(`删除 ${relativePath}`);

  for (let attempt = 1; attempt <= maxDeleteAttempts; attempt += 1) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!isLockError(error) || typeof error.path !== 'string') {
        console.error(`删除失败 ${relativePath}:`, error);
        process.exit(1);
      }

      if (attempt === maxDeleteAttempts) {
        console.error(`删除失败 ${relativePath}:`, error);
        process.exit(1);
      }

      stopLockingServices(error.path, protectedPids);
      sleepSync(retryDelayMs);
    }
  }
}

collectNodeModules(root);
const protectedPids = collectSelfAncestry();

for (const dir of targets) {
  removeDir(dir, protectedPids);
}

if (targets.length === 0) {
  console.log('未找到 node_modules');
} else {
  console.log(`已删除 ${String(targets.length)} 个 node_modules`);
}
