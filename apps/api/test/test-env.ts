import { generateKeyPairSync } from 'crypto';

let runtimeTestEdKey: string | null = null;

export function databaseName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.slice(1));
  } catch {
    return '';
  }
}

export const DEFAULT_TEST_OWNER_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/svc_test';
export const DEFAULT_TEST_APP_URL = 'postgresql://svc_app:svc_app_secret@127.0.0.1:5433/svc_test';

// Tests wipe tables, so they may ONLY use a database whose name ends in "_test". A dev URL
// (for example svc_dev) in the shell or .env is skipped; set TEST_DATABASE_URL* to point at your test database.
function firstTestUrl(candidates: Array<string | undefined>, fallback: string): string {
  for (const candidate of candidates) {
    if (candidate && databaseName(candidate).endsWith('_test')) return candidate;
  }
  return fallback;
}

export function resolveTestOwnerUrl(env: NodeJS.ProcessEnv = process.env): string {
  return firstTestUrl([env.TEST_DATABASE_URL_MIGRATE, env.DATABASE_URL_MIGRATE], DEFAULT_TEST_OWNER_URL);
}

export function resolveTestAppUrl(env: NodeJS.ProcessEnv = process.env): string {
  return firstTestUrl([env.TEST_DATABASE_URL, env.DATABASE_URL], DEFAULT_TEST_APP_URL);
}

export function applyTestEnv(): void {
  (BigInt.prototype as any).toJSON = function () {
    return Number(this);
  };
  process.env.NODE_ENV = 'test';
  const isCI = Boolean(process.env.CI && process.env.CI !== 'false');
  if (!isCI) {
    process.env.DATABASE_URL_MIGRATE = resolveTestOwnerUrl();
    process.env.DATABASE_URL = resolveTestAppUrl();
    process.env.SVC_APP_PASSWORD ??= 'svc_app_secret';
  }
  process.env.JWT_ACCESS_SECRET = '12345678901234567890123456789012';
  process.env.REFRESH_TOKEN_PEPPER = '1234567890123456';
  process.env.QR_MASTER_SECRET = 'abcdefghijklmnopqrstuvwxyz123456';
  if (!runtimeTestEdKey) {
    const { privateKey } = generateKeyPairSync('ed25519');
    runtimeTestEdKey = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  }
  process.env.CERT_SIGNING_PRIVATE_KEY = runtimeTestEdKey;
  process.env.CERT_SIGNING_KEY_ID = 'key-1';
  process.env.PUBLIC_WEB_ORIGIN = 'http://localhost:3000';
  process.env.ALLOWED_STUDENT_EMAIL_DOMAINS = 'example.test';
  process.env.SMTP_URL = 'smtp://localhost:1025';
  process.env.MAIL_FROM = 'noreply@example.test';
  process.env.STORAGE_ROOT = '/tmp/svc-rms-storage';
  process.env.MAX_UPLOAD_BYTES = '10485760';
  process.env.ISSUER_NAME = 'SVC-RMS';
  process.env.SIGNATORY_1_NAME = 'Signatory One';
  process.env.SIGNATORY_1_TITLE = 'Title One';
  process.env.SIGNATORY_2_NAME = 'Signatory Two';
  process.env.SIGNATORY_2_TITLE = 'Title Two';
  process.env.LOG_LEVEL = 'info';
}
