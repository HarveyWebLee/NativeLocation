/**
 * Expo 动态配置：在 app.json 之上按环境补齐 Android cleartext。
 * 当 EXPO_PUBLIC_API_HTTP_URL 为 http:// 或显式 EXPO_PUBLIC_ALLOW_CLEARTEXT=true 时允许明文（公网内测 APK）。
 */
module.exports = ({ config }) => {
  const httpUrl = process.env.EXPO_PUBLIC_API_HTTP_URL ?? '';
  const allowCleartext =
    process.env.EXPO_PUBLIC_ALLOW_CLEARTEXT === 'true' ||
    httpUrl.startsWith('http://');

  return {
    ...config,
    android: {
      ...config.android,
      ...(allowCleartext ? { usesCleartextTraffic: true } : {}),
    },
  };
};
