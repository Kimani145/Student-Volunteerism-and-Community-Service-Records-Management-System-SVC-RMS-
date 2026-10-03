import { z } from 'zod';

const nonEmpty = z.string().min(1);

const PLACEHOLDER_PATTERNS = [
  /replace-with/i,
  /placeholder/i,
  /changeme/i,
  /secret-pepper/i,
  /supersecret/i,
];

export const envSchema = z
  .object({
    DATABASE_URL: nonEmpty,
    JWT_ACCESS_SECRET: z.string().min(32),
    REFRESH_TOKEN_PEPPER: z.string().min(16),
    QR_MASTER_SECRET: z.string().min(32),
    CERT_SIGNING_PRIVATE_KEY: nonEmpty,
    CERT_SIGNING_KEY_ID: nonEmpty,
    PUBLIC_WEB_ORIGIN: z.string().url(),
    ALLOWED_STUDENT_EMAIL_DOMAINS: nonEmpty,
    SMTP_URL: nonEmpty,
    MAIL_FROM: nonEmpty,
    STORAGE_ROOT: nonEmpty,
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10_485_760),
    ISSUER_NAME: nonEmpty,
    SIGNATORY_1_NAME: nonEmpty,
    SIGNATORY_1_TITLE: nonEmpty,
    SIGNATORY_2_NAME: nonEmpty,
    SIGNATORY_2_TITLE: nonEmpty,
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      const secretsToCheck: Array<{ name: string; val: string }> = [
        { name: 'JWT_ACCESS_SECRET', val: data.JWT_ACCESS_SECRET },
        { name: 'REFRESH_TOKEN_PEPPER', val: data.REFRESH_TOKEN_PEPPER },
        { name: 'QR_MASTER_SECRET', val: data.QR_MASTER_SECRET },
        { name: 'CERT_SIGNING_PRIVATE_KEY', val: data.CERT_SIGNING_PRIVATE_KEY },
      ];
      for (const secret of secretsToCheck) {
        if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(secret.val))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [secret.name],
            message: `${secret.name} contains a placeholder value in production`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (input: NodeJS.ProcessEnv): Env => envSchema.parse(input);
