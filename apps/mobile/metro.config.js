const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 只监听 shared 源码。监听整个 monorepo 根目录会扫到 pnpm 的 *_tmp_*，
// Windows 上 Metro FallbackWatcher 会 ENOENT / addedFiles 崩溃。
config.watchFolders = [path.resolve(monorepoRoot, 'packages/shared')];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

const existingBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList
    ? [config.resolver.blockList]
    : [];
const pnpmTmpDir = new RegExp(
  '[/\\\\]node_modules[/\\\\][^/\\\\]*_tmp_\\d+',
  existingBlockList[0]?.flags ?? '',
);
config.resolver.blockList = [...existingBlockList, pnpmTmpDir];

module.exports = config;
