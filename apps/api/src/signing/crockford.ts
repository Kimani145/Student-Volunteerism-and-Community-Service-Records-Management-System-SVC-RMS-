import { randomBytes } from 'crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateCvid(): string {
  const year = new Date().getFullYear();
  let chars = '';
  // We need 10 characters. Let's just generate random bytes and map to alphabet.
  // 10 chars = 50 bits. We can generate 10 bytes and take modulo 32 for each.
  const bytes = randomBytes(10);
  for (let i = 0; i < 10; i++) {
    chars += ALPHABET[bytes[i] % 32];
  }
  return `TUK-VOL-${year}-${chars}`;
}
