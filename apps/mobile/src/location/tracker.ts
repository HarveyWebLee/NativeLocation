import type { LocationPoint, LocationSource } from '@native-location/shared';
import * as Location from 'expo-location';

import { FOREGROUND_INTERVAL_MS, MIN_DISTANCE_METERS } from '../config';
import { LocationUploader } from '../realtime/uploader';

/** 后台定位 Task 名称（预留，Phase 2 启用） */
export const BACKGROUND_LOCATION_TASK = 'NATIVE_LOCATION_BACKGROUND';

export type TrackingStatus = {
  running: boolean;
  permission: Location.PermissionStatus | 'undetermined';
  lastPoint: LocationPoint | null;
  message: string;
};

type StatusListener = (status: TrackingStatus) => void;

export class LocationTracker {
  private subscription: Location.LocationSubscription | null = null;
  private uploader: LocationUploader;
  private lastPoint: LocationPoint | null = null;
  private status: TrackingStatus = {
    running: false,
    permission: 'undetermined',
    lastPoint: null,
    message: '未启动',
  };

  constructor(
    private readonly deviceId: string,
    private readonly onStatus?: StatusListener,
  ) {
    this.uploader = new LocationUploader((message) => {
      this.patchStatus({ message });
    });
  }

  getStatus() {
    return this.status;
  }

  async requestForegroundPermission() {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) {
      this.patchStatus({ permission: current.status });
      return current;
    }

    const requested = await Location.requestForegroundPermissionsAsync();
    this.patchStatus({ permission: requested.status });
    return requested;
  }

  /**
   * 预留：后台定位权限与 Task。
   * MVP 不自动启动后台追踪，避免过早触发系统限制。
   */
  async prepareBackgroundPermission() {
    const foreground = await this.requestForegroundPermission();
    if (!foreground.granted) {
      return { ok: false as const, reason: 'foreground_denied' };
    }

    const background = await Location.requestBackgroundPermissionsAsync();
    this.patchStatus({
      message: background.granted
        ? '后台定位权限已授予（尚未启用后台追踪）'
        : '后台定位权限未授予（前台仍可用）',
    });

    return {
      ok: background.granted,
      status: background.status,
    };
  }

  async startForegroundTracking() {
    const permission = await this.requestForegroundPermission();
    if (!permission.granted) {
      this.patchStatus({
        running: false,
        message: '未获得前台定位权限',
      });
      throw new Error('前台定位权限被拒绝');
    }

    await this.stop();
    this.uploader.connect();

    this.subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: FOREGROUND_INTERVAL_MS,
        distanceInterval: MIN_DISTANCE_METERS,
      },
      (position) => {
        void this.handlePosition(position, 'foreground');
      },
    );

    this.patchStatus({
      running: true,
      message: '前台定位追踪中',
    });
  }

  async stop() {
    this.subscription?.remove();
    this.subscription = null;
    this.uploader.disconnect();
    this.patchStatus({
      running: false,
      message: '已停止',
    });
  }

  private async handlePosition(
    position: Location.LocationObject,
    source: LocationSource,
  ) {
    const point: LocationPoint = {
      deviceId: this.deviceId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      speed: position.coords.speed,
      heading: position.coords.heading,
      recordedAt: new Date(position.timestamp).toISOString(),
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
