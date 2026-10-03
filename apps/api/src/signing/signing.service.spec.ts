import { describe, it, expect, beforeAll } from 'vitest';
import { SigningService } from './signing.service.js';
import { generateKeyPairSync } from 'crypto';

describe('SigningService (REQ-CRT-03, charter #12)', () => {
  let signingService: SigningService;
  let privPem: string;
  let pubPem: string;

  beforeAll(() => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    process.env.CERT_SIGNING_PRIVATE_KEY = privPem;
    process.env.CERT_SIGNING_KEY_ID = 'key-test-1';
    signingService = new SigningService();
  });

  it('REQ-CRT-03: Signs canonical payload and returns 64-byte Buffer', () => {
    const payload = {
      v: 1,
      cvid: 'TUK-VOL-2026-ABCDEF1234',
      studentName: 'Alice Test',
      hours: 10,
    };
    const signature = signingService.sign(payload);
    expect(Buffer.isBuffer(signature)).toBe(true);
    expect(signature.length).toBe(64);
  });

  it('REQ-CRT-03: Verifies valid signature with internal key and explicit public key PEM', () => {
    const payload = {
      v: 1,
      cvid: 'TUK-VOL-2026-ABCDEF1234',
      studentName: 'Alice Test',
      hours: 10,
    };
    const signature = signingService.sign(payload);
    expect(signingService.verify(payload, signature)).toBe(true);
    expect(signingService.verify(payload, signature, pubPem)).toBe(true);
  });

  it('REQ-CRT-03: Charter #12 tamper test - changing one character of payload must fail verification', () => {
    const payload = {
      v: 1,
      cvid: 'TUK-VOL-2026-ABCDEF1234',
      studentName: 'Alice Test',
      hours: 10,
    };
    const signature = signingService.sign(payload);

    // Tamper one character in studentName
    const tamperedPayload = {
      ...payload,
      studentName: 'Alice Pest',
    };
    expect(signingService.verify(tamperedPayload, signature)).toBe(false);

    // Tamper hours
    const tamperedHours = {
      ...payload,
      hours: 11,
    };
    expect(signingService.verify(tamperedHours, signature)).toBe(false);
  });

  it('REQ-CRT-03: Tampering with signature bytes must fail verification', () => {
    const payload = {
      v: 1,
      cvid: 'TUK-VOL-2026-ABCDEF1234',
    };
    const signature = signingService.sign(payload);
    const tamperedSig = Buffer.from(signature);
    tamperedSig[0] = (tamperedSig[0] ?? 0) ^ 0xff; // flip bits of first byte

    expect(signingService.verify(payload, tamperedSig)).toBe(false);
  });
});
