import { z } from 'zod';

export const issueCertificatesSchema = z.object({
  participationIds: z.array(z.string().uuid()).optional(),
  studentIds: z.array(z.string().uuid()).optional(),
}).strict();

export type IssueCertificatesDto = z.infer<typeof issueCertificatesSchema>;
