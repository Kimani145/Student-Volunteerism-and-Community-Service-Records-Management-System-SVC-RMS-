import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import helmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import { AppModule } from './app.module.js';
import { parseEnv } from './config/env.js';
import { pinoHttpOptions } from './config/logger.js';

export async function createApp(): Promise<NestFastifyApplication> {
  parseEnv(process.env);

  const rootModule = process.env.NODE_ENV === 'test' ? AppModule.register({ isTest: true }) : AppModule;

  const app = await NestFactory.create<NestFastifyApplication>(rootModule, new FastifyAdapter(), {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  await app.register(fastifyCookie);

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  app.setGlobalPrefix('api/v1');
  return app;
}

async function bootstrap(): Promise<void> {
  const app = await createApp();
  await app.listen({ port: parseInt(process.env.PORT || '3001', 10), host: '0.0.0.0' });
}

if (process.env.NODE_ENV !== 'test') {
  void bootstrap();
}

export { pinoHttpOptions };
