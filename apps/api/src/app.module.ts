import './load-root-env';

import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { HealthModule } from './health/health.module';
import { LocationModule } from './location/location.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    HealthModule,
    DevicesModule,
    LocationModule,
  ],
})
export class AppModule {}
