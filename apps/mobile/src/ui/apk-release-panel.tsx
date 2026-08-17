import { API_PATHS, APK_DOWNLOAD_PATH } from '@native-location/shared';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';

import { API_HTTP_URL, apiAuthHeaders } from '../config';

type ApkBuildStatus = {
  status: 'idle' | 'running' | 'success' | 'failed';
  message: string;
  apkAvailable: boolean;
  downloadPath: string;
  logTail?: string;
};

const emptyStatus: ApkBuildStatus = {
  status: 'idle',
  message: '尚未构建',
  apkAvailable: false,
  downloadPath: APK_DOWNLOAD_PATH,
};

export function ApkReleasePanel() {
  const [status, setStatus] = useState<ApkBuildStatus>(emptyStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${API_HTTP_URL}${API_PATHS.apkStatus}`);
      if (!response.ok) {
        throw new Error(`状态查询失败 HTTP ${response.status}`);
      }
      const body = (await response.json()) as ApkBuildStatus;
      setStatus(body);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '状态查询失败');
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 5000);
    return () => {
      clearInterval(timer);
    };
  }, [refresh]);

  if (Platform.OS !== 'web') {
    return null;
  }

  const downloadHref =
    typeof window !== 'undefined'
      ? `${window.location.origin}${status.downloadPath || APK_DOWNLOAD_PATH}`
      : APK_DOWNLOAD_PATH;

  const building = busy || status.status === 'running';

  const onBuild = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_HTTP_URL}${API_PATHS.apkBuild}`, {
        method: 'POST',
        headers: apiAuthHeaders(),
      });
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(body.message ?? `触发失败 HTTP ${response.status}`);
      }
      setStatus((prev) => ({
        ...prev,
        status: 'running',
        message: body.message ?? '已接受构建任务',
      }));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '触发构建失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <YStack
      gap="$3"
      p="$5"
      rounded="$8"
      background="$color2"
      borderWidth={1}
      borderColor="$color5"
    >
      <Text fontSize="$2" color="$color10" fontWeight="600">
        Android 内测 APK
      </Text>
      <Text fontSize="$3" color="$color11" lineHeight="$4">
        本机 debug 构建，下载公开。需宿主机运行 pnpm apk:agent，并已安装 JDK /
        Android SDK。
      </Text>
      <Text fontSize="$3" color="$color12">
        {`状态：${status.status} · ${status.message}`}
      </Text>
      {error ? (
        <Text fontSize="$3" color="$red10" lineHeight="$4">
          {error}
        </Text>
      ) : null}
      {status.logTail && status.status === 'failed' ? (
        <Text fontSize="$1" color="$color10" lineHeight="$3">
          {status.logTail.slice(0, 500)}
        </Text>
      ) : null}
      <YStack gap="$2">
        <Button
          size="$4"
          theme="green"
          disabled={building}
          onPress={() => {
            void onBuild();
          }}
        >
          {building ? '构建中…' : '开始构建 APK'}
        </Button>
        <Button
          size="$4"
          disabled={!status.apkAvailable}
          onPress={() => {
            void Linking.openURL(downloadHref);
          }}
        >
          下载 APK
        </Button>
      </YStack>
      <XStack>
        <Text fontSize="$1" color="$color9">
          {downloadHref}
        </Text>
      </XStack>
    </YStack>
  );
}
