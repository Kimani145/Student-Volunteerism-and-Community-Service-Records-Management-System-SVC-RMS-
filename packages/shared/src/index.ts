import { z } from 'zod';

export enum UserRole {
  STUDENT = 'STUDENT',
  STAFF = 'STAFF',
  MANAGEMENT = 'MANAGEMENT',
  ADMIN = 'ADMIN',
}

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_REGISTERED = 'ALREADY_REGISTERED',
  SCHEDULE_CONFLICT = 'SCHEDULE_CONFLICT',
  CAPACITY_FULL = 'CAPACITY_FULL',
  REGISTRATION_CLOSED = 'REGISTRATION_CLOSED',
  NOT_ELIGIBLE = 'NOT_ELIGIBLE',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  RETENTION_ACTIVE = 'RETENTION_ACTIVE',
  CERTIFICATE_LOCKED = 'CERTIFICATE_LOCKED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  RATE_LIMITED = 'RATE_LIMITED',
  UNSUPPORTED_MEDIA = 'UNSUPPORTED_MEDIA',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  INTEGRITY_FAILURE = 'INTEGRITY_FAILURE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export const ErrorCodeHttpStatus: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 422,
  [ErrorCode.UNAUTHENTICATED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_REGISTERED]: 409,
  [ErrorCode.SCHEDULE_CONFLICT]: 409,
  [ErrorCode.CAPACITY_FULL]: 409,
  [ErrorCode.REGISTRATION_CLOSED]: 409,
  [ErrorCode.NOT_ELIGIBLE]: 403,
  [ErrorCode.INVALID_STATE_TRANSITION]: 409,
  [ErrorCode.RETENTION_ACTIVE]: 409,
  [ErrorCode.CERTIFICATE_LOCKED]: 409,
  [ErrorCode.TOKEN_INVALID]: 422,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.UNSUPPORTED_MEDIA]: 415,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCode.INTEGRITY_FAILURE]: 500,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};

export type ProblemJson = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: ErrorCode;
};

export const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

export const isoDateTimeString = z.string().datetime({ offset: true });

export * from './auth.js';
export * from './students.js';
export * from './activities.js';
export * from './participations.js';
export * from './attendance.js';
export * from './certificates.js';
export * from './records.js';
export * from './reports.js';
export * from './notifications.js';
export * from './audit.js';
