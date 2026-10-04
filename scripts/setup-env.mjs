#!/usr/bin/env node
/**
 * pnpm setup:env
 *
 * Creates .env from .env.example, generating real dev secrets.
 * Never overwrites an existing .env.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync, randomBytes } from 'node:crypto';

const TARGET = '.env';
const EXAMPLE = '.env.example';

if (existsSync(TARGET)) {
  console.log(`✓ ${TARGET} already exists – skipping (delete it first to regenerate).`);
  process.exit(0);
}

if (!existsSync(EXAMPLE)) {
  console.error(`✗ ${EXAMPLE} not found. Run from the repo root.`);
  process.exit(1);
}

// Generate fresh secrets
const jwtSecret = randomBytes(48).toString('hex');
const pepper = randomBytes(24).toString('hex');
const qrSecret = randomBytes(48).toString('hex');
const keyId = `dev-${randomBytes(4).toString('hex')}`;

// Generate Ed25519 key pair
const { privateKey } = generateKeyPairSync('ed25519');
const privPem = privateKey
  .export({ type: 'pkcs8', format: 'pem' })
  .toString()
  .replace(/\n/g, '\\n');

// Read .env.example and substitute placeholders
let content = readFileSync(EXAMPLE, 'utf8');
content = content
  .replace(/^JWT_ACCESS_SECRET=.*/m, `JWT_ACCESS_SECRET=${jwtSecret}`)
  .replace(/^REFRESH_TOKEN_PEPPER=.*/m, `REFRESH_TOKEN_PEPPER=${pepper}`)
  .replace(/^QR_MASTER_SECRET=.*/m, `QR_MASTER_SECRET=${qrSecret}`)
  .replace(/^CERT_SIGNING_PRIVATE_KEY=.*/m, `CERT_SIGNING_PRIVATE_KEY="${privPem}"`)
  .replace(/^CERT_SIGNING_KEY_ID=.*/m, `CERT_SIGNING_KEY_ID=${keyId}`);

writeFileSync(TARGET, content, { mode: 0o600 });
console.log(`✓ Created ${TARGET} with generated dev secrets.`);
console.log(`  JWT_ACCESS_SECRET  : ${jwtSecret.slice(0, 8)}...`);
console.log(`  CERT_SIGNING_KEY_ID: ${keyId}`);
console.log('\nNext: docker compose up -d && pnpm db:migrate && pnpm db:seed');
