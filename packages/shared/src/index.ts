import { z } from 'zod';

export const locationSourceSchema = z.enum(['foreground', 'background']);

export const locationPointSchema = z.object({
  deviceId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable().optional(),
  altitude: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  recordedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'recordedAt must be a valid ISO datetime',
  }),
  source: locationSourceSchema.default('foreground'),
});

export const locationBatchSchema = z.object({
  points: z.array(locationPointSchema).min(1).max(200),
});

export const deviceRegisterSchema = z.object({
  deviceId: z.string().min(1).optional(),
  platform: z.enum(['ios', 'android', 'unknown']).default('unknown'),
  displayName: z.string().max(128).optional(),
});

export type LocationSource = z.infer<typeof locationSourceSchema>;
export type LocationPoint = z.infer<typeof locationPointSchema>;
export type LocationBatch = z.infer<typeof locationBatchSchema>;
export type DeviceRegisterInput = z.infer<typeof deviceRegisterSchema>;

export const API_PATHS = {
  health: '/health',
  registerDevice: '/v1/devices/register',
  locationBatch: '/v1/location/batch',
  locationStream: '/v1/location/stream',
} as const;
