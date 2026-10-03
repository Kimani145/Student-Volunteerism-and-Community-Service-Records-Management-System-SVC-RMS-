import { createHmac, timingSafeEqual } from 'crypto';

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function encodeBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | (buffer[i] ?? 0);
    bits += 8;
    while (bits >= 5) {
      output += CROCKFORD_ALPHABET[(value >>> (bits - 5)) & 31] ?? '';
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += CROCKFORD_ALPHABET[(value << (5 - bits)) & 31] ?? '';
  }
  return output;
}

export function generateToken(
  masterSecret: string,
  activityId: string,
  unixMs: number
): { token: string; validUntil: number } {
  const kA = createHmac('sha256', masterSecret)
    .update(`checkin:${activityId}`)
    .digest();
  
  const window = Math.floor(unixMs / 30000);
  const windowBuffer = Buffer.alloc(8);
  windowBuffer.writeBigInt64BE(BigInt(window));

  const hash = createHmac('sha256', kA).update(windowBuffer).digest();
  const token = encodeBase32(hash).substring(0, 10);
  
  return { token, validUntil: (window + 1) * 30000 };
}

export function verifyToken(
  masterSecret: string,
  activityId: string,
  tokenToVerify: string,
  unixMs: number
): { isValid: boolean; reason?: 'TOKEN_INVALID' } {
  const currentWindow = Math.floor(unixMs / 30000);
  
  const kA = createHmac('sha256', masterSecret)
    .update(`checkin:${activityId}`)
    .digest();

  const currentWindowBuffer = Buffer.alloc(8);
  currentWindowBuffer.writeBigInt64BE(BigInt(currentWindow));
  const currentHash = createHmac('sha256', kA).update(currentWindowBuffer).digest();
  const currentExpected = encodeBase32(currentHash).substring(0, 10);

  const prevWindowBuffer = Buffer.alloc(8);
  prevWindowBuffer.writeBigInt64BE(BigInt(currentWindow - 1));
  const prevHash = createHmac('sha256', kA).update(prevWindowBuffer).digest();
  const prevExpected = encodeBase32(prevHash).substring(0, 10);

  // Use fixed length buffer to avoid timing leak on length
  if (tokenToVerify.length !== 10) {
     return { isValid: false, reason: 'TOKEN_INVALID' };
  }
  const tokenBuffer = Buffer.from(tokenToVerify);
  const currentBuffer = Buffer.from(currentExpected);
  const prevBuffer = Buffer.from(prevExpected);

  let isCurrent = false;
  let isPrev = false;

  try {
    isCurrent = timingSafeEqual(tokenBuffer, currentBuffer);
  } catch {
    isCurrent = false;
  }

  try {
    isPrev = timingSafeEqual(tokenBuffer, prevBuffer);
  } catch {
    isPrev = false;
  }

  if (isCurrent || isPrev) {
    return { isValid: true };
  }

  return { isValid: false, reason: 'TOKEN_INVALID' };
}
