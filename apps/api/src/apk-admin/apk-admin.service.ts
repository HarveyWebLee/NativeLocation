import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

export type ApkBuildPhase = 'idle' | 'running' | 'success' | 'failed';

export type ApkBuildStatusDto = {
  status: ApkBuildPhase;
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
  apkAvailable: boolean;
  downloadPath: string;
  logTail?: string;
};

@Injectable()
export class ApkAdminService {
  private readonly agentUrl =
    process.env.APK_BUILD_AGENT_URL?.trim() ||
    'http://host.docker.internal:18210';

  private readonly statusFilePath = path.resolve(
    process.cwd(),
    process.env.APK_STATUS_FILE?.trim() || '/app/deploy/apk/build-status.json',
  );

  private readonly apkFilePath = path.resolve(
    process.cwd(),
    process.env.APK_FILE_PATH?.trim() ||
      '/app/deploy/apk/native-location-preview.apk',
  );

  getStatus(): ApkBuildStatusDto {
    const fromFile = this.readStatusFile();
    if (fromFile) {
      return {
        ...fromFile,
        apkAvailable: existsSync(this.apkFilePath),
      };
    }
    return {
      status: 'idle',
      message: '尚未构建（或 agent 未写入状态文件）',
      startedAt: null,
      finishedAt: null,
      apkAvailable: existsSync(this.apkFilePath),
      downloadPath: '/downloads/native-location-preview.apk',
    };
  }

  async triggerBuild(apiKey: string | undefined): Promise<ApkBuildStatusDto> {
    const current = this.getStatus();
    if (current.status === 'running') {
      throw new ConflictException('已有构建任务进行中');
    }

    let response: Response;
    try {
      response = await fetch(`${this.agentUrl}/build`, {
        method: 'POST',
        headers: {
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
      });
    } catch {
      throw new ServiceUnavailableException(
        `无法连接 APK build agent（${this.agentUrl}）。请在宿主机运行: pnpm apk:agent`,
      );
    }

    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (response.status === 401) {
      throw new UnauthorizedException('invalid api key');
    }
    if (response.status === 409) {
      throw new ConflictException('已有构建任务进行中');
    }
    if (!response.ok && response.status !== 202) {
      throw new ServiceUnavailableException(
        typeof body.message === 'string'
          ? body.message
          : `agent 返回 HTTP ${response.status}`,
      );
    }

    return {
      status: 'running',
      message:
        typeof body.message === 'string' ? body.message : '已接受构建任务',
      startedAt:
        typeof body.startedAt === 'string'
          ? body.startedAt
          : new Date().toISOString(),
      finishedAt: null,
      apkAvailable: existsSync(this.apkFilePath),
      downloadPath: '/downloads/native-location-preview.apk',
    };
  }

  private readStatusFile(): ApkBuildStatusDto | null {
    if (!existsSync(this.statusFilePath)) {
      return null;
    }
    try {
      const parsed = JSON.parse(
        readFileSync(this.statusFilePath, 'utf8'),
      ) as Partial<ApkBuildStatusDto>;
      return {
        status: parsed.status ?? 'idle',
        message: parsed.message ?? '',
        startedAt: parsed.startedAt ?? null,
        finishedAt: parsed.finishedAt ?? null,
        apkAvailable: Boolean(parsed.apkAvailable),
        downloadPath:
          parsed.downloadPath ?? '/downloads/native-location-preview.apk',
        logTail: parsed.logTail,
      };
    } catch {
      return null;
    }
  }
}
