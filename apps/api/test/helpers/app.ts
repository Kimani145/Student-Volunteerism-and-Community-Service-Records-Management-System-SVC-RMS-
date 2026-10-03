import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { AppModule } from '../../src/app.module.js';

export async function createTestApp(): Promise<NestFastifyApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule.register({ isTest: true })],
  }).compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ trustProxy: true }));
  await app.register(fastifyCookie);
  const maxUploadBytes = parseInt(process.env.MAX_UPLOAD_BYTES || '10485760', 10);
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: maxUploadBytes,
      files: 1,
    },
  });
  app.setGlobalPrefix('api/v1');
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
