import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ProblemJson, ErrorCodeHttpStatus } from '@svc-rms/shared';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

@Catch()
export class ProblemJsonFilter implements ExceptionFilter {
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
                : status === 503
                  ? ErrorCode.SERVICE_UNAVAILABLE
                  : status === 422
                    ? ErrorCode.VALIDATION_ERROR
                    : ErrorCode.INTERNAL_ERROR;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = 409;
        code = ErrorCode.ALREADY_REGISTERED; // generic conflict
        detail = 'Resource already exists';
      } else if (exception.code === 'P2025') {
        status = 404;
        code = ErrorCode.NOT_FOUND;
        detail = 'Resource not found';
      }
    } else if (exception instanceof Error) {
      if (exception.message.includes('CERTIFICATE_LOCKED')) {
        status = 409;
        code = ErrorCode.CERTIFICATE_LOCKED;
        detail = 'CERTIFICATE_LOCKED';
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
