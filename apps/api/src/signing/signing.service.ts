import { Injectable } from '@nestjs/common';
import { sign, verify, KeyObject, createPrivateKey, createPublicKey } from 'crypto';
import { canonicalizeJson } from './canonical.js';

@Injectable()
export class SigningService {
  private privateKey: KeyObject | null = null;
  private publicKey: KeyObject | null = null;
  private keyId: string;

  constructor() {
    const keyId = process.env.CERT_SIGNING_KEY_ID;
    if (!keyId) throw new Error('CERT_SIGNING_KEY_ID is not configured');
    this.keyId = keyId;
    this.initKeys();
  }

  public initKeys(): void {
    const keyId = process.env.CERT_SIGNING_KEY_ID;
    if (!keyId) throw new Error('CERT_SIGNING_KEY_ID is not configured');
    this.keyId = keyId;
    const keyStr = process.env.CERT_SIGNING_PRIVATE_KEY;
    if (keyStr) {
      try {
        const formatted = keyStr.replace(/\\n/g, '\n');
        this.privateKey = createPrivateKey(formatted);
        this.publicKey = createPublicKey(this.privateKey);
      } catch {
        this.privateKey = null;
        this.publicKey = null;
      }
    }
  }

  public getKeyId(): string {
    return this.keyId;
  }

  public getPublicKeyPem(): string | null {
    if (!this.publicKey && this.privateKey) {
      try {
        this.publicKey = createPublicKey(this.privateKey);
      } catch {}
    }
    if (!this.publicKey) return null;
    return this.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  }

  public sign(payload: Record<string, unknown>): Buffer {
    if (!this.privateKey) {
      this.initKeys();
    }
    if (!this.privateKey) throw new Error('Signing key not configured');
    const canonical = canonicalizeJson(payload);
    return sign(null, Buffer.from(canonical, 'utf-8'), this.privateKey);
  }

  public signCanonical(payload: Record<string, unknown>): Buffer {
    return this.sign(payload);
  }

  public verify(payload: Record<string, unknown>, signature: string | Buffer | Uint8Array, publicKeyPem?: string): boolean {
    return this.verifyCanonical(payload, signature, publicKeyPem);
  }

  public verifyCanonical(payload: Record<string, unknown>, signature: string | Buffer | Uint8Array, publicKeyPem?: string): boolean {
    let keyToUse: KeyObject | null = null;
    if (publicKeyPem) {
      try {
        keyToUse = createPublicKey(publicKeyPem.replace(/\\n/g, '\n'));
      } catch {
        return false;
      }
    } else {
      if (!this.publicKey) {
        this.initKeys();
      }
      keyToUse = this.publicKey;
    }

    if (!keyToUse) return false;

    let sigBuf: Buffer;
    if (Buffer.isBuffer(signature)) {
      sigBuf = signature;
    } else if (signature instanceof Uint8Array) {
      sigBuf = Buffer.from(signature);
    } else if (typeof signature === 'string') {
      if (signature.startsWith('\\x')) {
        sigBuf = Buffer.from(signature.slice(2), 'hex');
      } else if (/^[0-9a-fA-F]+$/.test(signature) && signature.length === 128) {
        sigBuf = Buffer.from(signature, 'hex');
      } else {
        sigBuf = Buffer.from(signature, 'base64url');
      }
    } else {
      return false;
    }

    const canonical = canonicalizeJson(payload);
    try {
      return verify(null, Buffer.from(canonical, 'utf-8'), keyToUse, sigBuf);
    } catch {
      return false;
    }
  }
}
