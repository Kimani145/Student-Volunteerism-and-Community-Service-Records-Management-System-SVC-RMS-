import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { CsvModule } from '../csv/csv.module.js';

@Module({
  imports: [CsvModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
