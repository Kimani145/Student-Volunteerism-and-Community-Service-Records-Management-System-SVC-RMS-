import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { createPublicKey, createPrivateKey } from 'crypto';
import { SigningService } from '../signing/signing.service.js';

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signingService: SigningService,
  ) {}

  public async getKeys() {
    const privStr = (process.env.CERT_SIGNING_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    let pubStr = '';
    if (privStr) {
      try {
        const pub = createPublicKey(createPrivateKey(privStr));
        pubStr = pub.export({ format: 'pem', type: 'spki' }).toString();
      } catch {
        pubStr = '';
      }
    }
    
    return {
      keys: [
        {
          id: process.env.CERT_SIGNING_KEY_ID || 'default-key',
          publicKey: pubStr,
        }
      ]
    };
  }

  public async verifyCertificate(cvid: string) {
    const cert = await this.prisma.certificates.findUnique({
      where: { cvid }
    });

    if (!cert) {
      throw new NotFoundException('Certificate not found');
    }

    const keys = await this.getKeys();
    const key = keys.keys.find(k => k.id === cert.key_id);
    if (!key) {
      throw new NotFoundException('Public key not found for verification');
    }

    const payloadObj = cert.payload as any;
    const isValid = this.signingService.verifyCanonical(payloadObj, cert.signature, key.publicKey);
    if (!isValid) {
      throw new Error('INVALID_SIGNATURE');
    }

    return {
      status: cert.status,
      verifiedAt: new Date().toISOString(),
      certificate: {
        cvid: cert.cvid,
        studentName: payloadObj.studentName,
        activityTitle: payloadObj.activityTitle,
        serviceDate: payloadObj.serviceDate,
        hours: payloadObj.hours,
        issuer: payloadObj.issuer,
        issuedAt: payloadObj.issuedAt,
      },
      ...(cert.status === 'REVOKED' && cert.revoked_at ? { revocationDate: cert.revoked_at.toISOString() } : {})
    };
  }
}
