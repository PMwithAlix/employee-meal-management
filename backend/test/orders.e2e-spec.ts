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
const YEAR = 1413;
const MONTH = 1;

function cookieHeader(response: request.Response) {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((item) => item.startsWith('khaan.sid=')) ?? '';
}

function mealDate(day: number) {
  return formatDateOnly(
    utcDateFromGregorian(jalaliToGregorian(YEAR, MONTH, day)!),
  );
}

async function cleanup() {
  await prisma.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER ALL');
  await prisma.$executeRawUnsafe('ALTER TABLE menu_items DISABLE TRIGGER ALL');
  await prisma.$executeRawUnsafe(
    'ALTER TABLE order_cycles DISABLE TRIGGER ALL',
  );
  try {
    await prisma.orderGroupSnapshot.deleteMany({
      where: {
        orderCycle: {
          order: { user: { username: { startsWith: 'e2e.order.' } } },
        },
      },
    });
    await prisma.orderStatusHistory.deleteMany({
      where: { actor: { username: { startsWith: 'e2e.order.' } } },
    });
    await prisma.orderCycle.deleteMany({
      where: { order: { user: { username: { startsWith: 'e2e.order.' } } } },
    });
    await prisma.order.deleteMany({
      where: { user: { username: { startsWith: 'e2e.order.' } } },
    });
    await prisma.guestOrderHistory.deleteMany({
      where: { actor: { username: { startsWith: 'e2e.order.' } } },
    });
    await prisma.guestOrder.deleteMany({
      where: { creator: { username: { startsWith: 'e2e.order.' } } },
    });
    await prisma.orderDeadline.deleteMany({
      where: { createdByUser: { username: { startsWith: 'e2e.order.' } } },
    });
    await prisma.auditLog.deleteMany({
      where: { actor: { username: { startsWith: 'e2e.order.' } } },
    });
    await prisma.session.deleteMany({
      where: { user: { username: { startsWith: 'e2e.order.' } } },
    });
    await prisma.groupMembership.deleteMany({
      where: { user: { username: { startsWith: 'e2e.order.' } } },
    });
    await prisma.menuItem.deleteMany({
      where: { menuVersion: { menu: { year: YEAR, month: MONTH } } },
    });
    await prisma.menu.updateMany({
      where: { year: YEAR, month: MONTH },
      data: { publishedVersionId: null },
    });
    await prisma.menuVersion.deleteMany({
      where: { menu: { year: YEAR, month: MONTH } },
    });
    await prisma.menu.deleteMany({ where: { year: YEAR, month: MONTH } });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'e2e.order.' } },
    });
    await prisma.group.deleteMany({
      where: { name: { startsWith: 'گروه سفارش' } },
    });
    await prisma.building.deleteMany({
      where: { name: { startsWith: 'e2e-order-' } },
    });
  } finally {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE order_cycles ENABLE TRIGGER ALL',
    );
    await prisma.$executeRawUnsafe('ALTER TABLE menu_items ENABLE TRIGGER ALL');
    await prisma.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER ALL');
  }
}

describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let adminCookie = '';
  let supportCookie = '';
  let employeeCookie = '';
  let otherCookie = '';
  let hrCookie = '';
  let managementCookie = '';
  let employeeId = '';
  let otherId = '';
  let inactiveId = '';
  let buildingId = '';
  let otherBuildingId = '';
  let lunchA = '';
  let lunchB = '';
  let dinnerA = '';
  let day2Lunch = '';
  let draftItem = '';
  let groupId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get(ConfigService<EnvironmentVariables, true>));
    await app.init();
    await cleanup();

    const hash = await app.get(PasswordService).hash(password);
    const building = await prisma.building.create({
      data: { name: 'e2e-order-main' },
    });
    const otherBuilding = await prisma.building.create({
      data: { name: 'e2e-order-other' },
    });
    buildingId = building.id;
    otherBuildingId = otherBuilding.id;
    const admin = await prisma.user.create({
      data: {
        username: 'e2e.order.admin',
        passwordHash: hash,
        role: Role.ADMIN,
      },
    });
    const employee = await prisma.user.create({
      data: {
        username: 'e2e.order.employee',
        passwordHash: hash,
        role: Role.EMPLOYEE,
        buildingId,
      },
    });
    const other = await prisma.user.create({
      data: {
        username: 'e2e.order.other',
        passwordHash: hash,
        role: Role.EMPLOYEE,
        buildingId,
      },
    });
    const inactive = await prisma.user.create({
      data: {
        username: 'e2e.order.inactive',
        passwordHash: hash,
        role: Role.EMPLOYEE,
        buildingId,
        isActive: false,
      },
    });
    employeeId = employee.id;
    otherId = other.id;
    inactiveId = inactive.id;
    await prisma.user.createMany({
      data: [
        {
          username: 'e2e.order.support',
          passwordHash: hash,
          role: Role.SUPPORT,
          buildingId,
        },
        {
          username: 'e2e.order.hr',
          passwordHash: hash,
          role: Role.HR,
          buildingId,
        },
        {
          username: 'e2e.order.management',
          passwordHash: hash,
          role: Role.MANAGEMENT,
          buildingId,
        },
      ],
    });
    const groupA = await prisma.group.create({
      data: { name: 'گروه سفارش الف' },
    });
    const groupB = await prisma.group.create({
      data: { name: 'گروه سفارش ب' },
    });
    groupId = groupA.id;
    await prisma.groupMembership.createMany({
      data: [
        { groupId: groupA.id, userId: employeeId, startedAt: new Date() },
        { groupId: groupB.id, userId: employeeId, startedAt: new Date() },
      ],
    });

    const menu = await prisma.menu.create({
      data: { year: YEAR, month: MONTH },
    });
    const version = await prisma.menuVersion.create({
      data: {
        menuId: menu.id,
        versionNumber: 1,
        status: MenuVersionStatus.DRAFT,
        createdBy: admin.id,
      },
    });
    const day1 = utcDateFromGregorian(jalaliToGregorian(YEAR, MONTH, 1)!);
    const day2 = utcDateFromGregorian(jalaliToGregorian(YEAR, MONTH, 2)!);
    const createdItems = await prisma.$transaction([
      prisma.menuItem.create({
        data: {
          menuVersionId: version.id,
          mealDate: day1,
          mealType: MealType.LUNCH,
          title: 'چلوکباب',
          displayOrder: 1,
        },
      }),
      prisma.menuItem.create({
        data: {
          menuVersionId: version.id,
          mealDate: day1,
          mealType: MealType.LUNCH,
          title: 'قورمه',
          displayOrder: 2,
        },
      }),
      prisma.menuItem.create({
        data: {
          menuVersionId: version.id,
          mealDate: day1,
          mealType: MealType.DINNER,
          title: 'سوپ',
          displayOrder: 1,
        },
      }),
      prisma.menuItem.create({
        data: {
          menuVersionId: version.id,
          mealDate: day2,
          mealType: MealType.LUNCH,
          title: 'ماکارونی',
          displayOrder: 1,
        },
      }),
    ]);
    lunchA = createdItems[0].id;
    lunchB = createdItems[1].id;
    dinnerA = createdItems[2].id;
    day2Lunch = createdItems[3].id;
    await prisma.menuVersion.update({
      where: { id: version.id },
      data: { status: MenuVersionStatus.PUBLISHED, publishedAt: new Date() },
    });
    await prisma.menu.update({
      where: { id: menu.id },
      data: { publishedVersionId: version.id },
    });
    const draft = await prisma.menuVersion.create({
      data: {
        menuId: menu.id,
        versionNumber: 2,
        status: MenuVersionStatus.DRAFT,
        createdBy: admin.id,
      },
    });
    const draftRow = await prisma.menuItem.create({
      data: {
        menuVersionId: draft.id,
        mealDate: day1,
        mealType: MealType.LUNCH,
        title: 'پیش‌نویس',
        displayOrder: 1,
      },
    });
    draftItem = draftRow.id;

    const login = (username: string) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username, password });
    adminCookie = cookieHeader(await login('e2e.order.admin'));
    supportCookie = cookieHeader(await login('e2e.order.support'));
    employeeCookie = cookieHeader(await login('e2e.order.employee'));
    otherCookie = cookieHeader(await login('e2e.order.other'));
    hrCookie = cookieHeader(await login('e2e.order.hr'));
    managementCookie = cookieHeader(await login('e2e.order.management'));
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    await prisma.$disconnect();
  });

  it('configures independent lunch and dinner deadlines for a Jalali month', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const past = new Date(Date.now() - 60000).toISOString();
    const put = await request(app.getHttpServer())
      .put(`/api/v1/order-deadlines/${YEAR}/${MONTH}`)
      .set('Cookie', supportCookie)
      .send({
        items: [
          {
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            deadlineAt: future,
          },
          {
            mealDate: mealDate(1),
            mealType: MealType.DINNER,
            deadlineAt: past,
          },
          {
            mealDate: mealDate(2),
            mealType: MealType.LUNCH,
            deadlineAt: future,
          },
        ],
      });
    expect(put.status).toBe(200);
    expect(put.body).toHaveLength(3);
    expect(
      (
        await request(app.getHttpServer())
          .put(`/api/v1/order-deadlines/${YEAR}/${MONTH}`)
          .set('Cookie', employeeCookie)
          .send({ items: put.body })
      ).status,
    ).toBe(403);
    const listed = await request(app.getHttpServer())
      .get(`/api/v1/order-deadlines/${YEAR}/${MONTH}`)
      .set('Cookie', employeeCookie);
    expect(listed.status).toBe(200);
  });

  it('enforces RBAC for org-wide and guest order APIs', async () => {
    for (const cookie of [employeeCookie, hrCookie, managementCookie]) {
      expect(
        (
          await request(app.getHttpServer())
            .get('/api/v1/orders')
            .set('Cookie', cookie)
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app.getHttpServer())
            .get('/api/v1/guest-orders')
            .set('Cookie', cookie)
        ).status,
      ).toBe(403);
    }
  });

  it('lets an employee create, reject duplicates, edit, cancel, and reorder', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('Cookie', employeeCookie)
          .send({
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            menuItemId: lunchA,
            quantity: 2,
          })
      ).status,
    ).toBe(400);

    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', employeeCookie)
      .send({
        mealDate: mealDate(1),
        mealType: MealType.LUNCH,
        menuItemId: lunchA,
      });
    expect(created.status).toBe(201);
    expect(created.body.quantity).toBe(1);
    expect(created.body.currentCycle.usernameSnapshot).toBe(
      'e2e.order.employee',
    );
    expect(created.body.currentCycle.buildingNameSnapshot).toBe(
      'e2e-order-main',
    );
    expect(created.body.currentCycle.optionTitle).toBe('چلوکباب');
    expect(created.body.currentCycle.groups).toHaveLength(2);
    const orderId = created.body.id as string;

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Cookie', otherCookie)
        .send({
          mealDate: mealDate(1),
          mealType: MealType.LUNCH,
          menuItemId: lunchA,
        }),
      request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Cookie', otherCookie)
        .send({
          mealDate: mealDate(1),
          mealType: MealType.LUNCH,
          menuItemId: lunchB,
        }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('Cookie', employeeCookie)
          .send({
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            menuItemId: lunchB,
          })
      ).status,
    ).toBe(409);

    const edited = await request(app.getHttpServer())
      .patch(`/api/v1/orders/me/${orderId}`)
      .set('Cookie', employeeCookie)
      .send({ menuItemId: lunchB });
    expect(edited.status).toBe(200);
    expect(edited.body.currentCycle.optionTitle).toBe('قورمه');
    expect(edited.body.cycles.length).toBeGreaterThan(1);

    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/orders/me/${orderId}`)
          .set('Cookie', otherCookie)
      ).status,
    ).toBe(404);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/orders/me/${orderId}/cancel`)
      .set('Cookie', employeeCookie);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const again = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', employeeCookie)
      .send({
        mealDate: mealDate(1),
        mealType: MealType.LUNCH,
        menuItemId: lunchA,
      });
    expect(again.status).toBe(201);
    expect(again.body.id).toBe(orderId);
    expect(again.body.status).toBe('ACTIVE');
  });

  it('rejects invalid options, draft items, elapsed dinner deadlines, and inactive users', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('Cookie', employeeCookie)
          .send({
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            menuItemId: draftItem,
          })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('Cookie', employeeCookie)
          .send({
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            menuItemId: day2Lunch,
          })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('Cookie', employeeCookie)
          .send({
            mealDate: mealDate(1),
            mealType: MealType.DINNER,
            menuItemId: dinnerA,
          })
      ).status,
    ).toBe(422);

    const supportDinner = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', supportCookie)
      .send({
        userId: otherId,
        mealDate: mealDate(1),
        mealType: MealType.DINNER,
        menuItemId: dinnerA,
      });
    expect(supportDinner.status).toBe(201);
    expect(supportDinner.body.userId).toBe(otherId);

    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('Cookie', supportCookie)
          .send({
            userId: inactiveId,
            mealDate: mealDate(2),
            mealType: MealType.LUNCH,
            menuItemId: day2Lunch,
          })
      ).status,
    ).toBe(422);

    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('Cookie', employeeCookie)
          .send({
            userId: otherId,
            mealDate: mealDate(2),
            mealType: MealType.LUNCH,
            menuItemId: day2Lunch,
          })
      ).status,
    ).toBe(403);
  });

  it('preserves snapshots after building transfer and group rename', async () => {
    const mine = await request(app.getHttpServer())
      .get('/api/v1/orders/me')
      .query({ mealType: MealType.LUNCH, status: 'ACTIVE' })
      .set('Cookie', employeeCookie);
    const orderId = mine.body.items[0].id as string;
    const before = mine.body.items[0].currentCycle;
    await prisma.user.update({
      where: { id: employeeId },
      data: { buildingId: otherBuildingId },
    });
    await prisma.group.update({
      where: { id: groupId },
      data: { name: 'گروه سفارش الف-تغییریافته' },
    });
    const after = await request(app.getHttpServer())
      .get(`/api/v1/orders/me/${orderId}`)
      .set('Cookie', employeeCookie);
    expect(after.body.currentCycle.buildingNameSnapshot).toBe(
      before.buildingNameSnapshot,
    );
    expect(after.body.currentCycle.buildingIdSnapshot).toBe(buildingId);
    expect(
      after.body.currentCycle.groups.some(
        (group: { groupNameSnapshot: string }) =>
          group.groupNameSnapshot === 'گروه سفارش الف',
      ),
    ).toBe(true);
  });

  it('manages guest orders without creating users', async () => {
    const usersBefore = await prisma.user.count({
      where: { username: { startsWith: 'e2e.order.' } },
    });
    const created = await request(app.getHttpServer())
      .post('/api/v1/guest-orders')
      .set('Cookie', adminCookie)
      .send({
        buildingId,
        mealDate: mealDate(1),
        mealType: MealType.LUNCH,
        menuItemId: lunchA,
        quantity: 4,
        note: 'مهمان هیئت',
      });
    expect(created.status).toBe(201);
    expect(created.body.quantity).toBe(4);
    expect(created.body.buildingNameSnapshot).toBe('e2e-order-main');
    const guestId = created.body.id as string;
    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/guest-orders/${guestId}`)
      .set('Cookie', supportCookie)
      .send({ quantity: 5, menuItemId: lunchB });
    expect(patched.body.quantity).toBe(5);
    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/guest-orders/${guestId}/cancel`)
      .set('Cookie', supportCookie);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(cancelled.body.history.length).toBeGreaterThanOrEqual(3);
    expect(
      await prisma.user.count({
        where: { username: { startsWith: 'e2e.order.' } },
      }),
    ).toBe(usersBefore);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/orders/me/${guestId}`)
          .set('Cookie', employeeCookie)
      ).status,
    ).toBe(404);
  });

  it('writes order audit rows from the session actor', async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        actor: { username: { startsWith: 'e2e.order.' } },
        action: {
          in: [
            'ORDER_CREATED',
            'GUEST_ORDER_CREATED',
            'ORDER_DEADLINES_UPDATED',
          ],
        },
      },
    });
    expect(logs.length).toBeGreaterThan(0);
  });
});
