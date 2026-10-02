import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ErrorCode, ProblemJson, ErrorCodeHttpStatus } from '@svc-rms/shared';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

@Catch()
export class ProblemJsonFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemJsonFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<{ url: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail = 'Unexpected error';
    let code = ErrorCode.INTERNAL_ERROR;

    const isHttpException =
      exception instanceof HttpException ||
      (typeof exception === 'object' &&
        exception !== null &&
        'getStatus' in exception &&
        typeof (exception as { getStatus: unknown }).getStatus === 'function');

    if (isHttpException) {
      status = (exception as HttpException).getStatus();
      const payload = (exception as HttpException).getResponse();
      detail =
        typeof payload === 'object' && payload !== null && 'detail' in payload
          ? String((payload as { detail: unknown }).detail)
          : exception instanceof Error
            ? exception.message
            : 'Unexpected error';
      code =
        typeof payload === 'object' && payload !== null && 'code' in payload
          ? (payload as { code: ErrorCode }).code
          : status === 401
            ? ErrorCode.UNAUTHENTICATED
            : status === 403
              ? ErrorCode.FORBIDDEN
              : status === 404
                ? ErrorCode.NOT_FOUND
                : status === 413
                  ? ErrorCode.PAYLOAD_TOO_LARGE
                  : status === 415
                    ? ErrorCode.UNSUPPORTED_MEDIA
                    : status === 409
                      ? (payload as any)?.code || ErrorCode.ALREADY_REGISTERED
                      : status === 503
                        ? ErrorCode.SERVICE_UNAVAILABLE
                        : status === 422
                          ? ErrorCode.VALIDATION_ERROR
                          : ErrorCode.INTERNAL_ERROR;

      if (status === 400 && detail.toLowerCase().includes('uuid')) {
        status = 422;
        code = ErrorCode.VALIDATION_ERROR;
      }
    } else if (
      (exception as any)?.statusCode === 413 ||
      (exception as any)?.code === 'FST_REQ_FILE_TOO_LARGE'
    ) {
      status = 413;
      code = ErrorCode.PAYLOAD_TOO_LARGE;
      detail = 'File exceeds maximum upload size';
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = 409;
        code = ErrorCode.ALREADY_REGISTERED; // generic conflict
        detail = 'Resource already exists';
      } else if (exception.code === 'P2003') {
        status = 422;
        code = ErrorCode.VALIDATION_ERROR;
        detail = 'Invalid reference: referenced entity does not exist';
      } else if (exception.code === 'P2023') {
        status = 422;
        code = ErrorCode.VALIDATION_ERROR;
        detail = 'Malformed UUID parameter';
      } else if (exception.code === 'P2025') {
        status = 404;
        code = ErrorCode.NOT_FOUND;
        detail = 'Resource not found';
      }
    } else if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      if (
        exception.message.includes('invalid input syntax for type uuid') ||
        exception.message.includes('22P02')
      ) {
        status = 422;
        code = ErrorCode.VALIDATION_ERROR;
        detail = 'Malformed UUID parameter';
      }
    } else if (exception instanceof Error) {
      if (
        exception.message.includes('invalid input syntax for type uuid') ||
        exception.message.includes('22P02') ||
        exception.message.toLowerCase().includes('malformed uuid')
      ) {
        status = 422;
        code = ErrorCode.VALIDATION_ERROR;
        detail = 'Malformed UUID parameter';
      } else if (exception.message.includes('CERTIFICATE_LOCKED')) {
        status = 409;
        code = ErrorCode.CERTIFICATE_LOCKED;
        detail = 'CERTIFICATE_LOCKED';
      }
    }

    if (status >= 500) {
      if (exception instanceof Error) {
        console.error(`[ProblemJsonFilter] 5xx: ${exception.message}`, exception.stack);
        this.logger.error(`5xx Server Error: ${exception.message}`, exception.stack);
      } else {
        console.error(`[ProblemJsonFilter] 5xx: ${String(exception)}`);
        this.logger.error(`5xx Server Error: ${String(exception)}`);
      }
    }

    const body: ProblemJson = {
      type: 'about:blank',
      title: HttpStatus[status] ?? 'Error',
      status,
      detail,
      instance: request?.url ?? `urn:request:${randomUUID()}`,
      code,
    };

    response
      .header('content-type', 'application/problem+json; charset=utf-8')
      .status(status)
      .send(body);
  }
}
