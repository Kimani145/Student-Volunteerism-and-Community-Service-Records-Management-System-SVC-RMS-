import { PipeTransform, Injectable, HttpException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { ErrorCode } from '@svc-rms/shared';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema<any>) {}

  transform(value: any) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new HttpException({ code: ErrorCode.VALIDATION_ERROR, detail: error.errors?.[0]?.message || "Validation Error" }, 422);
      }
      throw new HttpException({ code: ErrorCode.VALIDATION_ERROR, detail: 'Validation failed' }, 422);
    }
  }
}
