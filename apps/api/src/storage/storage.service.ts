import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { pipeline } from 'stream';

const pipelineAsync = promisify(pipeline);

@Injectable()
export class StorageService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async storeFile(file: { buffer: Buffer; size: number }): Promise<{ key: string; size: number; sha256: string }> {
    const key = crypto.randomUUID();
    const destPath = path.join(this.uploadDir, key);

    const hash = crypto.createHash('sha256');
    // Using a readable stream from buffer
    const stream = require('stream');
    const bufferStream = new stream.PassThrough();
    bufferStream.end(file.buffer);
    
    return new Promise((resolve, reject) => {
      const out = fs.createWriteStream(destPath);
      bufferStream.pipe(hash).pipe(new stream.PassThrough());
      bufferStream.pipe(out);
      out.on('finish', () => {
        resolve({
          key,
          size: file.size,
          sha256: hash.digest('hex'),
        });
      });
      out.on('error', (err) => {
        reject(new InternalServerErrorException('File storage failed'));
      });
    });
  }

  async getFile(key: string): Promise<Buffer> {
    const destPath = path.join(this.uploadDir, key);
    if (!fs.existsSync(destPath)) {
      throw new Error('File not found');
    }
    return fs.promises.readFile(destPath);
  }

  async removeFile(key: string): Promise<void> {
    const destPath = path.join(this.uploadDir, key);
    if (fs.existsSync(destPath)) {
      await fs.promises.unlink(destPath);
    }
  }
}
