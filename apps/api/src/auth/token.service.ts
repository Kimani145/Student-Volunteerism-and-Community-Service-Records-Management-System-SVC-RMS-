import { Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';

@Injectable()
export class TokenService {
  private secret: Uint8Array;

  constructor() {
    const secretKey = process.env.JWT_ACCESS_SECRET;
    if (!secretKey) {
      throw new Error('JWT_ACCESS_SECRET is required');
    }
    this.secret = new TextEncoder().encode(secretKey);
  }

  async signAccess(user: { id: string; role?: string; canApprove?: boolean; studentId?: string }): Promise<string> {
    return new SignJWT({
      sub: user.id,
      role: user.role,
      canApprove: user.canApprove,
      studentId: user.studentId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(this.secret);
  }

  async verifyAccess(token: string): Promise<any> {
    const { payload } = await jwtVerify(token, this.secret, {
      algorithms: ['HS256'],
    });
    return payload;
  }
}

