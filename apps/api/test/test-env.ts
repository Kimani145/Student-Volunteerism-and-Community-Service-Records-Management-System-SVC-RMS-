export function applyTestEnv(): void {
  process.env.NODE_ENV = 'test';
  const isCI = Boolean(process.env.CI && process.env.CI !== 'false');
  if (!isCI) {
    process.env.DATABASE_URL_MIGRATE ??= 'postgresql://postgres:postgres@127.0.0.1:5432/svc_test';
    process.env.DATABASE_URL ??= 'postgresql://svc_app:svc_app_secret@127.0.0.1:5432/svc_test';
    process.env.SVC_APP_PASSWORD ??= 'svc_app_secret';
  }
  process.env.JWT_ACCESS_SECRET = '12345678901234567890123456789012';
  process.env.REFRESH_TOKEN_PEPPER = '1234567890123456';
  process.env.QR_MASTER_SECRET = 'abcdefghijklmnopqrstuvwxyz123456';
  process.env.CERT_SIGNING_PRIVATE_KEY = process.env.CERT_SIGNING_PRIVATE_KEY || 'placeholder-private-key';
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
