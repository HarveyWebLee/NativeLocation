import {
  locationBatchSchema,
  locationPointSchema,
} from '@native-location/shared';
import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { LocationService } from './location.service';

@Controller('v1/location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post('batch')
  async ingestBatch(@Body() body: unknown) {
    const parsed = locationBatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.locationService.ingestPoints(parsed.data.points);
  }

  @Post('point')
  async ingestPoint(@Body() body: unknown) {
    const parsed = locationPointSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.locationService.ingestPoints([parsed.data]);
  }
}
