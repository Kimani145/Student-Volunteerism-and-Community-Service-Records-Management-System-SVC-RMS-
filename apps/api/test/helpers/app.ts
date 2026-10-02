import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { AppModule } from '../../src/app.module.js';

export async function createTestApp(): Promise<NestFastifyApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule.register({ isTest: true })],
  }).compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await app.register(fastifyCookie);
  app.setGlobalPrefix('api/v1');
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
