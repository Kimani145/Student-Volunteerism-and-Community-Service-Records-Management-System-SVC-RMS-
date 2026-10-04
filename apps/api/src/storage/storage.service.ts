import {
  Injectable,
  InternalServerErrorException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { Readable, PassThrough } from 'stream';
import { ErrorCode } from '@svc-rms/shared';

@Injectable()
export class StorageService {
  private readonly uploadDir: string;

  constructor() {
    const root = process.env.STORAGE_ROOT;
    if (!root) throw new Error('STORAGE_ROOT is not configured');
    this.uploadDir = root;
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  getFilePath(key: string): string {
    return path.join(this.uploadDir, key);
  }

  async storeStream(
    fileStream: Readable,
    maxBytes: number
  ): Promise<{ key: string; size: number; sha256: string; mimeType: string; ext: string }> {
    const key = crypto.randomUUID();
    const destPath = path.join(this.uploadDir, key);
    const hash = crypto.createHash('sha256');

    return new Promise((resolve, reject) => {
      const out = fs.createWriteStream(destPath);
      let bytesWritten = 0;
      let checkedMagic = false;
      let firstChunk: Buffer | null = null;
      let detectedType: { ext: string; mime: string } | null = null;
      let finished = false;

      const cleanup = async () => {
        try {
          out.destroy();
          if (fs.existsSync(destPath)) {
            await fs.promises.unlink(destPath);
          }
        } catch {}
      };

      const fail = async (err: any) => {
        if (finished) return;
        finished = true;
        fileStream.destroy();
        await cleanup();
        reject(err);
      };

      fileStream.on('data', async (chunk: Buffer) => {
        if (finished) return;

        bytesWritten += chunk.length;
        if (bytesWritten > maxBytes) {
          return fail(
            new PayloadTooLargeException({
              code: ErrorCode.PAYLOAD_TOO_LARGE,
              detail: 'File exceeds maximum upload size of 10 MB',
            })
          );
        }

        if (!checkedMagic) {
          firstChunk = firstChunk ? Buffer.concat([firstChunk, chunk]) : chunk;

          if (firstChunk.length >= 4100) {
            checkedMagic = true;
            fileStream.pause();
            try {
              const type = await fileTypeFromBuffer(firstChunk);
              if (!type || !['pdf', 'png', 'jpg'].includes(type.ext)) {
                return fail(
                  new UnsupportedMediaTypeException({
                    code: ErrorCode.UNSUPPORTED_MEDIA,
                    detail: 'Unsupported file type: only PDF, PNG and JPEG are allowed',
                  })
                );
              }
              detectedType = type;
              hash.update(firstChunk);
              out.write(firstChunk);
              fileStream.resume();
            } catch (err) {
              return fail(err);
            }
          }
        } else {
          hash.update(chunk);
          if (!out.write(chunk)) {
            fileStream.pause();
            out.once('drain', () => fileStream.resume());
          }
        }
      });

      fileStream.on('end', async () => {
        if (finished) return;

        if (!checkedMagic) {
          checkedMagic = true;
          const buf = firstChunk || Buffer.alloc(0);
          try {
            const type = await fileTypeFromBuffer(buf);
            if (!type || !['pdf', 'png', 'jpg'].includes(type.ext)) {
              return fail(
                new UnsupportedMediaTypeException({
                  code: ErrorCode.UNSUPPORTED_MEDIA,
                  detail: 'Unsupported file type: only PDF, PNG and JPEG are allowed',
                })
              );
            }
            detectedType = type;
            hash.update(buf);
            out.write(buf);
          } catch (err) {
            return fail(err);
          }
        }

        if ((fileStream as any).truncated) {
          return fail(
            new PayloadTooLargeException({
              code: ErrorCode.PAYLOAD_TOO_LARGE,
              detail: 'File exceeds maximum upload size of 10 MB',
            })
          );
        }

        out.end();
      });

      fileStream.on('limit', () => {
        fail(
          new PayloadTooLargeException({
            code: ErrorCode.PAYLOAD_TOO_LARGE,
            detail: 'File exceeds maximum upload size of 10 MB',
          })
        );
      });

      fileStream.on('error', (err: any) => {
        if (err?.code === 'FST_REQ_FILE_TOO_LARGE') {
          fail(
            new PayloadTooLargeException({
              code: ErrorCode.PAYLOAD_TOO_LARGE,
              detail: 'File exceeds maximum upload size of 10 MB',
            })
          );
        } else {
          fail(new InternalServerErrorException('File streaming failed'));
        }
      });

      out.on('finish', () => {
        if (finished) return;
        finished = true;
        resolve({
          key,
          size: bytesWritten,
          sha256: hash.digest('hex'),
          mimeType: detectedType ? detectedType.mime : 'application/octet-stream',
          ext: detectedType ? detectedType.ext : '',
        });
      });

      out.on('error', (err) => {
        fail(new InternalServerErrorException('File storage failed'));
      });
    });
  }

  async storeFile(file: { buffer: Buffer; size: number }): Promise<{ key: string; size: number; sha256: string }> {
    const key = crypto.randomUUID();
    const destPath = path.join(this.uploadDir, key);

    const hash = crypto.createHash('sha256');
    const bufferStream = new PassThrough();
    bufferStream.end(file.buffer);

    return new Promise((resolve, reject) => {
      const out = fs.createWriteStream(destPath);
      bufferStream.pipe(hash).pipe(new PassThrough());
      bufferStream.pipe(out);
      out.on('finish', () => {
        resolve({
          key,
          size: file.size,
          sha256: hash.digest('hex'),
        });
      });
      out.on('error', () => {
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
