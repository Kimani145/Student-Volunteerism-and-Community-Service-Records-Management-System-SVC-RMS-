import { Controller, Get, Param, Res, UseGuards, Inject, HttpException } from '@nestjs/common';
import { PublicService } from './public.service.js';
import { Public } from '../auth/public.decorator.js';
import { FastifyReply } from 'fastify';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@Controller('public')
@Public()
@UseGuards(ThrottlerGuard)
export class PublicController {
  constructor(@Inject(PublicService) private readonly publicService: PublicService) {}

  @Get('keys')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getKeys(@Res() res: FastifyReply) {
    res.header('Cache-Control', 'no-store');
    const data = await this.publicService.getKeys();
    res.send(data);
  }

  @Get('verify/:cvid')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async verify(@Param('cvid') cvid: string, @Res() res: FastifyReply) {
    res.header('Cache-Control', 'no-store');
    try {
      const data = await this.publicService.verifyCertificate(cvid);
      res.send(data);
    } catch (err: any) {
      if (err.message === 'INVALID_SIGNATURE') {
        res.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          code: 'INVALID_SIGNATURE',
          message: 'INVALID_SIGNATURE',
        });
      } else if (err instanceof HttpException) {
        res.status(err.getStatus()).send(err.getResponse());
      } else {
        res.status(err.status || 500).send(err.response || { message: err.message || 'Internal Server Error' });
      }
    }
  }
}
