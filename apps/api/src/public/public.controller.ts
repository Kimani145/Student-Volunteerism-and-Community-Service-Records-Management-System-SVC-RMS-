import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { PublicService } from './public.service.js';
import { Public } from '../auth/public.decorator.js';
import { FastifyReply } from 'fastify';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@Controller('public')
@Public()
@UseGuards(ThrottlerGuard)
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('keys')
  async getKeys() {
    return this.publicService.getKeys();
  }

  @Get('verify/:cvid')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async verify(@Param('cvid') cvid: string, @Res() res: FastifyReply) {
    try {
      const data = await this.publicService.verifyCertificate(cvid);
      res.header('Cache-Control', 'no-store');
      res.send(data);
    } catch (err: any) {
      res.header('Cache-Control', 'no-store');
      if (err.message === 'INVALID_SIGNATURE') {
        res.status(500).send({ message: 'INVALID_SIGNATURE' });
      } else {
        res.status(err.status || 500).send(err.response || err.message);
      }
    }
  }
}
