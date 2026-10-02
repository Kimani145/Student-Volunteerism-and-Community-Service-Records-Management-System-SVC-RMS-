import { Module } from '@nestjs/common';
import { SigningService } from './signing.service.js';

@Module({
  providers: [SigningService],
  exports: [SigningService],
})
export class SigningModule {}
