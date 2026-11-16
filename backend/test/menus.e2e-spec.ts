import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { MealType, MenuVersionStatus, PrismaClient, Role } from '@prisma/client';
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
    await prisma.foodKnowledge.deleteMany({
      where: { normalizedName: { startsWith: 'e2e ' } },
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

  it('creates a monthly menu, saves meals, and exposes them without a publish step', async () => {
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

    publishedId = draftId;
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
          .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
          .set('Cookie', adminCookie)
          .send({
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            options: [{ title: 'چلوکباب تازه', displayOrder: 1 }],
          })
      ).status,
    ).toBe(200);
    const live = await request(app.getHttpServer())
      .get('/api/v1/published-menus/1411/1')
      .set('Cookie', employeeCookie);
    expect(JSON.stringify(live.body)).toContain('چلوکباب تازه');
  });

  it('lets admin and support edit the live version even if it is still marked published', async () => {
    await prisma.menuVersion.update({
      where: { id: draftId },
      data: { status: MenuVersionStatus.PUBLISHED, publishedAt: new Date() },
    });
    await prisma.menu.update({
      where: { id: menuId },
      data: { publishedVersionId: draftId },
    });

    const supportDinner = await request(app.getHttpServer())
      .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
      .set('Cookie', supportCookie)
      .send({
        mealDate: mealDate(2),
        mealType: MealType.DINNER,
        options: [{ title: 'عدسی پشتیبان', displayOrder: 1 }],
      });
    expect(supportDinner.status).toBe(200);
    expect(JSON.stringify(supportDinner.body.meals)).toContain('عدسی پشتیبان');

    const adminLunch = await request(app.getHttpServer())
      .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
      .set('Cookie', adminCookie)
      .send({
        mealDate: mealDate(2),
        mealType: MealType.LUNCH,
        options: [{ title: 'خوراک ادمین', displayOrder: 1 }],
      });
    expect(adminLunch.status).toBe(200);
    expect(JSON.stringify(adminLunch.body.meals)).toContain('خوراک ادمین');
  });

  it('rejects removing a menu option with an active order and allows it after cancel', async () => {
    const lunch = await prisma.menuItem.findFirst({
      where: {
        menuVersionId: draftId,
        mealType: MealType.LUNCH,
      },
      orderBy: { mealDate: 'asc' },
    });
    expect(lunch).toBeTruthy();
    const mealDate = formatDateOnly(lunch!.mealDate);

    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', employeeCookie)
      .send({
        mealDate,
        mealType: MealType.LUNCH,
        menuItemId: lunch!.id,
      });
    expect(created.status).toBe(201);

    const blocked = await request(app.getHttpServer())
      .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
      .set('Cookie', adminCookie)
      .send({
        mealDate,
        mealType: MealType.LUNCH,
        options: [],
      });
    expect(blocked.status).toBe(422);
    const blockedMessage =
      typeof blocked.body.message === 'string'
        ? blocked.body.message
        : JSON.stringify(blocked.body.message ?? blocked.body);
    expect(blockedMessage).toContain('سفارش فعال');
    expect(blockedMessage).toContain('سفارش کارکنان');
    expect(await prisma.menuItem.findUnique({ where: { id: lunch!.id } })).not.toBeNull();

    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/v1/orders/me/${created.body.id as string}/cancel`)
          .set('Cookie', employeeCookie)
      ).status,
    ).toBe(200);

    const allowed = await request(app.getHttpServer())
      .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
      .set('Cookie', adminCookie)
      .send({
        mealDate,
        mealType: MealType.LUNCH,
        options: [],
      });
    expect(allowed.status).toBe(200);
    expect(await prisma.menuItem.findUnique({ where: { id: lunch!.id } })).toBeNull();
  });

  it('does not expose a publish endpoint', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/v1/menus/${menuId}/versions/${draftId}/publish`)
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(404);
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

  it('announces a month to every active user and keeps the month in notification data', async () => {
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
            title: 'منوی اردیبهشت آماده است 🍽️',
            body: 'برای مشاهده منو و ثبت وعده‌های غذایی وارد سامانه شوید.',
          })
      ).status,
    ).toBe(200);

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

  it('remembers rice classification by normalized food name without rewriting older menu items', async () => {
    const riceName = 'e2e زرشک‌پلو با مرغ';
    const first = await request(app.getHttpServer())
      .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
      .set('Cookie', supportCookie)
      .send({
        mealDate: mealDate(10),
        mealType: MealType.LUNCH,
        options: [{ title: riceName, displayOrder: 1 }],
      });
    expect(first.status).toBe(200);
    const firstOption = first.body.meals
      .find((meal: { mealDate: string; mealType: string }) => meal.mealDate === mealDate(10) && meal.mealType === 'LUNCH')
      ?.options[0];
    expect(firstOption.isRice).toBe(false);

    const marked = await request(app.getHttpServer())
      .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
      .set('Cookie', supportCookie)
      .send({
        mealDate: mealDate(10),
        mealType: MealType.LUNCH,
        options: [{ id: firstOption.id, title: riceName, displayOrder: 1, isRice: true }],
      });
    expect(marked.status).toBe(200);
    expect(
      marked.body.meals
        .find((meal: { mealDate: string }) => meal.mealDate === mealDate(10))
        .options[0].isRice,
    ).toBe(true);

    const spaced = await request(app.getHttpServer())
      .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
      .set('Cookie', supportCookie)
      .send({
        mealDate: mealDate(11),
        mealType: MealType.LUNCH,
        options: [{ title: 'e2e زرشک پلو با مرغ', displayOrder: 1 }],
      });
    expect(spaced.status).toBe(200);
    expect(
      spaced.body.meals
        .find((meal: { mealDate: string }) => meal.mealDate === mealDate(11))
        .options[0].isRice,
    ).toBe(true);

    const laterId = spaced.body.meals
      .find((meal: { mealDate: string }) => meal.mealDate === mealDate(11))
      .options[0].id as string;
    const cleared = await request(app.getHttpServer())
      .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
      .set('Cookie', supportCookie)
      .send({
        mealDate: mealDate(11),
        mealType: MealType.LUNCH,
        options: [{ id: laterId, title: 'e2e زرشک پلو با مرغ', displayOrder: 1, isRice: false }],
      });
    expect(cleared.status).toBe(200);

    const reread = await request(app.getHttpServer())
      .get(`/api/v1/menus/${menuId}/versions/${draftId}`)
      .set('Cookie', supportCookie);
    const day10 = reread.body.meals.find(
      (meal: { mealDate: string }) => meal.mealDate === mealDate(10),
    );
    const day11 = reread.body.meals.find(
      (meal: { mealDate: string }) => meal.mealDate === mealDate(11),
    );
    expect(day10.options[0].isRice).toBe(true);
    expect(day11.options[0].isRice).toBe(false);

    const next = await request(app.getHttpServer())
      .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
      .set('Cookie', supportCookie)
      .send({
        mealDate: mealDate(12),
        mealType: MealType.DINNER,
        options: [{ title: 'e2e زرشك‌پلو  با مرغ', displayOrder: 1 }],
      });
    expect(next.status).toBe(200);
    expect(
      next.body.meals
        .find((meal: { mealDate: string }) => meal.mealDate === mealDate(12))
        .options[0].isRice,
    ).toBe(false);

    const different = await request(app.getHttpServer())
      .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
      .set('Cookie', supportCookie)
      .send({
        mealDate: mealDate(13),
        mealType: MealType.LUNCH,
        options: [{ title: 'e2e جوجه کباب با برنج', displayOrder: 1 }],
      });
    expect(different.status).toBe(200);
    expect(
      different.body.meals
        .find((meal: { mealDate: string }) => meal.mealDate === mealDate(13))
        .options[0].isRice,
    ).toBe(false);

    const createdOrder = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', employeeCookie)
      .send({
        mealDate: mealDate(10),
        mealType: MealType.LUNCH,
        menuItemId: firstOption.id,
      });
    expect([200, 201]).toContain(createdOrder.status);

    await request(app.getHttpServer())
      .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
      .set('Cookie', supportCookie)
      .send({
        mealDate: mealDate(11),
        mealType: MealType.LUNCH,
        options: [{ id: laterId, title: 'e2e زرشک پلو با مرغ', displayOrder: 1, isRice: true }],
      });

    const afterClassify = await prisma.menuItem.findUnique({
      where: { id: firstOption.id as string },
    });
    expect(afterClassify?.isRice).toBe(true);
    if (createdOrder.status === 201 || createdOrder.status === 200) {
      expect(createdOrder.body.currentCycle?.menuItemId ?? createdOrder.body.menuItemId).toBe(
        firstOption.id,
      );
    }

    const [left, right] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
        .set('Cookie', supportCookie)
        .send({
          mealDate: mealDate(14),
          mealType: MealType.LUNCH,
          options: [{ title: 'e2e خورش قیمه همزمان', displayOrder: 1, isRice: true }],
        }),
      request(app.getHttpServer())
        .patch(`/api/v1/menus/${menuId}/versions/${draftId}`)
        .set('Cookie', adminCookie)
        .send({
          mealDate: mealDate(15),
          mealType: MealType.LUNCH,
          options: [{ title: 'e2e خورش قیمه همزمان', displayOrder: 1, isRice: true }],
        }),
    ]);
    expect(left.status).toBe(200);
    expect(right.status).toBe(200);
    expect(
      await prisma.foodKnowledge.count({
        where: { normalizedName: 'e2e خورش قیمه همزمان' },
      }),
    ).toBe(1);
  });

  it('writes menu audit rows from the session actor', async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        actor: { username: { startsWith: 'e2e.menu.' } },
        action: {
          in: [
            'MENU_CREATED',
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
