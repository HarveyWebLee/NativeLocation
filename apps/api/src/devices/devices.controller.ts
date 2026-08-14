import { deviceRegisterSchema } from '@native-location/shared';
import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { DevicesService } from './devices.service';

@Controller('v1/devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const parsed = deviceRegisterSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.devicesService.register(parsed.data);
  }
}
