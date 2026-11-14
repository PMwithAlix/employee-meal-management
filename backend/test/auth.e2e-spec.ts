import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { AuthModule } from '../src/modules/auth/auth.module';
import { PasswordService } from '../src/modules/auth/password.service';
import { hashSessionToken } from '../src/modules/auth/security/session-token';
import { Roles } from '../src/common/decorators/roles.decorator';
import { AuthGuard } from '../src/common/guards/auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { EnvironmentVariables } from '../src/config/env.validation';

@Controller('rbac-probe')
@UseGuards(AuthGuard, RolesGuard)
class RbacProbeController {
  @Get('any')
  any() {
    return { ok: true };
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  admin() {
    return { ok: true };
  }
}

@Module({
  imports: [AppModule, AuthModule],
  controllers: [RbacProbeController],
})
class E2eAuthModule {}

const prisma = new PrismaClient();
const password = 'Kavosh-1405';
const usernames = {
  employee: 'e2e.auth.employee',
  admin: 'e2e.auth.admin',
  inactive: 'e2e.auth.inactive',
};

function cookieHeader(response: request.Response) {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((item) => item.startsWith('khaan.sid='));
}

function rawToken(setCookie: string) {
  return decodeURIComponent(setCookie.split(';')[0].slice('khaan.sid='.length));
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let buildingId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [E2eAuthModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get(ConfigService<EnvironmentVariables, true>));
    await app.init();

    await prisma.session.deleteMany({
      where: { user: { username: { startsWith: 'e2e.auth.' } } },
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'e2e.auth.' } },
    });
    await prisma.building.deleteMany({
      where: { name: 'e2e-auth-building' },
    });

    const passwords = app.get(PasswordService);
    const hash = await passwords.hash(password);
    const building = await prisma.building.create({
      data: { name: 'e2e-auth-building' },
    });
    buildingId = building.id;
    await prisma.user.createMany({
      data: [
        {
          username: usernames.employee,
          passwordHash: hash,
          role: Role.EMPLOYEE,
          buildingId,
          isActive: true,
        },
        {
          username: usernames.admin,
          passwordHash: hash,
          role: Role.ADMIN,
          isActive: true,
        },
        {
          username: usernames.inactive,
          passwordHash: hash,
          role: Role.EMPLOYEE,
          buildingId,
          isActive: false,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({
      where: { user: { username: { startsWith: 'e2e.auth.' } } },
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'e2e.auth.' } },
    });
    if (buildingId) {
      await prisma.building.deleteMany({ where: { id: buildingId } });
    }
    await app.close();
    await prisma.$disconnect();
  });

  async function login(username: string, pass = password) {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password: pass });
  }

  it('logs in, sets an HttpOnly cookie, and never stores the raw token', async () => {
    const response = await login(usernames.employee);
    expect(response.status).toBe(200);
    expect(response.body.username).toBe(usernames.employee);
    expect(response.body.passwordHash).toBeUndefined();
    const setCookie = cookieHeader(response);
    expect(setCookie).toBeDefined();
    expect(setCookie).toMatch(/HttpOnly/i);
    const token = rawToken(setCookie!);
    const stored = await prisma.session.findMany({
      where: { user: { username: usernames.employee } },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).toBe(hashSessionToken(token));
    expect(stored[0].tokenHash).not.toBe(token);
  });

  it('normalizes username case and surrounding spaces', async () => {
    const response = await login('  E2E.AUTH.EMPLOYEE  ');
    expect(response.status).toBe(200);
    expect(response.body.username).toBe(usernames.employee);
  });

  it('returns the same 401 for unknown usernames and wrong passwords', async () => {
    const missing = await login('e2e.auth.missing');
    const wrong = await login(usernames.employee, 'Wrongpass1');
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(missing.body.message).toEqual(wrong.body.message);
  });

  it('rejects inactive users', async () => {
    const response = await login(usernames.inactive);
    expect(response.status).toBe(403);
  });

  it('returns 401 without a cookie and 200 for /me with a valid session', async () => {
    expect(
      (await request(app.getHttpServer()).get('/api/v1/auth/me')).status,
    ).toBe(401);
    const loginResponse = await login(usernames.employee);
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookieHeader(loginResponse)!);
    expect(me.status).toBe(200);
    expect(me.body.username).toBe(usernames.employee);
    expect(me.body.role).toBe(Role.EMPLOYEE);
    expect(me.body.passwordHash).toBeUndefined();
  });

  it('rejects an expired session', async () => {
    const loginResponse = await login(usernames.employee);
    const token = rawToken(cookieHeader(loginResponse)!);
    await prisma.session.updateMany({
      where: { tokenHash: hashSessionToken(token) },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookieHeader(loginResponse)!);
    expect(me.status).toBe(401);
  });

  it('rejects a revoked session after logout', async () => {
    const loginResponse = await login(usernames.employee);
    const cookie = cookieHeader(loginResponse)!;
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/logout')
          .set('Cookie', cookie)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Cookie', cookie)
      ).status,
    ).toBe(401);
  });

  it('logout-all revokes every session for the user', async () => {
    const first = await login(usernames.employee);
    const second = await login(usernames.employee);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout-all')
      .set('Cookie', cookieHeader(first)!);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Cookie', cookieHeader(second)!)
      ).status,
    ).toBe(401);
  });

  it('rejects inactive users even with a leftover session row', async () => {
    const loginResponse = await login(usernames.employee);
    await prisma.user.update({
      where: { username: usernames.employee },
      data: { isActive: false },
    });
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookieHeader(loginResponse)!);
    expect(me.status).toBe(401);
    await prisma.user.update({
      where: { username: usernames.employee },
      data: { isActive: true },
    });
  });

  it('changes password, revokes sessions, and rejects the old password', async () => {
    const loginResponse = await login(usernames.employee);
    const cookie = cookieHeader(loginResponse)!;
    const changed = await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Cookie', cookie)
      .send({
        currentPassword: password,
        newPassword: 'Newpass12',
        confirmNewPassword: 'Newpass12',
      });
    expect(changed.status).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Cookie', cookie)
      ).status,
    ).toBe(401);
    expect((await login(usernames.employee, password)).status).toBe(401);
    expect((await login(usernames.employee, 'Newpass12')).status).toBe(200);

    const authed = await login(usernames.employee, 'Newpass12');
    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Cookie', cookieHeader(authed)!)
      .send({
        currentPassword: 'Newpass12',
        newPassword: password,
        confirmNewPassword: password,
      });
  });

  it('rejects a wrong current password and a policy-invalid new password', async () => {
    const loginResponse = await login(usernames.employee);
    const cookie = cookieHeader(loginResponse)!;
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/change-password')
          .set('Cookie', cookie)
          .send({
            currentPassword: 'Nope1234',
            newPassword: 'Newpass12',
            confirmNewPassword: 'Newpass12',
          })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/change-password')
          .set('Cookie', cookie)
          .send({
            currentPassword: password,
            newPassword: 'short',
            confirmNewPassword: 'short',
          })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/change-password')
          .set('Cookie', cookie)
          .send({
            currentPassword: password,
            newPassword: 'Newpass12',
            confirmNewPassword: 'Other12a',
          })
      ).status,
    ).toBe(422);
  });

  it('enforces RBAC from the database role, not a client header', async () => {
    const employee = await login(usernames.employee);
    const admin = await login(usernames.admin);
    const employeeCookie = cookieHeader(employee)!;
    const adminCookie = cookieHeader(admin)!;

    expect(
      (await request(app.getHttpServer()).get('/api/v1/rbac-probe/any')).status,
    ).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/rbac-probe/any')
          .set('Cookie', employeeCookie)
          .set('x-role', 'ADMIN')
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/rbac-probe/admin')
          .set('Cookie', employeeCookie)
          .set('x-role', 'ADMIN')
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/rbac-probe/admin')
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(200);
  });
});
