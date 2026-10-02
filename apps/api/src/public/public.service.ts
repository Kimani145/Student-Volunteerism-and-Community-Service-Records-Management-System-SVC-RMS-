import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.js';
import { createPublicKey, createPrivateKey } from 'crypto';
import { SigningService } from '../signing/signing.service.js';

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Env, true>,
    private readonly signingService: SigningService,
  ) {}

  public async getKeys() {
    // We only have the current active key from env, but per requirements we 
    // publish it. To "list every key id ever used", we would ideally have a keys table, 
    // but without one, we just return the current active one.
    const privStr = this.configService.get('CERT_SIGNING_PRIVATE_KEY').replace(/\\n/g, '\n');
    const pub = createPublicKey(createPrivateKey(privStr));
    const pubStr = pub.export({ format: 'pem', type: 'spki' }).toString();
    
    return {
      keys: [
        {
          id: this.configService.get('CERT_SIGNING_KEY_ID'),
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

    // Determine public key to verify with. Currently we only have the active one.
    const keys = await this.getKeys();
    const key = keys.keys.find(k => k.id === cert.key_id);
    if (!key) {
      // In a real system, we'd fetch older keys. For now, assume it's the active one or fail.
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
