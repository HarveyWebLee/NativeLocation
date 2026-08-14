import { Module } from '@nestjs/common';

import { DevicesModule } from './devices/devices.module';
import { HealthModule } from './health/health.module';
import { LocationModule } from './location/location.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule, DevicesModule, LocationModule],
})
export class AppModule {}
