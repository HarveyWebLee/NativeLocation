import { randomUUID } from 'node:crypto';

import type { DeviceRegisterInput } from '@native-location/shared';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: DeviceRegisterInput) {
    const deviceId = input.deviceId?.trim() || randomUUID();

    const device = await this.prisma.device.upsert({
      where: { deviceId },
      create: {
        deviceId,
        platform: input.platform,
        displayName: input.displayName,
      },
      update: {
        platform: input.platform,
        displayName: input.displayName,
      },
    });

    return {
      deviceId: device.deviceId,
      platform: device.platform,
      displayName: device.displayName,
      createdAt: device.createdAt.toISOString(),
    };
  }

  async ensureExists(deviceId: string) {
    return this.prisma.device.upsert({
      where: { deviceId },
      create: { deviceId, platform: 'unknown' },
      update: {},
    });
  }
}
