import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign, createVerify, KeyObject, createPrivateKey } from 'crypto';
import { Env } from '../config/env.js';
import { canonicalizeJson } from './canonical.js';

@Injectable()
export class SigningService {
  private readonly privateKey: KeyObject;
  private readonly keyId: string;

  constructor(private configService: ConfigService<Env, true>) {
    this.keyId = this.configService.get('CERT_SIGNING_KEY_ID');
    const keyStr = this.configService.get('CERT_SIGNING_PRIVATE_KEY').replace(/\\n/g, '\n');
    this.privateKey = createPrivateKey(keyStr);
  }

  public getKeyId(): string {
    return this.keyId;
  }

  public signCanonical(payload: any): Buffer {
    const canonicalStr = canonicalizeJson(payload);
    const sign = createSign('ed25519');
    sign.update(canonicalStr);
    sign.end();
    return sign.sign(this.privateKey);
  }

  public verifyCanonical(payload: any, signature: Buffer, publicKey: string | KeyObject): boolean {
    const canonicalStr = canonicalizeJson(payload);
    const verify = createVerify('ed25519');
    verify.update(canonicalStr);
    verify.end();
    return verify.verify(publicKey, signature);
  }
}
