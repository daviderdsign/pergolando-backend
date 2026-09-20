import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Test, type TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/mail/mail.service.js';

const TEST_DB_PATH = join(
  process.cwd(),
  'test',
  'verification-and-reset.sqlite',
);

describe('Email verification + password reset (e2e)', () => {
  let app: INestApplication;
  let sendVerificationCode: ReturnType<typeof vi.spyOn>;
  let sendPasswordResetCode: ReturnType<typeof vi.spyOn>;

  function lastCodeSentTo(
    spy: ReturnType<typeof vi.spyOn>,
    email: string,
  ): string {
    const call = spy.mock.calls.findLast((c: unknown[]) => c[0] === email);
    if (!call) throw new Error(`No email sent to ${email}`);
    return call[1] as string;
  }

  beforeAll(async () => {
    if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH);

    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
    process.env.BUNDLE_PATH = join(process.cwd(), 'test', 'fixtures', 'bundle');
    process.env.SESSION_COOKIE_SECURE = 'false';
    process.env.EMAIL_VERIFICATION_ENABLED = 'true';
    // SMTP_HOST intentionally unset — MailService would only log, but we
    // spy on it directly to capture the real code without needing a mailbox.

    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      shell: true,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );

    const mail = app.get(MailService);
    sendVerificationCode = vi.spyOn(mail, 'sendVerificationCode');
    sendPasswordResetCode = vi.spyOn(mail, 'sendPasswordResetCode');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH);
  });

  it('blocks login until the email is verified, then allows it', async () => {
    const email = 'verify-me@example.com';
    const password = 'correct horse battery staple';

    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);
    expect(registerRes.body.verificationRequired).toBe(true);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(403)
      .expect((res) => {
        if (res.body.error.code !== 'EMAIL_NOT_VERIFIED')
          throw new Error('wrong error code');
      });

    const code = lastCodeSentTo(sendVerificationCode, email);

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ email, code: '000000' === code ? '111111' : '000000' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ email, code })
      .expect(200, { verified: true });

    // A consumed code can't be reused.
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ email, code })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
  });

  it('cools down repeated resend requests, and the original code still works', async () => {
    const email = 'resend-me@example.com';
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);

    const firstCode = lastCodeSentTo(sendVerificationCode, email);

    // Registration itself just issued a code — an immediate resend request
    // is within the cooldown window and is rejected (this is the intended
    // anti-spam behavior, not a bug: see VERIFICATION_CODE_RESEND_COOLDOWN_MS).
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/resend-verification')
      .send({ email })
      .expect(429);
    expect(res.body.error.code).toBe('VERIFICATION_CODE_COOLDOWN');

    // No second code was issued, so the original one from registration is
    // still the valid one.
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ email, code: firstCode })
      .expect(200, { verified: true });
  });

  it('resets the password via a code and invalidates existing sessions', async () => {
    const email = 'reset-me@example.com';
    const oldPassword = 'correct horse battery staple';
    const newPassword = 'totally different battery staple';

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: oldPassword })
      .expect(201);
    const verifyCode = lastCodeSentTo(sendVerificationCode, email);
    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ email, code: verifyCode })
      .expect(200);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: oldPassword })
      .expect(200);
    const oldCookie = loginRes.headers['set-cookie'];

    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email })
      .expect(200, { sent: true });
    const resetCode = lastCodeSentTo(sendPasswordResetCode, email);

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ email, code: resetCode, newPassword })
      .expect(200, { reset: true });

    // The pre-reset session is gone.
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', oldCookie)
      .expect(401);

    // Old password no longer works, new one does.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: oldPassword })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: newPassword })
      .expect(200);
  });

  it('does not reveal whether an email is registered via forgot-password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'never-registered@example.com' })
      .expect(200, { sent: true });
  });
});
