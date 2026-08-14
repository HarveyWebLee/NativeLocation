import type { LocationPoint } from '@native-location/shared';
import { Injectable } from '@nestjs/common';

import { DevicesService } from '../devices/devices.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devicesService: DevicesService,
  ) {}

  async ingestPoints(points: LocationPoint[]) {
    const deviceIds = [...new Set(points.map((point) => point.deviceId))];
    await Promise.all(
      deviceIds.map((deviceId) => this.devicesService.ensureExists(deviceId)),
    );

    const result = await this.prisma.locationPoint.createMany({
      data: points.map((point) => ({
        deviceId: point.deviceId,
        latitude: point.latitude,
        longitude: point.longitude,
        accuracy: point.accuracy ?? null,
        altitude: point.altitude ?? null,
        speed: point.speed ?? null,
        heading: point.heading ?? null,
        recordedAt: new Date(point.recordedAt),
        source: point.source,
      })),
    });

    return {
      inserted: result.count,
      deviceIds,
    };
  }
}
