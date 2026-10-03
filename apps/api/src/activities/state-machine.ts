import { ConflictException } from '@nestjs/common';
import { ErrorCode } from '@svc-rms/shared';

// Allowed transitions
const transitions: Record<string, string[]> = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function checkTransition(current: string, next: string) {
  const allowed = transitions[current] || [];
  if (!allowed.includes(next)) {
    throw new ConflictException({ code: ErrorCode.INVALID_STATE_TRANSITION, detail: 'Invalid state transition' });
  }
}
