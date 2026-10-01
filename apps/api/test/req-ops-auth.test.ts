import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants.js';
import { ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import request from 'supertest';
import { ErrorCode, UserRole } from '@svc-rms/shared';
import { createApp, pinoHttpOptions } from '../src/main.js';
import { applyTestEnv } from './test-env.js';
import { parseEnv } from '../src/config/env.js';
import { PUBLIC_KEY } from '../src/auth/public.decorator.js';
import { ROLES_KEY } from '../src/auth/roles.decorator.js';
import { RoutePolicyGuard } from '../src/auth/route-policy.guard.js';

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
  it('enumerates every route, asserts @Public or @Roles, and denies unauthenticated access with 401', async () => {
    applyTestEnv();
    const app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const discoveryService = app.get(DiscoveryService);
    const reflector = app.get(Reflector);
    const controllers = discoveryService.getControllers();

    expect(controllers.length).toBeGreaterThan(0);

    const nonPublicRoutes: Array<{ method: string; path: string }> = [];
    let totalRoutesChecked = 0;

    for (const controllerWrapper of controllers) {
      const { metatype } = controllerWrapper;
      if (!metatype) continue;

      const controllerPath = (Reflect.getMetadata(PATH_METADATA, metatype) as string | undefined) ?? '';
      const prototype = metatype.prototype;
      const methodNames = Object.getOwnPropertyNames(prototype).filter(
        (name) => name !== 'constructor' && typeof prototype[name] === 'function',
      );

      for (const methodName of methodNames) {
        const handler = prototype[methodName];
        const routePath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        if (routePath === undefined) {
          continue;
        }

        const httpMethodCode = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
        expect(httpMethodCode).toBeDefined();

        const isPublic =
          reflector.get<boolean>(PUBLIC_KEY, handler) === true ||
          reflector.get<boolean>(PUBLIC_KEY, metatype) === true;
        const roles =
          reflector.get<UserRole[]>(ROLES_KEY, handler) ||
          reflector.get<UserRole[]>(ROLES_KEY, metatype);

        // Assert that every route is annotated with either @Public() or @Roles(...)
        expect(isPublic || (Array.isArray(roles) && roles.length > 0)).toBe(true);
        totalRoutesChecked++;

        if (!isPublic) {
          const cleanController = controllerPath ? `/${controllerPath.replace(/^\/|\/$/g, '')}` : '';
          const cleanRoute = routePath ? `/${routePath.replace(/^\/|\/$/g, '')}` : '';
          const fullPath = `/api/v1${cleanController}${cleanRoute}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

          const methodMap: Record<number, 'get' | 'post' | 'put' | 'delete' | 'patch'> = {
            0: 'get',
            1: 'post',
            2: 'put',
            3: 'delete',
            4: 'patch',
          };
          const method = methodMap[httpMethodCode!] ?? 'get';
          nonPublicRoutes.push({ method, path: fullPath });
        }
      }
    }

    expect(totalRoutesChecked).toBeGreaterThan(0);
    expect(nonPublicRoutes.length).toBeGreaterThan(0);

    const http = app.getHttpServer();
    for (const route of nonPublicRoutes) {
      const server = request(http);
      const req =
        route.method === 'post'
          ? server.post(route.path)
          : route.method === 'put'
            ? server.put(route.path)
            : route.method === 'delete'
              ? server.delete(route.path)
              : route.method === 'patch'
                ? server.patch(route.path)
                : server.get(route.path);
      const res = await req;
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ErrorCode.UNAUTHORIZED);
    }

    await app.close();
  });

  it('fails with internal error if a route lacks both @Public and @Roles metadata', () => {
    const reflector = new Reflector();
    const guard = new RoutePolicyGuard(reflector);
    const mockContext = {
      getHandler: () => () => {},
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as unknown as ExecutionContext;

    try {
      guard.canActivate(mockContext);
      expect.fail('Expected route without metadata to be denied');
    } catch (err) {
      expect(err).toBeInstanceOf(InternalServerErrorException);
      const res = (err as InternalServerErrorException).getResponse() as { code: string; detail: string };
      expect(res.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(res.detail).toBe('Route policy metadata missing');
    }
  });

  it('does not register AuditTestController when NODE_ENV is production', async () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const app = await createApp();
      await app.init();
      const discovery = app.get(DiscoveryService);
      const controllerNames = discovery.getControllers().map((c) => c.name);
      expect(controllerNames).not.toContain('AuditTestController');
      await app.close();
    } finally {
      process.env.NODE_ENV = prevEnv;
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
