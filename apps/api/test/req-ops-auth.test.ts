import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants.js';
import request from 'supertest';
import { createApp, pinoHttpOptions } from '../src/main.js';
import { applyTestEnv } from './test-env.js';
import { parseEnv } from '../src/config/env.js';
import { HealthController } from '../src/health/health.controller.js';
import { AuditTestController } from '../src/audit/audit-test.controller.js';
import { PUBLIC_KEY } from '../src/auth/public.decorator.js';
import { ROLES_KEY } from '../src/auth/roles.decorator.js';

describe('REQ-OPS-03', () => {
  it('fails env validation on weak JWT secret', () => {
    applyTestEnv();
    expect(() => parseEnv({ ...process.env, JWT_ACCESS_SECRET: 'too-short' })).toThrow();
  });
});

describe('REQ-OPS-04', () => {
  it('configures structured logging with redaction and request ids', () => {
    expect(pinoHttpOptions.redact.paths).toContain('req.headers.authorization');
    const reqId = pinoHttpOptions.genReqId({ headers: {} });
    expect(typeof reqId).toBe('string');
  });
});

describe('REQ-AUTH-07', () => {
  it('every route method declares @Public or @Roles', () => {
    const controllers = [HealthController, AuditTestController];

    for (const controller of controllers) {
      const prototype = controller.prototype;
      const methodNames = Object.getOwnPropertyNames(prototype).filter((name) => name !== 'constructor');

      for (const methodName of methodNames) {
        const handler = (prototype as unknown as Record<string, unknown>)[methodName];
        if (typeof handler !== 'function') {
          continue;
        }
        if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) {
          continue;
        }

        const httpMethod = Reflect.getMetadata(METHOD_METADATA, handler);
        expect(httpMethod).toBeDefined();

        const isPublic = Reflect.getMetadata(PUBLIC_KEY, handler) === true;
        const roles = Reflect.getMetadata(ROLES_KEY, handler) as unknown[] | undefined;
        expect(isPublic || (roles && roles.length > 0)).toBeTruthy();
      }
    }
  });
});

describe('REQ-OPS-01', () => {
  it('exposes health and readiness endpoints', async () => {
    applyTestEnv();
    const app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const http = app.getHttpServer();
    await request(http).get('/api/v1/healthz').expect(200);
    await request(http).get('/api/v1/readyz').expect((res) => {
      expect([200, 503]).toContain(res.status);
    });

    await app.close();
  });
});
