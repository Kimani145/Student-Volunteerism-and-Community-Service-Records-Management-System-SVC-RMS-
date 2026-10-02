import { SignJWT } from 'jose';
import { UserRole } from '@svc-rms/shared';

export async function bearer(user: { id: string, role: UserRole }): Promise<string> {
  const secretKey = process.env.JWT_ACCESS_SECRET || 'test_secret_for_jwt_auth_guard_that_is_at_least_32_chars_long';
  const secret = new TextEncoder().encode(secretKey);
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
  return `Bearer ${token}`;
}
