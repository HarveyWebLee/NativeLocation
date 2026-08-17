import { Module } from '@nestjs/common';

import { ApkAdminController } from './apk-admin.controller';
import { ApkAdminService } from './apk-admin.service';

@Module({
  controllers: [ApkAdminController],
  providers: [ApkAdminService],
})
export class ApkAdminModule {}
