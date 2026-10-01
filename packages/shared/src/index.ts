import { z } from 'zod';

export enum UserRole {
  STUDENT = 'STUDENT',
  STAFF = 'STAFF',
  MANAGEMENT = 'MANAGEMENT',
  ADMIN = 'ADMIN',
}

export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INTEGRITY_FAILURE = 'INTEGRITY_FAILURE',
}

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
