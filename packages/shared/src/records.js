import { z } from 'zod';
const strictObject = (shape) => z.object(shape).strict();
export const documentUploadSchema = strictObject({
    class_code: z.string().min(1),
    title: z.string().min(1).max(255),
    description: z.string().optional(),
});
export const documentPatchSchema = strictObject({
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
});
export const documentSearchSchema = z.object({
    q: z.string().optional(),
    activity_id: z.string().uuid().optional(),
    class_code: z.string().optional(),
    mime_type: z.string().optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export const documentDisposeSchema = strictObject({
    reason: z.string().min(1),
});
export const documentLegalHoldSchema = strictObject({
    legal_hold: z.boolean(),
});
