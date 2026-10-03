import { z } from 'zod';

export const revokeCertificateSchema = z.object({
  reason: z.string().min(1),
}).strict();

export type RevokeCertificateDto = z.infer<typeof revokeCertificateSchema>;
