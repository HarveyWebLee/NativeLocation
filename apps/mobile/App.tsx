import './src/location/background';

import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getOrCreateDeviceId } from './src/device';
import { LocationTracker, type TrackingStatus } from './src/location/tracker';

export default function App() {
  const trackerRef = useRef<LocationTracker | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [status, setStatus] = useState<TrackingStatus>({
    running: false,
    permission: 'undetermined',
    lastPoint: null,
    message: '初始化中',
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
      } catch (error) {
        if (!cancelled) {
          setBootError(error instanceof Error ? error.message : '设备注册失败');
        }
      }
    })();

    return () => {
      cancelled = true;
      void trackerRef.current?.stop();
      trackerRef.current = null;
    };
  }, []);

  if (bootError) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>NativeLocation</Text>
        <Text style={styles.error}>{bootError}</Text>
        <Text style={styles.hint}>
          请确认 API 已启动，并检查 EXPO_PUBLIC_API_HOST（真机需局域网 IP）。
        </Text>
      </SafeAreaView>
    );
  }

  if (!deviceId || !trackerRef.current) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.hint}>正在注册设备…</Text>
      </SafeAreaView>
    );
  }

  const tracker = trackerRef.current;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>NativeLocation</Text>
      <Text style={styles.subtitle}>定位上报 MVP</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Device ID</Text>
        <Text style={styles.value}>{deviceId}</Text>
        <Text style={styles.label}>状态</Text>
        <Text style={styles.value}>{status.message}</Text>
        <Text style={styles.label}>权限</Text>
        <Text style={styles.value}>{status.permission}</Text>
        {status.lastPoint ? (
          <>
            <Text style={styles.label}>最近坐标</Text>
            <Text style={styles.value}>
              {status.lastPoint.latitude.toFixed(6)},{' '}
              {status.lastPoint.longitude.toFixed(6)}
            </Text>
            <Text style={styles.meta}>
              {status.lastPoint.recordedAt} · {status.lastPoint.source}
            </Text>
          </>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.primary]}
          onPress={() => {
            void tracker.startForegroundTracking();
          }}
        >
          <Text style={styles.buttonText}>开始前台定位</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.secondary]}
          onPress={() => {
            void tracker.stop();
          }}
        >
          <Text style={styles.buttonText}>停止</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.ghost]}
          onPress={() => {
            void tracker.prepareBackgroundPermission();
          }}
        >
          <Text style={styles.ghostText}>预留：申请后台权限</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 24,
    paddingTop: 48,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#134E4A',
  },
  subtitle: {
    fontSize: 14,
    color: '#0F766E',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  label: {
    marginTop: 8,
    fontSize: 12,
    color: '#5EEAD4',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 16,
    color: '#115E59',
  },
  meta: {
    fontSize: 12,
    color: '#6B7280',
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#0F766E',
  },
  secondary: {
    backgroundColor: '#115E59',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  ghostText: {
    color: '#0F766E',
    fontWeight: '600',
    fontSize: 14,
  },
  hint: {
    marginTop: 12,
    color: '#6B7280',
    lineHeight: 20,
  },
  error: {
    color: '#B91C1C',
    fontSize: 16,
  },
});
