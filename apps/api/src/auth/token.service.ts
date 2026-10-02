import { Injectable } from '@nestjs/common';

@Injectable()
export class TokenService {
  async signAccess(user: any): Promise<string> {
    return 'dummy-token';
  }

  async verifyAccess(token: string): Promise<any> {
    return { sub: 'dummy' };
  }
}
