export const REQUIRED_KEYS: readonly string[];

export function buildDatabaseUrl(env?: NodeJS.ProcessEnv): string;

export function applyDatabaseUrl(
  env?: NodeJS.ProcessEnv,
  options?: { optional?: boolean },
): void;
