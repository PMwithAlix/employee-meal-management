import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { MealType, PrismaClient, Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PasswordService } from '../src/modules/auth/password.service';
import { EnvironmentVariables } from '../src/config/env.validation';
import {
  formatDateOnly,
  jalaliToGregorian,
  utcDateFromGregorian,
} from '../src/common/calendar/jalali';
import { buildMenuWorkbook } from '../src/modules/menus/import/menu-workbook.builder';
import { ImportPolicy } from '../src/modules/menus/menu.types';

const prisma = new PrismaClient();
const password = 'Kavosh-1405';

function cookieHeader(response: request.Response) {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((item) => item.startsWith('khaan.sid=')) ?? '';
}

function mealDate(day: number) {
  return formatDateOnly(utcDateFromGregorian(jalaliToGregorian(1411, 1, day)!));
}

async function cleanupMenuFixtures() {
  await prisma.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER ALL');
  await prisma.$executeRawUnsafe('ALTER TABLE menu_items DISABLE TRIGGER ALL');
  await prisma.$executeRawUnsafe(
    'ALTER TABLE order_cycles DISABLE TRIGGER ALL',
  );
  try {
    await prisma.orderStatusHistory.deleteMany({
      where: { actor: { username: { startsWith: 'e2e.menu.' } } },
    });
    await prisma.orderCycle.deleteMany({
      where: { order: { user: { username: { startsWith: 'e2e.menu.' } } } },
    });
    await prisma.order.deleteMany({
      where: { user: { username: { startsWith: 'e2e.menu.' } } },
    });
    await prisma.auditLog.deleteMany({
      where: { actor: { username: { startsWith: 'e2e.menu.' } } },
    });
    await prisma.session.deleteMany({
      where: { user: { username: { startsWith: 'e2e.menu.' } } },
    });
    await prisma.notification.deleteMany({
      where: { user: { username: { startsWith: 'e2e.menu.' } } },
    });
    await prisma.menuItem.deleteMany({
      where: {
        menuVersion: {
          createdByUser: { username: { startsWith: 'e2e.menu.' } },
        },
      },
    });
    await prisma.menu.updateMany({
      where: { year: { in: [1411, 1412] } },
      data: { publishedVersionId: null },
    });
    await prisma.menuVersion.deleteMany({
      where: { createdByUser: { username: { startsWith: 'e2e.menu.' } } },
    });
    await prisma.menu.deleteMany({
      where: { year: { in: [1411, 1412] } },
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'e2e.menu.' } },
    });
    await prisma.building.deleteMany({
      where: { name: { startsWith: 'e2e-menu-' } },
    });
  } finally {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE order_cycles ENABLE TRIGGER ALL',
    );
    await prisma.$executeRawUnsafe('ALTER TABLE menu_items ENABLE TRIGGER ALL');
    await prisma.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER ALL');
  }
}

describe('Menus (e2e)', () => {
  let app: INestApplication<App>;
  let adminCookie = '';
  let supportCookie = '';
  let hrCookie = '';
  let employeeCookie = '';
  let managementCookie = '';
  let adminId = '';
  let menuId = '';
  let draftId = '';
  let publishedId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get(ConfigService<EnvironmentVariables, true>));
    await app.init();
    await cleanupMenuFixtures();

    const passwords = app.get(PasswordService);
    const hash = await passwords.hash(password);
    const building = await prisma.building.create({
      data: { name: 'e2e-menu-main' },
    });
    const admin = await prisma.user.create({
      data: {
        username: 'e2e.menu.admin',
        passwordHash: hash,
        role: Role.ADMIN,
      },
    });
    adminId = admin.id;
    await prisma.user.createMany({
      data: [
        {
          username: 'e2e.menu.support',
          passwordHash: hash,
          role: Role.SUPPORT,
          buildingId: building.id,
        },
        {
          username: 'e2e.menu.hr',
          passwordHash: hash,
          role: Role.HR,
          buildingId: building.id,
        },
        {
          username: 'e2e.menu.employee',
          passwordHash: hash,
          role: Role.EMPLOYEE,
          buildingId: building.id,
        },
        {
          username: 'e2e.menu.management',
          passwordHash: hash,
          role: Role.MANAGEMENT,
          buildingId: building.id,
        },
      ],
    });

    const login = (username: string) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username, password });
    adminCookie = cookieHeader(await login('e2e.menu.admin'));
    supportCookie = cookieHeader(await login('e2e.menu.support'));
    hrCookie = cookieHeader(await login('e2e.menu.hr'));
    employeeCookie = cookieHeader(await login('e2e.menu.employee'));
    managementCookie = cookieHeader(await login('e2e.menu.management'));
  });

  afterAll(async () => {
    await cleanupMenuFixtures();
    await app.close();
    await prisma.$disconnect();
  });

  it('enforces menu RBAC', async () => {
    for (const cookie of [hrCookie, employeeCookie, managementCookie]) {
      expect(
        (
          await request(app.getHttpServer())
            .get('/api/v1/menus')
            .set('Cookie', cookie)
        ).status,
      ).toBe(403);
    }
  });

  it('creates a monthly menu, draft, meals, and published version', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/menus')
          .set('Cookie', adminCookie)
          .send({ year: 1411, month: 13 })
      ).status,
    ).toBe(400);

    const created = await request(app.getHttpServer())
      .post('/api/v1/menus')
      .set('Cookie', supportCookie)
      .send({ year: 1411, month: 1 });
    expect(created.status).toBe(201);
    menuId = created.body.id as string;

    const draft = await request(app.getHttpServer())
      .post(`/api/v1/menus/${menuId}/versions`)
      .set('Cookie', adminCookie)
      .send({});
    expect(draft.status).toBe(201);
    draftId = draft.body.id as string;

    const lunch = await request(app.getHttpServer())
      .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
      .set('Cookie', adminCookie)
      .send({
        mealDate: mealDate(1),
        mealType: MealType.LUNCH,
        options: [
          { title: 'چلوکباب', displayOrder: 1 },
          { title: 'قورمه', displayOrder: 2 },
          { title: 'ماکارونی', displayOrder: 3 },
        ],
      });
    const dinner = await request(app.getHttpServer())
      .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
      .set('Cookie', adminCookie)
      .send({
        mealDate: mealDate(1),
        mealType: MealType.DINNER,
        options: [{ title: 'سوپ', displayOrder: 1 }],
      });
    expect(lunch.status).toBe(200);
    expect(dinner.status).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
          .set('Cookie', adminCookie)
          .send({
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            options: [
              { title: '۱', displayOrder: 1 },
              { title: '۲', displayOrder: 2 },
              { title: '۳', displayOrder: 3 },
              { title: '۴', displayOrder: 4 },
            ],
          })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app.getHttpServer())
          .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
          .set('Cookie', adminCookie)
          .send({
            mealDate: '2026-01-01',
            mealType: MealType.LUNCH,
            options: [{ title: 'خارج از ماه', displayOrder: 1 }],
          })
      ).status,
    ).toBe(422);

    const published = await request(app.getHttpServer())
      .post(`/api/v1/menus/${menuId}/versions/${draftId}/publish`)
      .set('Cookie', adminCookie);
    expect(published.status).toBe(200);
    publishedId = published.body.id as string;
    expect(published.body.status).toBe('PUBLISHED');
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/published-menus/1411/1')
          .set('Cookie', managementCookie)
      ).status,
    ).toBe(200);

    expect(
      (
        await request(app.getHttpServer())
          .patch(`/api/v1/menus/${menuId}/versions/${publishedId}`)
          .set('Cookie', adminCookie)
          .send({
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            options: [{ title: 'نباید', displayOrder: 1 }],
          })
      ).status,
    ).toBe(422);
  });

  it('keeps the current published version when a later draft fails to publish', async () => {
    const next = await request(app.getHttpServer())
      .post(`/api/v1/menus/${menuId}/versions`)
      .set('Cookie', adminCookie)
      .send({ sourceVersionId: publishedId });
    expect(next.status).toBe(201);
    const emptyDraft = await request(app.getHttpServer())
      .post(`/api/v1/menus/${menuId}/versions`)
      .set('Cookie', adminCookie)
      .send({ sourceVersionId: null });
    expect(
      (
        await request(app.getHttpServer())
          .post(
            `/api/v1/menus/${menuId}/versions/${emptyDraft.body.id as string}/publish`,
          )
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(422);
    const menu = await request(app.getHttpServer())
      .get(`/api/v1/menus/${menuId}`)
      .set('Cookie', adminCookie);
    expect(menu.body.publishedVersionId).toBe(publishedId);
    const published = await prisma.menuItem.findMany({
      where: { menuVersionId: publishedId },
    });
    expect(published.some((item) => item.title === 'چلوکباب')).toBe(true);
  });

  it('imports Excel with keep-existing-orders and rejects stale confirm', async () => {
    const buffer = await buildMenuWorkbook({ year: 1412, month: 2 });
    const preview = await request(app.getHttpServer())
      .post('/api/v1/menus/imports/preview')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'menu.xlsx');
    expect(preview.status).toBe(200);
    expect(preview.body.valid).toBe(true);
    expect(preview.body.importId).toBeTruthy();
    expect(Array.isArray(preview.body.meals)).toBe(true);
    expect(preview.body.meals.length).toBeGreaterThan(0);
    expect(JSON.stringify(preview.body)).not.toContain('workbook');

    const firstMeal = preview.body.meals[0] as {
      mealDate: string;
      mealType: string;
      options: Array<{ title: string; displayOrder: number }>;
    };
    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/menus/imports/${preview.body.importId as string}`)
      .set('Cookie', adminCookie)
      .send({
        mealDate: firstMeal.mealDate,
        mealType: firstMeal.mealType,
        options: [{ title: 'خوراک ویرایش‌شده', displayOrder: 1 }],
      });
    expect(patched.status).toBe(200);
    expect(JSON.stringify(patched.body.meals)).toContain('خوراک ویرایش‌شده');

    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/menus/imports/${preview.body.importId as string}/confirm`)
      .set('Cookie', adminCookie)
      .send({ policy: ImportPolicy.KeepExistingOrders });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.version.status).toBe('DRAFT');
    const importedMenuId = confirmed.body.menu.id as string;

    const preview2 = await request(app.getHttpServer())
      .post('/api/v1/menus/imports/preview')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'menu.xlsx');
    await request(app.getHttpServer())
      .post(`/api/v1/menus/${importedMenuId}/versions`)
      .set('Cookie', adminCookie)
      .send({});
    expect(
      (
        await request(app.getHttpServer())
          .post(
            `/api/v1/menus/imports/${preview2.body.importId as string}/confirm`,
          )
          .set('Cookie', adminCookie)
          .send({ policy: ImportPolicy.KeepExistingOrders })
      ).status,
    ).toBe(422);

    const missingSheet = await buildMenuWorkbook({
      year: 1412,
      month: 3,
      dinnerName: 'شب',
    });
    const invalid = await request(app.getHttpServer())
      .post('/api/v1/menus/imports/preview')
      .set('Cookie', adminCookie)
      .attach('file', missingSheet, 'bad.xlsx');
    expect(invalid.body.valid).toBe(false);
    expect(invalid.body.importId).toBeNull();
  });

  it('rejects Reset when an active order points at a removed option', async () => {
    const menu = await prisma.menu.findUniqueOrThrow({ where: { id: menuId } });
    const items = await prisma.menuItem.findMany({
      where: { menuVersionId: menu.publishedVersionId ?? publishedId },
    });
    const item = items[0];
    const order = await prisma.order.create({
      data: {
        userId: adminId,
        mealDate: item.mealDate,
        mealType: item.mealType,
      },
    });
    await prisma.orderCycle.create({
      data: {
        orderId: order.id,
        menuItemId: item.id,
        cycleNumber: 1,
        usernameSnapshot: 'e2e.menu.admin',
        mealTitleSnapshot: item.title,
        mealDateSnapshot: item.mealDate,
        mealTypeSnapshot: item.mealType,
        status: 'ACTIVE',
      },
    });

    const buffer = await buildMenuWorkbook({ year: 1411, month: 1 });
    const preview = await request(app.getHttpServer())
      .post('/api/v1/menus/imports/preview')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'reset.xlsx');
    expect(preview.body.impact.atRiskOrderCount).toBeGreaterThan(0);
    expect(
      (
        await request(app.getHttpServer())
          .post(
            `/api/v1/menus/imports/${preview.body.importId as string}/confirm`,
          )
          .set('Cookie', adminCookie)
          .send({ policy: ImportPolicy.Reset })
      ).status,
    ).toBe(422);
    expect(
      (await prisma.menuItem.findUnique({ where: { id: item.id } }))?.title,
    ).toBe(item.title);
  });

  it('announces a published month to every active user and keeps the month in notification data', async () => {
    await prisma.user.update({
      where: { username: 'e2e.menu.hr' },
      data: { isActive: false },
    });

    const denied = await request(app.getHttpServer())
      .post(`/api/v1/menus/${menuId}/announce`)
      .set('Cookie', employeeCookie)
      .send({
        title: 'منوی فروردین منتشر شد 🍽️',
        body: 'برای مشاهده منو و ثبت وعده‌های غذایی، وارد سامانه شوید.',
      });
    expect(denied.status).toBe(403);

    const unpublished = await request(app.getHttpServer())
      .post('/api/v1/menus')
      .set('Cookie', adminCookie)
      .send({ year: 1411, month: 2 });
    expect(unpublished.status).toBe(201);
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/v1/menus/${unpublished.body.id as string}/announce`)
          .set('Cookie', adminCookie)
          .send({
            title: 'منوی اردیبهشت منتشر شد 🍽️',
            body: 'برای مشاهده منو و ثبت وعده‌های غذایی، وارد سامانه شوید.',
          })
      ).status,
    ).toBe(422);

    const announced = await request(app.getHttpServer())
      .post(`/api/v1/menus/${menuId}/announce`)
      .set('Cookie', adminCookie)
      .send({
        title: 'منوی سفارشی فروردین',
        body: 'متن تأییدشده مدیر برای فروردین',
      });
    expect(announced.status).toBe(200);
    expect(announced.body.jalaliYear).toBe(1411);
    expect(announced.body.jalaliMonth).toBe(1);
    expect(announced.body.lastAnnouncedBy).toBe(adminId);
    expect(announced.body.lastAnnouncedAt).toBeTruthy();
    expect(announced.body.recipientCount).toBeGreaterThanOrEqual(4);

    const employeeNotes = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Cookie', employeeCookie);
    expect(employeeNotes.status).toBe(200);
    const publishedNote = (
      employeeNotes.body.items as Array<{
        type: string;
        title: string;
        body: string;
        data: {
          page: string;
          jalaliYear: number;
          jalaliMonth: number;
          menuId: string;
        };
      }>
    ).find((item) => item.type === 'MENU_PUBLISHED');
    expect(publishedNote?.title).toBe('منوی سفارشی فروردین');
    expect(publishedNote?.body).toBe('متن تأییدشده مدیر برای فروردین');
    expect(publishedNote?.data).toMatchObject({
      page: 'menu',
      jalaliYear: 1411,
      jalaliMonth: 1,
      menuId,
    });

    const hrNotes = await prisma.notification.count({
      where: {
        user: { username: 'e2e.menu.hr' },
        type: 'MENU_PUBLISHED',
      },
    });
    expect(hrNotes).toBe(0);

    const again = await request(app.getHttpServer())
      .post(`/api/v1/menus/${menuId}/announce`)
      .set('Cookie', adminCookie)
      .send({
        title: 'اعلام مجدد فروردین',
        body: 'برای مشاهده منو و ثبت وعده‌های غذایی، وارد سامانه شوید.',
      });
    expect(again.status).toBe(200);
    expect(again.body.recipientCount).toBeGreaterThanOrEqual(4);

    await prisma.user.update({
      where: { username: 'e2e.menu.hr' },
      data: { isActive: true },
    });
  });

  it('writes menu audit rows from the session actor', async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        actor: { username: { startsWith: 'e2e.menu.' } },
        action: {
          in: [
            'MENU_CREATED',
            'MENU_VERSION_PUBLISHED',
            'MENU_PUBLICATION_ANNOUNCED',
            'EXCEL_IMPORT_CONFIRMED',
          ],
        },
      },
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs)).not.toContain('file');
  });
});
