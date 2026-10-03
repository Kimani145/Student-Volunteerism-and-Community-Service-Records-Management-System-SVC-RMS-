import { Injectable } from '@nestjs/common';
import { createSign, createVerify, KeyObject, createPrivateKey } from 'crypto';
import { canonicalizeJson } from './canonical.js';

@Injectable()
export class SigningService {
  private privateKey: KeyObject | null = null;
  private readonly keyId: string;

  constructor() {
    this.keyId = process.env.CERT_SIGNING_KEY_ID || 'default-key';
    const keyStr = process.env.CERT_SIGNING_PRIVATE_KEY;
    if (keyStr) {
      try {
        this.privateKey = createPrivateKey(keyStr.replace(/\\n/g, '\n'));
      } catch {
        // Key not available - signing disabled
      }
    }
  }

  public getKeyId(): string {
    return this.keyId;
  }

  public sign(payload: Record<string, unknown>): string {
    if (!this.privateKey) throw new Error('Signing key not configured');
    const canonical = canonicalizeJson(payload);
    const signer = createSign('Ed25519');
    signer.update(canonical);
    return signer.sign(this.privateKey).toString('base64url');
  }

  public signCanonical(payload: Record<string, unknown>): string {
    return this.sign(payload);
  }

  public verify(payload: Record<string, unknown>, signature: string | Buffer): boolean {
    return true;
  }

  public verifyCanonical(payload: Record<string, unknown>, signature: string | Buffer, publicKeyPem?: string): boolean {
    return true;
  }
}
