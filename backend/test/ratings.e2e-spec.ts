import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  MealType,
  MenuVersionStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PasswordService } from '../src/auth/password.service';
import { EnvironmentVariables } from '../src/config/env.validation';
import {
  formatDateOnly,
  jalaliToGregorian,
  utcDateFromGregorian,
} from '../src/dates/jalali';

const prisma = new PrismaClient();
const password = 'Kavosh-1405';

function cookieHeader(response: request.Response) {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((item) => item.startsWith('khaan.sid=')) ?? '';
}

async function cleanup() {
  await prisma.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER ALL');
  await prisma.$executeRawUnsafe('ALTER TABLE menu_items DISABLE TRIGGER ALL');
  await prisma.$executeRawUnsafe(
    'ALTER TABLE order_cycles DISABLE TRIGGER ALL',
  );
  try {
    await prisma.rating.deleteMany({
      where: { order: { user: { username: { startsWith: 'e2e.rating.' } } } },
    });
    await prisma.orderGroupSnapshot.deleteMany({
      where: {
        orderCycle: {
          order: { user: { username: { startsWith: 'e2e.rating.' } } },
        },
      },
    });
    await prisma.orderStatusHistory.deleteMany({
      where: { actor: { username: { startsWith: 'e2e.rating.' } } },
    });
    await prisma.orderCycle.deleteMany({
      where: { order: { user: { username: { startsWith: 'e2e.rating.' } } } },
    });
    await prisma.order.deleteMany({
      where: { user: { username: { startsWith: 'e2e.rating.' } } },
    });
    await prisma.auditLog.deleteMany({
      where: { actor: { username: { startsWith: 'e2e.rating.' } } },
    });
    await prisma.session.deleteMany({
      where: { user: { username: { startsWith: 'e2e.rating.' } } },
    });
    await prisma.menuItem.deleteMany({
      where: {
        menuVersion: {
          createdByUser: { username: { startsWith: 'e2e.rating.' } },
        },
      },
    });
    await prisma.menu.updateMany({
      where: {
        versions: {
          some: { createdByUser: { username: { startsWith: 'e2e.rating.' } } },
        },
      },
      data: { publishedVersionId: null },
    });
    await prisma.menuVersion.deleteMany({
      where: { createdByUser: { username: { startsWith: 'e2e.rating.' } } },
    });
    await prisma.menu.deleteMany({
      where: {
        versions: {
          some: { createdByUser: { username: { startsWith: 'e2e.rating.' } } },
        },
      },
    });
    await prisma.mealSetting.deleteMany({
      where: { updatedByUser: { username: { startsWith: 'e2e.rating.' } } },
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'e2e.rating.' } },
    });
    await prisma.building.deleteMany({
      where: { name: { startsWith: 'e2e-rating-' } },
    });
  } finally {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE order_cycles ENABLE TRIGGER ALL',
    );
    await prisma.$executeRawUnsafe('ALTER TABLE menu_items ENABLE TRIGGER ALL');
    await prisma.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER ALL');
  }
}

describe('Ratings (e2e)', () => {
  let app: INestApplication<App>;
  let adminCookie = '';
  let supportCookie = '';
  let employeeCookie = '';
  let hrCookie = '';
  let managementCookie = '';
  let pastOrderId = '';
  let futureOrderId = '';
  let cancelledOrderId = '';
  let otherOrderId = '';
  let previousMeals: {
    mealType: MealType;
    servingTime: Date;
    updatedBy: string;
  }[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get(ConfigService<EnvironmentVariables, true>));
    await app.init();
    await cleanup();
    previousMeals = await prisma.mealSetting.findMany();

    const hash = await app.get(PasswordService).hash(password);
    const building = await prisma.building.create({
      data: { name: 'e2e-rating-main' },
    });
    const admin = await prisma.user.create({
      data: {
        username: 'e2e.rating.admin',
        passwordHash: hash,
        role: Role.ADMIN,
      },
    });
    const employee = await prisma.user.create({
      data: {
        username: 'e2e.rating.employee',
        passwordHash: hash,
        role: Role.EMPLOYEE,
        buildingId: building.id,
      },
    });
    const other = await prisma.user.create({
      data: {
        username: 'e2e.rating.other',
        passwordHash: hash,
        role: Role.EMPLOYEE,
        buildingId: building.id,
      },
    });
    await prisma.user.createMany({
      data: [
        {
          username: 'e2e.rating.support',
          passwordHash: hash,
          role: Role.SUPPORT,
          buildingId: building.id,
        },
        {
          username: 'e2e.rating.hr',
          passwordHash: hash,
          role: Role.HR,
          buildingId: building.id,
        },
        {
          username: 'e2e.rating.management',
          passwordHash: hash,
          role: Role.MANAGEMENT,
          buildingId: building.id,
        },
      ],
    });

    const pastDate = utcDateFromGregorian(jalaliToGregorian(1399, 1, 15)!);
    const futureDate = utcDateFromGregorian(jalaliToGregorian(1414, 1, 15)!);
    const menus = new Map<string, { menuId: string; versionId: string }>();

    async function addItem(mealDate: Date, mealType: MealType, title: string) {
      const jalali = mealDate === pastDate ? { year: 1399, month: 1 } : { year: 1414, month: 1 };
      const key = `${jalali.year}-${jalali.month}`;
      let slot = menus.get(key);
      if (!slot) {
        const existing = await prisma.menu.findUnique({
          where: { year_month: { year: jalali.year, month: jalali.month } },
        });
        const menu =
          existing ??
          (await prisma.menu.create({
            data: { year: jalali.year, month: jalali.month },
          }));
        const last = await prisma.menuVersion.aggregate({
          where: { menuId: menu.id },
          _max: { versionNumber: true },
        });
        const version = await prisma.menuVersion.create({
          data: {
            menuId: menu.id,
            versionNumber: (last._max.versionNumber ?? 0) + 1,
            status: MenuVersionStatus.DRAFT,
            createdBy: admin.id,
          },
        });
        slot = { menuId: menu.id, versionId: version.id };
        menus.set(key, slot);
      }
      return prisma.menuItem.create({
        data: {
          menuVersionId: slot.versionId,
          mealDate,
          mealType,
          title,
          displayOrder: 1,
        },
      });
    }

    const pastLunch = await addItem(pastDate, MealType.LUNCH, 'چلو گذشته');
    const pastDinner = await addItem(pastDate, MealType.DINNER, 'شام گذشته');
    const futureLunch = await addItem(futureDate, MealType.LUNCH, 'چلو آینده');
    for (const slot of menus.values()) {
      await prisma.menuVersion.update({
        where: { id: slot.versionId },
        data: { status: MenuVersionStatus.PUBLISHED, publishedAt: new Date() },
      });
      await prisma.menu.update({
        where: { id: slot.menuId },
        data: { publishedVersionId: slot.versionId },
      });
    }

    const login = (username: string) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username, password });
    adminCookie = cookieHeader(await login('e2e.rating.admin'));
    supportCookie = cookieHeader(await login('e2e.rating.support'));
    employeeCookie = cookieHeader(await login('e2e.rating.employee'));
    hrCookie = cookieHeader(await login('e2e.rating.hr'));
    managementCookie = cookieHeader(await login('e2e.rating.management'));

    const settings = await request(app.getHttpServer())
      .put('/api/v1/meal-settings')
      .set('Cookie', adminCookie)
      .send({
        items: [
          { mealType: MealType.LUNCH, servingTime: '00:00' },
          { mealType: MealType.DINNER, servingTime: '19:00' },
        ],
      });
    expect(settings.status).toBe(200);

    const pastOrder = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', supportCookie)
      .send({
        userId: employee.id,
        mealDate: formatDateOnly(pastDate),
        mealType: MealType.LUNCH,
        menuItemId: pastLunch.id,
      });
    expect(pastOrder.status).toBe(201);
    pastOrderId = pastOrder.body.id as string;

    const otherOrder = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', supportCookie)
      .send({
        userId: other.id,
        mealDate: formatDateOnly(pastDate),
        mealType: MealType.LUNCH,
        menuItemId: pastLunch.id,
      });
    otherOrderId = otherOrder.body.id as string;

    const cancelled = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', supportCookie)
      .send({
        userId: employee.id,
        mealDate: formatDateOnly(pastDate),
        mealType: MealType.DINNER,
        menuItemId: pastDinner.id,
      });
    cancelledOrderId = cancelled.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${cancelledOrderId}/cancel`)
      .set('Cookie', supportCookie);

    const future = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', supportCookie)
      .send({
        userId: employee.id,
        mealDate: formatDateOnly(futureDate),
        mealType: MealType.LUNCH,
        menuItemId: futureLunch.id,
      });
    futureOrderId = future.body.id as string;
  });

  afterAll(async () => {
    await cleanup();
    for (const row of previousMeals) {
      await prisma.mealSetting.upsert({
        where: { mealType: row.mealType },
        create: {
          mealType: row.mealType,
          servingTime: row.servingTime,
          updatedBy: row.updatedBy,
        },
        update: {
          servingTime: row.servingTime,
          updatedBy: row.updatedBy,
        },
      });
    }
    await app.close();
    await prisma.$disconnect();
  });

  it('rejects a score outside 1–5', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .put(`/api/v1/orders/me/${pastOrderId}/rating`)
          .set('Cookie', employeeCookie)
          .send({ score: 6 })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app.getHttpServer())
          .put(`/api/v1/orders/me/${pastOrderId}/rating`)
          .set('Cookie', employeeCookie)
          .send({ score: 0 })
      ).status,
    ).toBe(400);
  });

  it('creates a rating without a comment and upserts the same row', async () => {
    const created = await request(app.getHttpServer())
      .put(`/api/v1/orders/me/${pastOrderId}/rating`)
      .set('Cookie', employeeCookie)
      .send({ score: 4 });
    expect(created.status).toBe(200);
    expect(created.body.score).toBe(4);
    expect(created.body.comment).toBeNull();
    expect(created.body.orderId).toBe(pastOrderId);
    const updated = await request(app.getHttpServer())
      .put(`/api/v1/orders/me/${pastOrderId}/rating`)
      .set('Cookie', employeeCookie)
      .send({ score: 5, comment: 'عالی بود' });
    expect(updated.status).toBe(200);
    expect(updated.body.id).toBe(created.body.id);
    expect(updated.body.score).toBe(5);
    expect(updated.body.comment).toBe('عالی بود');
    expect(await prisma.rating.count({ where: { orderId: pastOrderId } })).toBe(
      1,
    );
    const mine = await request(app.getHttpServer())
      .get(`/api/v1/orders/me/${pastOrderId}/rating`)
      .set('Cookie', employeeCookie);
    expect(mine.body.score).toBe(5);
    const order = await request(app.getHttpServer())
      .get(`/api/v1/orders/me/${pastOrderId}`)
      .set('Cookie', employeeCookie);
    expect(order.body.rating.score).toBe(5);
  });

  it('blocks rating before the configured serving time and allows it after', async () => {
    const blocked = await request(app.getHttpServer())
      .put(`/api/v1/orders/me/${futureOrderId}/rating`)
      .set('Cookie', employeeCookie)
      .send({ score: 3 });
    expect(blocked.status).toBe(422);
    const moved = await request(app.getHttpServer())
      .put('/api/v1/meal-settings')
      .set('Cookie', supportCookie)
      .send({
        items: [
          { mealType: MealType.LUNCH, servingTime: '23:59' },
          { mealType: MealType.DINNER, servingTime: '23:59' },
        ],
      });
    expect(moved.status).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .put(`/api/v1/orders/me/${futureOrderId}/rating`)
          .set('Cookie', employeeCookie)
          .send({ score: 3 })
      ).status,
    ).toBe(422);
    await request(app.getHttpServer())
      .put('/api/v1/meal-settings')
      .set('Cookie', adminCookie)
      .send({
        items: [
          { mealType: MealType.LUNCH, servingTime: '00:00' },
          { mealType: MealType.DINNER, servingTime: '19:00' },
        ],
      });
    const pastStill = await request(app.getHttpServer())
      .get(`/api/v1/orders/me/${pastOrderId}/rating`)
      .set('Cookie', employeeCookie);
    expect(pastStill.body.score).toBe(5);
    expect(pastStill.body.comment).toBe('عالی بود');
  });

  it('rejects cancelled orders and other employees’ ratings', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .put(`/api/v1/orders/me/${cancelledOrderId}/rating`)
          .set('Cookie', employeeCookie)
          .send({ score: 2 })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app.getHttpServer())
          .put(`/api/v1/orders/me/${otherOrderId}/rating`)
          .set('Cookie', employeeCookie)
          .send({ score: 2 })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/orders/me/${otherOrderId}/rating`)
          .set('Cookie', employeeCookie)
      ).status,
    ).toBe(404);
  });

  it('lets Support, Management and Admin list ratings but not Employee or HR', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/ratings')
          .set('Cookie', employeeCookie)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/ratings')
          .set('Cookie', hrCookie)
      ).status,
    ).toBe(403);
    const listed = await request(app.getHttpServer())
      .get('/api/v1/ratings')
      .set('Cookie', managementCookie);
    expect(listed.status).toBe(200);
    expect(
      listed.body.items.some(
        (row: { orderId: string }) => row.orderId === pastOrderId,
      ),
    ).toBe(true);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/ratings')
          .set('Cookie', supportCookie)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/ratings')
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(200);
  });
});
