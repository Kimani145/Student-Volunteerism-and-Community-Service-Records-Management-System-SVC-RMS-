import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class IssueCertificatesDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  participationIds?: string[];
}
