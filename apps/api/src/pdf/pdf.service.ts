import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { Env } from '../config/env.js';

export interface CertificateData {
  cvid: string;
  studentName: string;
  activityTitle: string;
  serviceDate: string;
  hours: number;
  issuer: string;
  issuedAt: string;
}

@Injectable()
export class PdfService {
  constructor(private configService: ConfigService<Env, true>) {}

  public async generateCertificate(data: CertificateData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margin: 50,
          info: {
            Title: `Certificate of Participation - ${data.cvid}`,
            Author: data.issuer,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Background / Border
        doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();

        // Title
        doc.fontSize(36).text('Certificate of Participation', { align: 'center' });
        doc.moveDown(0.5);

        // Body
        doc.fontSize(16).text('This is to certify that', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(28).text(data.studentName, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).text('has successfully completed the activity:', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(24).text(data.activityTitle, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).text(
          `on ${data.serviceDate} and was awarded ${data.hours} service hour(s).`,
          { align: 'center' },
        );

        // Signatories
        doc.moveDown(2);
        const ySignatures = doc.y;
        doc.fontSize(14).text(this.configService.get('SIGNATORY_1_NAME'), 100, ySignatures);
        doc.fontSize(12).text(this.configService.get('SIGNATORY_1_TITLE'), 100, ySignatures + 15);
        
        doc.fontSize(14).text(this.configService.get('SIGNATORY_2_NAME'), 500, ySignatures);
        doc.fontSize(12).text(this.configService.get('SIGNATORY_2_TITLE'), 500, ySignatures + 15);

        // CVID
        doc.fontSize(10).text(`CVID: ${data.cvid}`, 50, doc.page.height - 70);
        doc.text(`Issued by: ${data.issuer}`, 50, doc.page.height - 55);
        doc.text(`Issued at: ${data.issuedAt}`, 50, doc.page.height - 40);

        // QR Code as vectors
        const verifyUrl = `${this.configService.get('PUBLIC_WEB_ORIGIN')}/verify/${data.cvid}`;
        const qrData = QRCode.create(verifyUrl, { errorCorrectionLevel: 'M' });
        
        const qrSize = 100;
        const qrX = doc.page.width - 150;
        const qrY = doc.page.height - 150;

        const modSize = qrSize / qrData.modules.size;
        for (let row = 0; row < qrData.modules.size; row++) {
          for (let col = 0; col < qrData.modules.size; col++) {
            if (qrData.modules.get(row, col)) {
              doc.rect(
                qrX + col * modSize,
                qrY + row * modSize,
                modSize,
                modSize
              ).fill('black');
            }
          }
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }
}
