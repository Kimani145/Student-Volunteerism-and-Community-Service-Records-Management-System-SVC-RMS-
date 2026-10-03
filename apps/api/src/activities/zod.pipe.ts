import { PipeTransform, Injectable, ArgumentMetadata, UnprocessableEntityException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { ErrorCode } from '@svc-rms/shared';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema<any>) {}

  transform(value: any, metadata: ArgumentMetadata) {
    try {
      if (metadata.type === 'body') {
        return this.schema.parse(value);
      }
      return value;
    } catch (error) {
      if (error instanceof ZodError) {
        throw new UnprocessableEntityException({
          code: ErrorCode.VALIDATION_ERROR,
          detail: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      throw error;
    }
  }
}
