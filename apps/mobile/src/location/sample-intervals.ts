export type LocationSampleInterval = {
  id: string;
  label: string;
  intervalMs: number;
};

/** 仅时间间隔；不含每秒 5 次（系统通常达不到） */
export const LOCATION_SAMPLE_INTERVALS: readonly LocationSampleInterval[] = [
  { id: '500', label: '每秒 2 次', intervalMs: 500 },
  { id: '1000', label: '每秒 1 次', intervalMs: 1000 },
  { id: '3000', label: '每 3 秒一次', intervalMs: 3000 },
  { id: '5000', label: '每 5 秒一次', intervalMs: 5000 },
  { id: '10000', label: '每 10 秒一次', intervalMs: 10000 },
  { id: '15000', label: '每 15 秒一次', intervalMs: 15000 },
  { id: '20000', label: '每 20 秒一次', intervalMs: 20000 },
] as const;

export const DEFAULT_SAMPLE_INTERVAL_MS = 1000;

export function isSupportedSampleInterval(intervalMs: number): boolean {
  return LOCATION_SAMPLE_INTERVALS.some(
    (option) => option.intervalMs === intervalMs,
  );
}
