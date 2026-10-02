import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SigningService } from '../signing/signing.service.js';

@Injectable()
export class PublicService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SigningService) private readonly signingService: SigningService,
  ) {}

  public async getKeys() {
    const currentKeyId = this.signingService.getKeyId();
    const currentPubStr = this.signingService.getPublicKeyPem() || '';

    // Collect all unique key_ids from the certificates table
    const distinctCerts = await this.prisma.certificates.findMany({
      select: { key_id: true },
      distinct: ['key_id'],
    });

    const keysMap = new Map<string, string>();
    keysMap.set(currentKeyId, currentPubStr);

    if (process.env.CERT_HISTORICAL_KEYS) {
      try {
        const hist = JSON.parse(process.env.CERT_HISTORICAL_KEYS);
        if (Array.isArray(hist)) {
          for (const k of hist) {
            if (k.id && k.publicKey) {
              keysMap.set(k.id, k.publicKey);
            }
          }
        }
      } catch {}
    }

    for (const row of distinctCerts) {
      if (!keysMap.has(row.key_id)) {
        keysMap.set(row.key_id, '');
      }
    }

    return {
      keys: Array.from(keysMap.entries()).map(([id, publicKey]) => ({
        id,
        publicKey,
      })),
    };
  }

  public async verifyCertificate(cvid: string) {
    const cert = await this.prisma.certificates.findUnique({
      where: { cvid },
    });

    if (!cert) {
      throw new NotFoundException('Certificate not found');
    }

    const keys = await this.getKeys();
    const key = keys.keys.find((k) => k.id === cert.key_id);
    const pubKey = key?.publicKey || (cert.key_id === this.signingService.getKeyId() ? this.signingService.getPublicKeyPem() : undefined);

    const payloadObj = cert.payload as any;
    const isValid = this.signingService.verifyCanonical(payloadObj, cert.signature, pubKey || undefined);
    if (!isValid) {
      throw new Error('INVALID_SIGNATURE');
    }

    const status = cert.status === 'REVOKED' ? 'REVOKED' : 'VALID';

    return {
      status,
      verifiedAt: new Date().toISOString(),
      certificate: {
        cvid: cert.cvid,
        studentName: payloadObj.studentName,
        activityTitle: payloadObj.activityTitle,
        serviceDate: payloadObj.serviceDate,
        hours: Number(payloadObj.hours),
        issuer: payloadObj.issuer,
        issuedAt: payloadObj.issuedAt,
        revokedAt: cert.status === 'REVOKED' && cert.revoked_at ? cert.revoked_at.toISOString() : null,
      },
    };
  }
}
