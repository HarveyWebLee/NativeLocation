import { API_KEY_HEADER } from '@native-location/shared';
import { Controller, Get, Headers, Post } from '@nestjs/common';

import { Public } from '../auth/public.decorator';
import { ApkAdminService } from './apk-admin.service';

@Controller('v1/admin/apk')
export class ApkAdminController {
  constructor(private readonly apkAdminService: ApkAdminService) {}

  @Public()
  @Get('status')
  status() {
    return this.apkAdminService.getStatus();
  }

  @Post('build')
  async build(@Headers(API_KEY_HEADER) apiKey: string | string[] | undefined) {
    const presented = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    return this.apkAdminService.triggerBuild(presented);
  }
}
