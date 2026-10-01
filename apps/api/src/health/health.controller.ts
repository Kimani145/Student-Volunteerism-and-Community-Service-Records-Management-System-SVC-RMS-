import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { HealthService } from './health.service.js';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('/healthz')
  @Public()
  healthz(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('/readyz')
  @Public()
  async readyz(): Promise<{ status: 'ready' }> {
    const ready = await this.healthService.isReady();
    if (!ready) {
      throw new ServiceUnavailableException({ detail: 'Database unavailable' });
    }
    return { status: 'ready' };
  }
}
