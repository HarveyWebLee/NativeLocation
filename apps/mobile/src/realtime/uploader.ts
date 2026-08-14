import type { LocationPoint } from '@native-location/shared';
import { API_PATHS } from '@native-location/shared';

import { API_HTTP_URL, API_WS_URL } from '../config';

type AckHandler = (message: string) => void;

/**
 * 实时上报：优先 WebSocket，失败时降级 HTTP。
 * 本地环形缓冲用于短暂断线补传。
 */
export class LocationUploader {
  private socket: WebSocket | null = null;
  private queue: LocationPoint[] = [];
  private readonly maxQueueSize = 100;
  private connecting = false;

  constructor(private readonly onStatus?: AckHandler) {}

  connect() {
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING ||
      this.connecting
    ) {
      return;
    }

    this.connecting = true;
    try {
      const socket = new WebSocket(API_WS_URL);
      this.socket = socket;

      socket.onopen = () => {
        this.connecting = false;
        this.onStatus?.('WebSocket 已连接');
        void this.flushQueue();
      };

      socket.onmessage = (event) => {
        this.onStatus?.(`服务端: ${String(event.data)}`);
      };

      socket.onerror = () => {
        this.connecting = false;
        this.onStatus?.('WebSocket 错误，将尝试 HTTP 兜底');
      };

      socket.onclose = () => {
        this.connecting = false;
        this.socket = null;
        this.onStatus?.('WebSocket 已断开');
      };
    } catch {
      this.connecting = false;
      this.onStatus?.('WebSocket 创建失败');
    }
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }

  async publish(point: LocationPoint) {
    this.enqueue(point);

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(point));
      this.dequeueMatching(point);
      return;
    }

    this.connect();
    await this.sendHttp(point);
    this.dequeueMatching(point);
  }

  private enqueue(point: LocationPoint) {
    this.queue.push(point);
    if (this.queue.length > this.maxQueueSize) {
      this.queue.shift();
    }
  }

  private dequeueMatching(point: LocationPoint) {
    this.queue = this.queue.filter(
      (item) =>
        !(
          item.deviceId === point.deviceId &&
          item.recordedAt === point.recordedAt
        ),
    );
  }

  private async flushQueue() {
    const pending = [...this.queue];
    for (const point of pending) {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        break;
      }
      this.socket.send(JSON.stringify(point));
      this.dequeueMatching(point);
    }
  }

  private async sendHttp(point: LocationPoint) {
    const response = await fetch(`${API_HTTP_URL}${API_PATHS.locationBatch}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: [point] }),
    });

    if (!response.ok) {
      throw new Error(`HTTP 上报失败: ${response.status}`);
    }
  }
}
