import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';

@Injectable()
export class CsvService {
  neutralize(value: any): string {
    if (value === null || value === undefined) return '';
    let str = String(value);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return str;
  }

  escapeCsvValue(value: any): string {
    let str = this.neutralize(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  generateCsvStream(headers: string[], data: any[]): Readable {
    let index = 0;
    const self = this;
    const stream = new Readable({
      read() {
        if (index === 0) {
          this.push(headers.map(h => self.escapeCsvValue(h)).join(',') + '\n');
        }
        if (index < data.length) {
          const row = headers.map(h => self.escapeCsvValue(data[index][h]));
          this.push(row.join(',') + '\n');
          index++;
        } else {
          this.push(null);
        }
      }
    });
    return stream;
  }
}
