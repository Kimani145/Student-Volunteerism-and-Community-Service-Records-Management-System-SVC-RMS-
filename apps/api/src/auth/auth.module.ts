import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { MailService } from '../mail/mail.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenService, MailService],
  exports: [TokenService],
})
export class AuthModule {}
