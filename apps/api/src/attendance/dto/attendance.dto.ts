import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, IsUUID, Min, Max, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { participation_status } from '@prisma/client';

export class CheckInDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}

export class AttendanceBulkUpdateItemDto {
  @IsUUID()
  id: string; // participation_id

  @IsIn(['ATTENDED', 'ABSENT'])
  status: 'ATTENDED' | 'ABSENT';

  @IsOptional()
  @IsNumber()
  @Min(0)
  hours_awarded?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  reason?: string; // hours override reason
}

export class BulkAttendanceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceBulkUpdateItemDto)
  participations: AttendanceBulkUpdateItemDto[];
}
