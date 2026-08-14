import { Module } from '@nestjs/common';

import { DevicesModule } from '../devices/devices.module';
import { LocationController } from './location.controller';
import { LocationGateway } from './location.gateway';
import { LocationService } from './location.service';

@Module({
  imports: [DevicesModule],
  controllers: [LocationController],
  providers: [LocationService, LocationGateway],
})
export class LocationModule {}
