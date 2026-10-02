import { Module } from '@nestjs/common';
import { ParticipationsController } from './participations.controller.js';
import { ParticipationsService } from './participations.service.js';

@Module({
  controllers: [ParticipationsController],
  providers: [ParticipationsService],
  exports: [ParticipationsService],
})
export class ParticipationsModule {}
