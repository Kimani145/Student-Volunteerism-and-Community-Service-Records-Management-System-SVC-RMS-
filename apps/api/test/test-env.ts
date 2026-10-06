import { generateKeyPairSync } from 'crypto';

let runtimeTestEdKey: string | null = null;

export function databaseName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.slice(1));
  } catch {
    return '';
  }
}

export function applyTestEnv(): void {
  (BigInt.prototype as any).toJSON = function () {
    return Number(this);
  };
  process.env.NODE_ENV = 'test';
  const isCI = Boolean(process.env.CI && process.env.CI !== 'false');
  if (!isCI) {
    // Tests wipe tables, so they may ONLY use a database whose name ends in "_test".
    // A dev DATABASE_URL (for example svc_dev) in the shell is ignored; use TEST_DATABASE_URL* to override.
    const pick = (candidate: string | undefined, fallback: string): string =>
      candidate && databaseName(candidate).endsWith('_test') ? candidate : fallback;
    process.env.DATABASE_URL_MIGRATE = pick(
      process.env.TEST_DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL_MIGRATE,
      'postgresql://postgres:postgres@127.0.0.1:5433/svc_test',
    );
    process.env.DATABASE_URL = pick(
      process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
      'postgresql://svc_app:svc_app_secret@127.0.0.1:5433/svc_test',
    );
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
