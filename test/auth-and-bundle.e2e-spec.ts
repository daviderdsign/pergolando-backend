import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Test, type TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

const TEST_DB_PATH = join(process.cwd(), 'test', 'e2e.sqlite');

describe('Auth + bundle (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH);

    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
    process.env.BUNDLE_PATH = join(process.cwd(), 'test', 'fixtures', 'bundle');
    process.env.SESSION_COOKIE_SECURE = 'false';
    // This suite predates email verification and exercises the base
    // auth+bundle flow — see verification-and-reset.e2e-spec.ts for the
    // EMAIL_VERIFICATION_ENABLED=true flow.
    process.env.EMAIL_VERIFICATION_ENABLED = 'false';

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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (existsSync(TEST_DB_PATH)) rmSync(TEST_DB_PATH);
  });

  it('GET /api/v1/health returns ok', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200, { status: 'ok' });
  });

  it('rejects /api/v1/catalog without a session', async () => {
    await request(app.getHttpServer()).get('/api/v1/catalog').expect(401);
  });

  it('registers, logs in, reads the catalog, and logs out', async () => {
    const email = 'venditore@example.com';
    const password = 'correct horse battery staple';

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201)
      .expect((res) => {
        if (res.body.seller.email !== email)
          throw new Error('unexpected seller in response');
      });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const cookie = loginRes.headers['set-cookie'];
    expect(cookie).toBeDefined();

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(meRes.body.seller.email).toBe(email);

    const catalogRes = await request(app.getHttpServer())
      .get('/api/v1/catalog')
      .set('Cookie', cookie)
      .expect(200);
    expect(catalogRes.body.catalog.prodotto.nome).toBe('Brera');
    expect(Object.keys(catalogRes.body.catalog.sotto_modelli)).toEqual(
      expect.arrayContaining(['P', 'S']),
    );

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('rejects login with the wrong password without revealing which field was wrong', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'other@example.com',
        password: 'correct horse battery staple',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'other@example.com', password: 'wrong password entirely' })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('locks the account after repeated failed logins', async () => {
    const email = 'lockout@example.com';
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong' })
        .expect(401);
    }

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'correct horse battery staple' })
      .expect(429);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});
