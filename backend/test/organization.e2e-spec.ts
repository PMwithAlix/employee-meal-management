import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaClient, Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PasswordService } from '../src/auth/password.service';
import { EnvironmentVariables } from '../src/config/env.validation';

const prisma = new PrismaClient();
const password = 'Kavosh-1405';

function cookieHeader(response: request.Response) {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((item) => item.startsWith('khaan.sid=')) ?? '';
}

async function cleanupOrgFixtures() {
  await prisma.notification.deleteMany({
    where: { user: { username: { startsWith: 'e2e.org.' } } },
  });
  await prisma.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER ALL');
  try {
    await prisma.auditLog.deleteMany({
      where: { actor: { username: { startsWith: 'e2e.org.' } } },
    });
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER ALL');
  }
  await prisma.session.deleteMany({
    where: { user: { username: { startsWith: 'e2e.org.' } } },
  });
  await prisma.groupMembership.deleteMany({
    where: { user: { username: { startsWith: 'e2e.org.' } } },
  });
  await prisma.user.deleteMany({
    where: { username: { startsWith: 'e2e.org.' } },
  });
  await prisma.group.deleteMany({
    where: { name: { startsWith: 'گروه آزمایشی' } },
  });
  await prisma.building.deleteMany({
    where: { name: { startsWith: 'e2e-org-' } },
  });
}

describe('Organization (e2e)', () => {
  let app: INestApplication<App>;
  let adminCookie = '';
  let hrCookie = '';
  let employeeCookie = '';
  let buildingId = '';
  let otherBuildingId = '';
  let employeeId = '';
  let adminId = '';
  let groupId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get(ConfigService<EnvironmentVariables, true>));
    await app.init();
    await cleanupOrgFixtures();

    const passwords = app.get(PasswordService);
    const hash = await passwords.hash(password);
    const building = await prisma.building.create({
      data: { name: 'e2e-org-main' },
    });
    buildingId = building.id;
    const admin = await prisma.user.create({
      data: {
        username: 'e2e.org.admin',
        passwordHash: hash,
        role: Role.ADMIN,
      },
    });
    adminId = admin.id;
    await prisma.user.create({
      data: {
        username: 'e2e.org.hr',
        passwordHash: hash,
        role: Role.HR,
        buildingId,
      },
    });
    await prisma.user.create({
      data: {
        username: 'e2e.org.employee',
        passwordHash: hash,
        role: Role.EMPLOYEE,
        buildingId,
      },
    });
    await prisma.user.create({
      data: {
        username: 'e2e.org.support',
        passwordHash: hash,
        role: Role.SUPPORT,
        buildingId,
      },
    });
    await prisma.user.create({
      data: {
        username: 'e2e.org.management',
        passwordHash: hash,
        role: Role.MANAGEMENT,
        buildingId,
      },
    });

    const login = async (username: string) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username, password });

    adminCookie = cookieHeader(await login('e2e.org.admin'));
    hrCookie = cookieHeader(await login('e2e.org.hr'));
    employeeCookie = cookieHeader(await login('e2e.org.employee'));
    const supportCookie = cookieHeader(await login('e2e.org.support'));
    const managementCookie = cookieHeader(await login('e2e.org.management'));
    for (const cookie of [employeeCookie, supportCookie, managementCookie]) {
      expect(
        (
          await request(app.getHttpServer())
            .get('/api/v1/users')
            .set('Cookie', cookie)
        ).status,
      ).toBe(403);
    }
  });

  afterAll(async () => {
    await cleanupOrgFixtures();
    await app.close();
    await prisma.$disconnect();
  });

  it('creates buildings, including duplicate names, and rejects employee access', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/buildings')
      .set('Cookie', adminCookie)
      .send({ name: 'e2e-org-dup' });
    const dup = await request(app.getHttpServer())
      .post('/api/v1/buildings')
      .set('Cookie', adminCookie)
      .send({ name: 'e2e-org-dup' });
    expect(created.status).toBe(201);
    expect(dup.status).toBe(201);
    otherBuildingId = created.body.id as string;
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/buildings')
          .set('Cookie', employeeCookie)
          .send({ name: 'nope' })
      ).status,
    ).toBe(403);
    const renamed = await request(app.getHttpServer())
      .patch(`/api/v1/buildings/${otherBuildingId}`)
      .set('Cookie', hrCookie)
      .send({ name: 'e2e-org-other' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('e2e-org-other');
    expect(
      (
        await request(app.getHttpServer()).delete(
          `/api/v1/buildings/${buildingId}`,
        )
      ).status,
    ).toBe(404);
  });

  it('creates users with normalized unique usernames and role/building rules', async () => {
    const employee = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Cookie', hrCookie)
      .send({
        username: '  E2E.ORG.CREATED  ',
        password,
        role: Role.EMPLOYEE,
        buildingId,
      });
    expect(employee.status).toBe(201);
    expect(employee.body.username).toBe('e2e.org.created');
    expect(employee.body.passwordHash).toBeUndefined();
    employeeId = employee.body.id as string;

    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/users')
          .set('Cookie', hrCookie)
          .send({
            username: 'e2e.org.created',
            password,
            role: Role.EMPLOYEE,
            buildingId,
          })
      ).status,
    ).toBe(409);

    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/users')
          .set('Cookie', hrCookie)
          .send({
            username: 'e2e.org.nobuilding',
            password,
            role: Role.EMPLOYEE,
          })
      ).status,
    ).toBe(422);

    const adminUser = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Cookie', adminCookie)
      .send({
        username: 'e2e.org.admin2',
        password,
        role: Role.ADMIN,
      });
    expect(adminUser.status).toBe(201);
    expect(adminUser.body.buildingId).toBeNull();

    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/users')
          .set('Cookie', hrCookie)
          .send({
            username: 'e2e.org.fakeadmin',
            password,
            role: Role.ADMIN,
          })
      ).status,
    ).toBe(403);

    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/users')
          .set('Cookie', hrCookie)
          .send({
            username: 'e2e.org.badrole',
            password,
            role: 'OWNER',
            buildingId,
          })
      ).status,
    ).toBe(400);
  });

  it('lists, filters, and refuses username changes', async () => {
    const listed = await request(app.getHttpServer())
      .get('/api/v1/users')
      .query({ username: 'e2e.org.created', role: Role.EMPLOYEE })
      .set('Cookie', adminCookie);
    expect(listed.status).toBe(200);
    expect(listed.body.total).toBeGreaterThanOrEqual(1);
    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/users/${employeeId}`)
      .set('Cookie', adminCookie)
      .send({ username: 'hacked' });
    expect(patched.status).toBe(400);
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/users/${employeeId}`)
      .set('Cookie', adminCookie);
    expect(detail.body.username).toBe('e2e.org.created');
  });

  it('updates role and building, then revokes sessions', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'e2e.org.created', password });
    const cookie = cookieHeader(login);
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/users/${employeeId}`)
      .set('Cookie', adminCookie)
      .send({ role: Role.SUPPORT, buildingId: otherBuildingId });
    expect(updated.status).toBe(200);
    expect(updated.body.role).toBe(Role.SUPPORT);
    expect(updated.body.buildingId).toBe(otherBuildingId);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Cookie', cookie)
      ).status,
    ).toBe(401);
  });

  it('deactivates without deleting, blocks login, then reactivates', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'e2e.org.created', password });
    const cookie = cookieHeader(login);
    const deactivated = await request(app.getHttpServer())
      .post(`/api/v1/users/${employeeId}/deactivate`)
      .set('Cookie', hrCookie);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.isActive).toBe(false);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Cookie', cookie)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ username: 'e2e.org.created', password })
      ).status,
    ).toBe(403);
    expect(
      (await prisma.user.findUnique({ where: { id: employeeId } }))?.username,
    ).toBe('e2e.org.created');
    const reactivated = await request(app.getHttpServer())
      .post(`/api/v1/users/${employeeId}/reactivate`)
      .set('Cookie', adminCookie);
    expect(reactivated.body.isActive).toBe(true);
  });

  it('resets passwords, notifies, audits without secrets, and blocks HR on ADMIN', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/v1/users/${adminId}/reset-password`)
          .set('Cookie', hrCookie)
          .send({ newPassword: 'Newpass12' })
      ).status,
    ).toBe(403);

    const reset = await request(app.getHttpServer())
      .post(`/api/v1/users/${employeeId}/reset-password`)
      .set('Cookie', hrCookie)
      .send({ newPassword: 'Newpass12' });
    expect(reset.status).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ username: 'e2e.org.created', password })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ username: 'e2e.org.created', password: 'Newpass12' })
      ).status,
    ).toBe(200);
    const notes = await prisma.notification.findMany({
      where: { userId: employeeId },
    });
    expect(notes.length).toBeGreaterThan(0);
    expect(JSON.stringify(notes)).not.toContain('Newpass12');
    const audits = await prisma.auditLog.findMany({
      where: { entityId: employeeId, action: 'PASSWORD_RESET' },
    });
    expect(audits[0]?.actorId).toBeDefined();
    expect(JSON.stringify(audits)).not.toContain('Newpass12');
    expect(JSON.stringify(audits)).not.toContain('passwordHash');
  });

  it('manages groups and membership history across buildings', async () => {
    const group = await request(app.getHttpServer())
      .post('/api/v1/groups')
      .set('Cookie', adminCookie)
      .send({ name: 'گروه آزمایشی یک' });
    expect(group.status).toBe(201);
    groupId = group.body.id as string;
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/groups')
          .set('Cookie', hrCookie)
          .send({ name: 'گروه آزمایشی یک' })
      ).status,
    ).toBe(409);

    const renamed = await request(app.getHttpServer())
      .patch(`/api/v1/groups/${groupId}`)
      .set('Cookie', hrCookie)
      .send({ name: 'گروه آزمایشی دو' });
    expect(renamed.body.name).toBe('گروه آزمایشی دو');

    const hrUser = await prisma.user.findUniqueOrThrow({
      where: { username: 'e2e.org.hr' },
    });
    const added = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Cookie', adminCookie)
      .send({ userId: employeeId });
    const addedHr = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Cookie', adminCookie)
      .send({ userId: hrUser.id });
    expect(added.status).toBe(201);
    expect(addedHr.status).toBe(201);
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/v1/groups/${groupId}/members`)
          .set('Cookie', adminCookie)
          .send({ userId: employeeId })
      ).status,
    ).toBe(409);

    await request(app.getHttpServer())
      .delete(`/api/v1/groups/${groupId}/members/${employeeId}`)
      .set('Cookie', adminCookie);
    const readded = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/members`)
      .set('Cookie', adminCookie)
      .send({ userId: employeeId });
    expect(readded.status).toBe(201);
    const history = await request(app.getHttpServer())
      .get(`/api/v1/groups/${groupId}/memberships/history`)
      .set('Cookie', adminCookie);
    expect(history.body.length).toBeGreaterThanOrEqual(3);

    await prisma.user.update({
      where: { id: employeeId },
      data: { isActive: false },
    });
    expect(
      (
        await request(app.getHttpServer())
          .delete(`/api/v1/groups/${groupId}/members/${employeeId}`)
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/v1/groups/${groupId}/members`)
          .set('Cookie', adminCookie)
          .send({ userId: employeeId })
      ).status,
    ).toBe(422);
    await prisma.user.update({
      where: { id: employeeId },
      data: { isActive: true },
    });

    const deactivated = await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupId}/deactivate`)
      .set('Cookie', adminCookie);
    expect(deactivated.body.isActive).toBe(false);
    const after = await request(app.getHttpServer())
      .get(`/api/v1/groups/${groupId}/memberships/history`)
      .set('Cookie', adminCookie);
    expect(after.body.length).toBeGreaterThanOrEqual(3);
    expect(
      after.body.every((row: { endedAt: string | null }) => row.endedAt),
    ).toBe(true);
  });
});
