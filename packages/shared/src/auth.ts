import { UserRole } from './index.js';

/** The shape returned by GET /auth/me */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  student?: {
    id: string;
    regNumber: string;
    fullName: string;
    schoolId: string;
    programme: string;
    yearOfStudy: number;
  } | null;
}
