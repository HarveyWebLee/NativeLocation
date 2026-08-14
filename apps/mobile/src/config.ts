import { API_KEY_HEADER, API_KEY_QUERY } from '@native-location/shared';
import { Platform } from 'react-native';

/**
 * 开发机地址：
 * - Android 模拟器可用 10.0.2.2
 * - 真机请改成电脑局域网 IP
 * - Web 预览用 127.0.0.1（浏览器访问不到 10.0.2.2）
 * 生产构建请设置 EXPO_PUBLIC_API_HTTP_URL / EXPO_PUBLIC_API_WS_URL（https / wss）
 */
function resolveDevHost(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_HOST;
  if (Platform.OS === 'web' && (!fromEnv || fromEnv === '10.0.2.2')) {
    return '127.0.0.1';
  }
  return fromEnv ?? '10.0.2.2';
}

const DEV_HOST = resolveDevHost();
const DEV_PORT = process.env.EXPO_PUBLIC_API_PORT ?? '18156';

export const API_HTTP_URL =
  process.env.EXPO_PUBLIC_API_HTTP_URL ?? `http://${DEV_HOST}:${DEV_PORT}`;

const API_WS_BASE =
  process.env.EXPO_PUBLIC_API_WS_URL ??
  `ws://${DEV_HOST}:${DEV_PORT}/v1/location/stream`;

export const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

export const API_WS_URL = withApiKeyQuery(API_WS_BASE);

export function apiAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) {
    headers[API_KEY_HEADER] = API_KEY;
  }
  return headers;
}

function withApiKeyQuery(wsUrl: string): string {
  if (!API_KEY) {
    return wsUrl;
  }
  const separator = wsUrl.includes('?') ? '&' : '?';
  return `${wsUrl}${separator}${API_KEY_QUERY}=${encodeURIComponent(API_KEY)}`;
}
