import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ProblemJson } from '@svc-rms/shared';
import { randomUUID } from 'node:crypto';

@Catch()
export class ProblemJsonFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<{ url: string }>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;

    const detail =
      typeof payload === 'object' && payload !== null && 'detail' in payload
        ? String((payload as { detail: unknown }).detail)
        : exception instanceof Error
          ? exception.message
          : 'Unexpected error';

    const code =
      typeof payload === 'object' && payload !== null && 'code' in payload
        ? (payload as { code: ErrorCode }).code
        : status === 401
          ? ErrorCode.UNAUTHORIZED
          : status === 403
            ? ErrorCode.FORBIDDEN
            : status === 404
              ? ErrorCode.NOT_FOUND
              : status === 503
                ? ErrorCode.SERVICE_UNAVAILABLE
                : ErrorCode.INTERNAL_ERROR;

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
