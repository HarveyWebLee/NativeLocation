import { locationPointSchema } from '@native-location/shared';
import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { RawData, WebSocket } from 'ws';

import { LocationService } from './location.service';

@WebSocketGateway({ path: '/v1/location/stream' })
export class LocationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(LocationGateway.name);

  constructor(private readonly locationService: LocationService) {}

  handleConnection(client: WebSocket) {
    this.logger.log('location stream client connected');
    client.send(
      JSON.stringify({
        type: 'connected',
        message: 'send a LocationPoint JSON object per frame',
      }),
    );

    client.on('message', (raw: RawData) => {
      void this.onMessage(client, raw);
    });
  }

  handleDisconnect() {
    this.logger.log('location stream client disconnected');
  }

  private async onMessage(client: WebSocket, raw: RawData) {
    try {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8');
      const payload = JSON.parse(text) as unknown;
      const parsed = locationPointSchema.safeParse(payload);

      if (!parsed.success) {
        client.send(
          JSON.stringify({
            type: 'error',
            message: 'invalid location payload',
            details: parsed.error.flatten(),
          }),
        );
        return;
      }

      const result = await this.locationService.ingestPoints([parsed.data]);
      client.send(
        JSON.stringify({
          type: 'ack',
          inserted: result.inserted,
          deviceId: parsed.data.deviceId,
          recordedAt: parsed.data.recordedAt,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`failed to ingest location: ${message}`);
      client.send(JSON.stringify({ type: 'error', message }));
    }
  }
}
