import { IsNotEmpty, IsString } from 'class-validator';

export class RevokeCertificateDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}
