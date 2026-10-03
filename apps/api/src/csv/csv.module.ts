import { Module } from '@nestjs/common';
import { CsvService } from './csv.service.js';

@Module({
  providers: [CsvService],
  exports: [CsvService],
})
export class CsvModule {}
