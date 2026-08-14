import { Platform } from 'react-native';

/**
 * 开发机地址：
 * - Android 模拟器可用 10.0.2.2
 * - 真机请改成电脑局域网 IP
 * - Web 预览用 127.0.0.1（浏览器访问不到 10.0.2.2）
 */
function resolveDevHost(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_HOST;
  if (Platform.OS === 'web' && (!fromEnv || fromEnv === '10.0.2.2')) {
    return '127.0.0.1';
  }
  return fromEnv ?? '10.0.2.2';
}

const DEV_HOST = resolveDevHost();
const DEV_PORT = process.env.EXPO_PUBLIC_API_PORT ?? '3000';

export const API_HTTP_URL =
  process.env.EXPO_PUBLIC_API_HTTP_URL ?? `http://${DEV_HOST}:${DEV_PORT}`;

export const API_WS_URL =
  process.env.EXPO_PUBLIC_API_WS_URL ??
  `ws://${DEV_HOST}:${DEV_PORT}/v1/location/stream`;

/** 前台上报最小间隔（毫秒） */
export const FOREGROUND_INTERVAL_MS = 3000;

/** 位移阈值（米），小于该值可跳过上报 */
export const MIN_DISTANCE_METERS = 5;
