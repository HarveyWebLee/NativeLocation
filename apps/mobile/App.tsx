import './src/location/background';

import { LOCATION_CRS } from '@native-location/shared';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Button,
  Circle,
  ScrollView,
  Separator,
  Spinner,
  TamaguiProvider,
  Text,
  Theme,
  ToggleGroup,
  XStack,
  YStack,
} from 'tamagui';

import { getOrCreateDeviceId } from './src/device';
import {
  DEFAULT_SAMPLE_INTERVAL_MS,
  LOCATION_SAMPLE_INTERVALS,
} from './src/location/sample-intervals';
import { LocationTracker, type TrackingStatus } from './src/location/tracker';
import { FormattedJson } from './src/ui/formatted-json';
import { tamaguiConfig } from './tamagui.config';

function permissionLabel(status: TrackingStatus['permission']): string {
  if (status === 'granted') {
    return '已授权';
  }
  if (status === 'denied') {
    return '已拒绝';
  }
  return '未申请';
}

export default function App() {
  return (
    <SafeAreaProvider>
      <TamaguiRoot />
    </SafeAreaProvider>
  );
}

function TamaguiRoot() {
  const insets = useSafeAreaInsets();

  return (
    <TamaguiProvider
      config={tamaguiConfig}
      defaultTheme="light"
      insets={insets}
    >
      <Theme name="green">
        <AppContent />
      </Theme>
    </TamaguiProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const trackerRef = useRef<LocationTracker | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [status, setStatus] = useState<TrackingStatus>({
    running: false,
    permission: 'undetermined',
    backgroundPermission: 'undetermined',
    lastPoint: null,
    message: '初始化中',
    serverPayload: null,
    sampleIntervalMs: DEFAULT_SAMPLE_INTERVAL_MS,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const id = await getOrCreateDeviceId();
        if (cancelled) {
          return;
        }
        const tracker = new LocationTracker(id, setStatus);
        trackerRef.current = tracker;
        setDeviceId(id);
        await tracker.refreshPermissionsFromSystem();
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (Platform.OS === 'web') {
          const previewId = 'web-preview';
          const tracker = new LocationTracker(previewId, setStatus);
          trackerRef.current = tracker;
          setDeviceId(previewId);
          setStatus((prev) => ({
            ...prev,
            message:
              error instanceof Error
                ? `Web 预览（未连上 API：${error.message}）`
                : 'Web 预览（未连上 API）',
          }));
          return;
        }
        setBootError(error instanceof Error ? error.message : '设备注册失败');
      }
    })();

    return () => {
      cancelled = true;
      void trackerRef.current?.stop();
      trackerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onAppStateChange = (next: AppStateStatus) => {
      if (next !== 'active') {
        return;
      }
      void trackerRef.current?.refreshPermissionsFromSystem();
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  if (bootError) {
    return (
      <YStack flex={1} background="$background" p="$5" gap="$3">
        <Text fontSize="$8" fontWeight="700" color="$color12">
          NativeLocation
        </Text>
        <Text color="$red10" lineHeight="$5">
          {bootError}
        </Text>
        <Text color="$color10" lineHeight="$5">
          请确认 API 已启动，并检查 EXPO_PUBLIC_API_HOST（真机需局域网 IP）。
        </Text>
      </YStack>
    );
  }

  if (!deviceId || !trackerRef.current) {
    return (
      <YStack
        flex={1}
        background="$background"
        items="center"
        justify="center"
        gap="$3"
      >
        <Spinner size="large" color="$green10" />
        <Text color="$color10">正在注册设备…</Text>
      </YStack>
    );
  }

  const tracker = trackerRef.current;
  const hasForegroundPermission = status.permission === 'granted';
  const intervalValue = String(status.sampleIntervalMs);
  const lastPoint = status.lastPoint;

  const onToggleTracking = () => {
    if (status.running) {
      void tracker.stop();
      return;
    }
    void tracker.startForegroundTracking().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : '开启定位失败';
      setStatus((prev) => ({ ...prev, message }));
    });
  };

  return (
    <YStack flex={1} background="$background">
      <StatusBar style="dark" />
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack gap="$5" pt={Math.max(insets.top, 20)} px="$5" pb="$4">
          <XStack items="center" justify="space-between">
            <YStack gap={2}>
              <Text
                fontSize="$1"
                letterSpacing={1.2}
                color="$green10"
                fontWeight="600"
              >
                LOCATION
              </Text>
              <Text fontSize="$8" fontWeight="800" color="$color12">
                NativeLocation
              </Text>
            </YStack>
            <XStack
              items="center"
              gap="$2"
              px="$3"
              py="$2"
              rounded="$10"
              background={status.running ? '$green4' : '$color4'}
            >
              <Circle
                size={8}
                background={status.running ? '$green10' : '$color8'}
              />
              <Text
                fontSize="$2"
                fontWeight="600"
                color={status.running ? '$green11' : '$color11'}
              >
                {status.running ? '定位中' : '未开启'}
              </Text>
            </XStack>
          </XStack>

          <YStack
            gap="$3"
            p="$5"
            rounded="$8"
            background="$color2"
            borderWidth={1}
            borderColor="$color5"
          >
            <Text fontSize="$2" color="$color10" fontWeight="600">
              {`当前坐标 · ${LOCATION_CRS}`}
            </Text>
            {lastPoint ? (
              <>
                <Text
                  fontSize={34}
                  fontWeight="700"
                  color="$color12"
                  letterSpacing={-0.6}
                >
                  {lastPoint.latitude.toFixed(6)}
                </Text>
                <Text
                  fontSize={34}
                  fontWeight="700"
                  color="$color12"
                  letterSpacing={-0.6}
                  mt={-8}
                >
                  {lastPoint.longitude.toFixed(6)}
                </Text>
                <Text fontSize="$2" color="$color10">
                  {lastPoint.recordedAt.replace('T', ' ').replace('Z', ' UTC')}
                </Text>
              </>
            ) : (
              <YStack py="$4">
                <Text fontSize="$7" fontWeight="600" color="$color8">
                  — —
                </Text>
                <Text fontSize="$3" color="$color10" mt="$2">
                  开启定位后显示经纬度
                </Text>
              </YStack>
            )}
            <Text fontSize="$3" color="$color11" lineHeight="$4">
              {status.message}
            </Text>
            {status.serverPayload !== null ? (
              <YStack gap="$2" mt="$2">
                <Text fontSize="$2" fontWeight="600" color="$color10">
                  服务端
                </Text>
                <FormattedJson value={status.serverPayload} />
              </YStack>
            ) : null}
          </YStack>

          <YStack
            rounded="$7"
            background="$color2"
            borderWidth={1}
            borderColor="$color5"
            overflow="hidden"
          >
            <InfoRow label="设备" value={deviceId} />
            <Separator borderColor="$color5" />
            <InfoRow
              label="前台权限"
              value={permissionLabel(status.permission)}
            />
            <Separator borderColor="$color5" />
            <InfoRow
              label="后台权限"
              value={permissionLabel(status.backgroundPermission)}
            />
          </YStack>

          <YStack gap="$3">
            <Text fontSize="$5" fontWeight="700" color="$color12">
              采集频率
            </Text>
            <ToggleGroup
              type="single"
              value={intervalValue}
              disableDeactivation
              orientation="horizontal"
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                if (!next) {
                  return;
                }
                void tracker.setSampleIntervalMs(Number(next));
              }}
            >
              <XStack flexWrap="wrap" gap="$2">
                {LOCATION_SAMPLE_INTERVALS.map((option) => {
                  const selected =
                    option.intervalMs === status.sampleIntervalMs;
                  return (
                    <ToggleGroup.Item
                      key={option.id}
                      unstyled
                      value={String(option.intervalMs)}
                      flexGrow={1}
                      flexBasis="46%"
                      minWidth="46%"
                      items="center"
                      justify="center"
                      py="$3"
                      px="$3"
                      rounded="$4"
                      borderWidth={1}
                      borderColor={selected ? '$green8' : '$color5'}
                      background={selected ? '$green4' : '$color2'}
                      activeStyle={{
                        background: '$green4',
                        borderColor: '$green8',
                      }}
                    >
                      <Text
                        fontSize="$3"
                        fontWeight={selected ? '700' : '500'}
                        color={selected ? '$green11' : '$color11'}
                        numberOfLines={1}
                      >
                        {option.label}
                      </Text>
                    </ToggleGroup.Item>
                  );
                })}
              </XStack>
            </ToggleGroup>
          </YStack>
        </YStack>
      </ScrollView>

      <YStack
        px="$5"
        pt="$3"
        pb={Math.max(insets.bottom, 16)}
        gap="$2"
        borderTopWidth={1}
        borderColor="$color5"
        background="$background"
      >
        <Button
          size="$6"
          theme={status.running ? 'red' : 'green'}
          onPress={onToggleTracking}
        >
          {status.running ? '停止定位' : '开启定位'}
        </Button>
        <Button
          size="$4"
          chromeless
          onPress={() => {
            if (hasForegroundPermission) {
              void tracker.openSystemSettingsForRevoke();
              return;
            }
            void tracker.requestLocationPermissions();
          }}
        >
          {hasForegroundPermission ? '取消授权' : '申请定位权限'}
        </Button>
      </YStack>
    </YStack>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <YStack px="$4" py="$3" gap="$1">
      <Text fontSize="$2" color="$color10">
        {label}
      </Text>
      <Text fontSize="$4" fontWeight="600" color="$color12" selectable>
        {value}
      </Text>
    </YStack>
  );
}
