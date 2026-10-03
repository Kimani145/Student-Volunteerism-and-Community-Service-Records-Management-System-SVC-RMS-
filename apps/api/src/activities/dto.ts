import { z } from 'zod';
import { strictObject, isoDateTimeString } from '@svc-rms/shared';

export const createActivitySchema = strictObject({
  title: z.string().min(1).max(255),
  typeId: z.number().int().positive(),
  description: z.string().min(1),
  venue: z.string().min(1),
  startAt: isoDateTimeString,
  endAt: isoDateTimeString,
  registrationClosesAt: isoDateTimeString,
  capacity: z.number().int().positive(),
  serviceHours: z.number().positive(),
  partnerId: z.string().uuid().optional(),
  eligibleYears: z.array(z.number().int().min(1).max(6)).nullable().optional(),
  venueLat: z.number().min(-90).max(90).optional(),
  venueLng: z.number().min(-180).max(180).optional(),
  geofenceRadiusM: z.number().int().positive().optional(),
});

export const updateActivitySchema = createActivitySchema.partial();
