import { randomUUID } from 'node:crypto';

export const pinoHttpOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  genReqId: (req: { headers: Record<string, unknown> }) =>
    (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.token'],
    remove: true,
  },
  customSuccessObject: (_req: unknown, res: { statusCode: number }, base: Record<string, unknown>) => ({
    ...base,
    statusCode: res.statusCode,
  }),
};
