import { z } from 'zod';
export var UserRole;
(function (UserRole) {
    UserRole["STUDENT"] = "STUDENT";
    UserRole["STAFF"] = "STAFF";
    UserRole["MANAGEMENT"] = "MANAGEMENT";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (UserRole = {}));
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["UNAUTHENTICATED"] = "UNAUTHENTICATED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["ALREADY_REGISTERED"] = "ALREADY_REGISTERED";
    ErrorCode["SCHEDULE_CONFLICT"] = "SCHEDULE_CONFLICT";
    ErrorCode["CAPACITY_FULL"] = "CAPACITY_FULL";
    ErrorCode["REGISTRATION_CLOSED"] = "REGISTRATION_CLOSED";
    ErrorCode["NOT_ELIGIBLE"] = "NOT_ELIGIBLE";
    ErrorCode["INVALID_STATE_TRANSITION"] = "INVALID_STATE_TRANSITION";
    ErrorCode["RETENTION_ACTIVE"] = "RETENTION_ACTIVE";
    ErrorCode["CERTIFICATE_LOCKED"] = "CERTIFICATE_LOCKED";
    ErrorCode["TOKEN_INVALID"] = "TOKEN_INVALID";
    ErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    ErrorCode["UNSUPPORTED_MEDIA"] = "UNSUPPORTED_MEDIA";
    ErrorCode["PAYLOAD_TOO_LARGE"] = "PAYLOAD_TOO_LARGE";
    ErrorCode["INTEGRITY_FAILURE"] = "INTEGRITY_FAILURE";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
})(ErrorCode || (ErrorCode = {}));
export const ErrorCodeHttpStatus = {
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
export const strictObject = (shape) => z.object(shape).strict();
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
