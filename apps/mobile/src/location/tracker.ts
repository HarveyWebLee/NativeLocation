import type { LocationPoint, LocationSource } from '@native-location/shared';
import * as Location from 'expo-location';
import { Linking } from 'react-native';

import { LocationUploader } from '../realtime/uploader';
import {
  DEFAULT_SAMPLE_INTERVAL_MS,
  isSupportedSampleInterval,
} from './sample-intervals';

/** 后台定位 Task 名称（预留，Phase 2 启用） */
export const BACKGROUND_LOCATION_TASK = 'NATIVE_LOCATION_BACKGROUND';

export type TrackingStatus = {
  running: boolean;
  permission: Location.PermissionStatus | 'undetermined';
  backgroundPermission: Location.PermissionStatus | 'undetermined';
  lastPoint: LocationPoint | null;
  message: string;
  serverPayload: unknown | null;
  sampleIntervalMs: number;
};

type StatusListener = (status: TrackingStatus) => void;

export class LocationTracker {
  private sampleTimer: ReturnType<typeof setInterval> | null = null;
  private captureGeneration = 0;
  private captureInFlight = false;
  private uploader: LocationUploader;
  private lastPoint: LocationPoint | null = null;
  private sampleIntervalMs = DEFAULT_SAMPLE_INTERVAL_MS;
  private status: TrackingStatus = {
    running: false,
    permission: 'undetermined',
    backgroundPermission: 'undetermined',
    lastPoint: null,
    message: '未启动',
    serverPayload: null,
    sampleIntervalMs: DEFAULT_SAMPLE_INTERVAL_MS,
  };

  constructor(
    private readonly deviceId: string,
    private readonly onStatus?: StatusListener,
  ) {
    this.uploader = new LocationUploader((event) => {
      if (event.kind === 'payload') {
        this.patchStatus({
          serverPayload: event.data,
          message: '服务端已确认',
        });
        return;
      }
      this.patchStatus({ message: event.message });
    });
  }

  getStatus() {
    return this.status;
  }

  async refreshPermissionsFromSystem() {
    const foreground = await Location.getForegroundPermissionsAsync();
    let backgroundStatus: Location.PermissionStatus | 'undetermined' =
      'undetermined';
    try {
      const background = await Location.getBackgroundPermissionsAsync();
      backgroundStatus = background.status;
    } catch {
      backgroundStatus = 'undetermined';
    }

    this.patchStatus({
      permission: foreground.status,
      backgroundPermission: backgroundStatus,
    });

    if (!foreground.granted && this.status.running) {
      await this.stop();
      this.patchStatus({
        message: '定位权限已关闭，已停止追踪',
        permission: foreground.status,
        backgroundPermission: backgroundStatus,
      });
    }

    return foreground;
  }

  async requestLocationPermissions() {
    const current = await Location.getForegroundPermissionsAsync();
    const foreground = current.granted
      ? current
      : await Location.requestForegroundPermissionsAsync();
    this.patchStatus({ permission: foreground.status });

    if (!foreground.granted) {
      if (this.status.running) {
        await this.stop();
      }
      this.patchStatus({
        running: false,
        message: '未获得前台定位权限',
        permission: foreground.status,
      });
      return { foreground, background: null };
    }

    try {
      const background = await Location.requestBackgroundPermissionsAsync();
      this.patchStatus({
        backgroundPermission: background.status,
        message: background.granted
          ? '前台与后台定位权限已授予'
          : '前台权限已授予，后台权限未授予（前台追踪仍可用）',
      });
      return { foreground, background };
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : '后台权限申请失败';
      this.patchStatus({
        message: `前台权限已授予（后台：${detail}）`,
      });
      return { foreground, background: null };
    }
  }

  async openSystemSettingsForRevoke() {
    await Linking.openSettings();
  }

  async setSampleIntervalMs(intervalMs: number) {
    if (!isSupportedSampleInterval(intervalMs)) {
      throw new Error('不支持的采集间隔');
    }

    this.sampleIntervalMs = intervalMs;
    this.patchStatus({ sampleIntervalMs: intervalMs });

    if (this.status.running) {
      await this.startSampling();
      this.patchStatus({
        running: true,
        message: '前台定位追踪中',
      });
    }
  }

  async startForegroundTracking() {
    const { foreground } = await this.requestLocationPermissions();
    if (!foreground.granted) {
      throw new Error('前台定位权限被拒绝');
    }

    this.uploader.connect();
    this.patchStatus({
      running: true,
      message: '前台定位追踪中',
    });
    await this.startSampling();
  }

  async stop() {
    this.stopSampling();
    this.uploader.disconnect();
    this.patchStatus({
      running: false,
      message: '已停止',
    });
  }

  private stopSampling() {
    this.captureGeneration += 1;
    if (this.sampleTimer !== null) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
  }

  private async startSampling() {
    this.stopSampling();
    const generation = this.captureGeneration;

    // 各端按固定间隔取当前点并上报，不因坐标未变而跳过
    await this.captureCurrentPosition(generation);
    if (generation !== this.captureGeneration) {
      return;
    }
    this.sampleTimer = setInterval(() => {
      void this.captureCurrentPosition(generation);
    }, this.sampleIntervalMs);
  }

  private async captureCurrentPosition(generation: number) {
    if (this.captureInFlight || generation !== this.captureGeneration) {
      return;
    }
    this.captureInFlight = true;
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await this.emitPosition(position, 'foreground', generation);
    } catch (error) {
      if (generation !== this.captureGeneration) {
        return;
      }
      const message = error instanceof Error ? error.message : '定位失败';
      this.patchStatus({ message });
    } finally {
      this.captureInFlight = false;
    }
  }

  private async emitPosition(
    position: Location.LocationObject,
    source: LocationSource,
    generation: number,
  ) {
    if (generation !== this.captureGeneration) {
      return;
    }

    const sampledAt = new Date();
    // expo-location：iOS Core Location、Android Location、Web Geolocation 均为 WGS84
    const point: LocationPoint = {
      deviceId: this.deviceId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      speed: position.coords.speed,
      heading: position.coords.heading,
      recordedAt: sampledAt.toISOString(),
      source,
    };

    this.lastPoint = point;
    this.patchStatus({ lastPoint: point });

    try {
      await this.uploader.publish(point);
    } catch (error) {
      const message = error instanceof Error ? error.message : '上报失败';
      this.patchStatus({ message });
    }
  }

  private patchStatus(partial: Partial<TrackingStatus>) {
    this.status = { ...this.status, ...partial };
    this.onStatus?.(this.status);
  }
}
