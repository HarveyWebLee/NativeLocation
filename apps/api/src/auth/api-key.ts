import { timingSafeEqual } from 'node:crypto';

export function getConfiguredApiKey(): string | undefined {
  const value = process.env.API_KEY?.trim();
  return value ? value : undefined;
}

export function assertProductionApiKey(): void {
  if (process.env.NODE_ENV === 'production' && !getConfiguredApiKey()) {
    throw new Error('生产环境必须设置 API_KEY');
  }
}

export function isApiKeyValid(presented: string | undefined): boolean {
  const expected = getConfiguredApiKey();
  if (!expected) {
    return true;
  }
  if (!presented) {
    return false;
  }
  const presentedBuffer = Buffer.from(presented);
  const expectedBuffer = Buffer.from(expected);
  if (presentedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(presentedBuffer, expectedBuffer);
}
