import { Module } from '@nestjs/common';
import { PublicController } from './public.controller.js';
import { PublicService } from './public.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SigningModule } from '../signing/signing.module.js';

@Module({
  imports: [PrismaModule, SigningModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
