import { Module, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import multipart from '@fastify/multipart';
import { RecordsController } from './records.controller.js';
import { RecordsService } from './records.service.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [StorageModule],
  controllers: [RecordsController],
  providers: [RecordsService],
})
export class RecordsModule {}
