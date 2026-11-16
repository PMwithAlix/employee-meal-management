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
import { PasswordService } from '../src/modules/auth/password.service';
import { EnvironmentVariables } from '../src/config/env.validation';
import {
  formatDateOnly,
  jalaliToGregorian,
  utcDateFromGregorian,
} from '../src/common/calendar/jalali';

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
    await prisma.rating.deleteMany({
      where: { order: { user: { username: { startsWith: 'e2e.order.' } } } },
    });
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
    await prisma.menu.update({
      where: { id: menu.id },
      data: { publishedVersionId: version.id },
    });

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

  it('configures independent lunch and dinner deadline policies', async () => {
    const put = await request(app.getHttpServer())
      .put('/api/v1/order-deadline-policy')
      .set('Cookie', supportCookie)
      .send({
        items: [
          {
            mealType: MealType.LUNCH,
            relation: 'SAME_DAY',
            hour: 23,
            minute: 59,
          },
          {
            mealType: MealType.DINNER,
            relation: 'PREVIOUS_DAY',
            hour: 14,
            minute: 0,
          },
        ],
      });
    expect(put.status).toBe(200);
    expect(put.body).toHaveLength(2);
    expect(
      (
        await request(app.getHttpServer())
          .put('/api/v1/order-deadline-policy')
          .set('Cookie', employeeCookie)
          .send({ items: put.body })
      ).status,
    ).toBe(403);
    const listed = await request(app.getHttpServer())
      .get('/api/v1/order-deadline-policy')
      .set('Cookie', employeeCookie);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mealType: 'LUNCH',
          relation: 'SAME_DAY',
          hour: 23,
          minute: 59,
        }),
        expect.objectContaining({
          mealType: 'DINNER',
          relation: 'PREVIOUS_DAY',
          hour: 14,
          minute: 0,
        }),
      ]),
    );
  });

  it('enforces RBAC for org-wide and guest order APIs', async () => {
    for (const cookie of [employeeCookie, hrCookie]) {
      expect(
        (
          await request(app.getHttpServer())
            .get('/api/v1/orders')
            .set('Cookie', cookie)
        ).status,
      ).toBe(403);
    }
    for (const cookie of [employeeCookie, hrCookie, managementCookie]) {
      expect(
        (
          await request(app.getHttpServer())
            .get('/api/v1/guest-orders')
            .set('Cookie', cookie)
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/orders')
          .set('Cookie', managementCookie)
      ).status,
    ).toBe(200);
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

  it('rejects invalid options, elapsed dinner deadlines, and inactive users', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('Cookie', employeeCookie)
          .send({
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            menuItemId: dinnerA,
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
    ).toBe(201);

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
    await prisma.groupMembership.updateMany({
      where: { userId: employeeId, groupId },
      data: { endedAt: new Date() },
    });
    const afterRemoval = await request(app.getHttpServer())
      .get(`/api/v1/orders/me/${orderId}`)
      .set('Cookie', employeeCookie);
    expect(afterRemoval.body.currentCycle.groups).toEqual(
      after.body.currentCycle.groups,
    );
    expect(afterRemoval.body.currentCycle.buildingNameSnapshot).toBe(
      before.buildingNameSnapshot,
    );
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

  it('rejects invalid guest-order payloads and preserves snapshots after a building rename', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/guest-orders')
          .set('Cookie', employeeCookie)
          .send({
            buildingId,
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            menuItemId: lunchA,
            quantity: 1,
          })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/guest-orders')
          .set('Cookie', managementCookie)
          .send({
            buildingId,
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            menuItemId: lunchA,
            quantity: 1,
          })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/buildings')
          .set('Cookie', supportCookie)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/buildings')
          .set('Cookie', supportCookie)
          .send({ name: 'e2e-order-forbidden' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/guest-orders')
          .set('Cookie', supportCookie)
          .send({
            buildingId,
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            menuItemId: lunchA,
            quantity: 0,
          })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/guest-orders')
          .set('Cookie', supportCookie)
          .send({
            buildingId: '00000000-0000-0000-0000-000000000000',
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            menuItemId: lunchA,
            quantity: 1,
          })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/guest-orders')
          .set('Cookie', supportCookie)
          .send({
            buildingId,
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            menuItemId: dinnerA,
            quantity: 1,
          })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/guest-orders')
          .set('Cookie', supportCookie)
          .send({
            buildingId,
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            menuItemId: dinnerA,
            quantity: 1,
          })
      ).status,
    ).toBe(422);
    const isolated = await request(app.getHttpServer())
      .post('/api/v1/buildings')
      .set('Cookie', adminCookie)
      .send({ name: 'e2e-order-guest-snap' });
    const created = await request(app.getHttpServer())
      .post('/api/v1/guest-orders')
      .set('Cookie', supportCookie)
      .send({
        buildingId: isolated.body.id,
        mealDate: mealDate(1),
        mealType: MealType.LUNCH,
        menuItemId: lunchA,
        quantity: 2,
        note: 'بازدید',
      });
    expect(created.status).toBe(201);
    expect(created.body.buildingNameSnapshot).toBe('e2e-order-guest-snap');
    expect(created.body.mealTitleSnapshot).toBe('چلوکباب');
    await request(app.getHttpServer())
      .patch(`/api/v1/buildings/${isolated.body.id}`)
      .set('Cookie', adminCookie)
      .send({ name: 'e2e-order-guest-renamed' });
    const listed = await request(app.getHttpServer())
      .get('/api/v1/guest-orders')
      .query({
        buildingId: isolated.body.id,
        mealDate: mealDate(1),
        mealType: MealType.LUNCH,
        status: 'ACTIVE',
      })
      .set('Cookie', supportCookie);
    expect(listed.status).toBe(200);
    const row = listed.body.items.find(
      (item: { id: string }) => item.id === created.body.id,
    );
    expect(row.buildingNameSnapshot).toBe('e2e-order-guest-snap');
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/guest-orders/${created.body.id}`)
      .set('Cookie', supportCookie);
    expect(detail.body.buildingNameSnapshot).toBe('e2e-order-guest-snap');
    expect(detail.body.history.length).toBeGreaterThanOrEqual(1);
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

  it('snapshots only memberships valid at the cycle timestamp, using the target employee', async () => {
    const now = new Date();
    const future = await prisma.group.create({
      data: { name: 'گروه سفارش آینده' },
    });
    const ended = await prisma.group.create({
      data: { name: 'گروه سفارش پایان‌یافته' },
    });
    const supportGroup = await prisma.group.create({
      data: { name: 'گروه سفارش پشتیبان' },
    });
    const extra = await prisma.group.create({
      data: { name: 'گروه سفارش همزمان-معتبر' },
    });
    const support = await prisma.user.findUniqueOrThrow({
      where: { username: 'e2e.order.support' },
    });
    await prisma.groupMembership.createMany({
      data: [
        {
          groupId: future.id,
          userId: employeeId,
          startedAt: new Date(now.getTime() + 60 * 60 * 1000),
        },
        {
          groupId: ended.id,
          userId: employeeId,
          startedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          endedAt: new Date(now.getTime() - 1000),
        },
        {
          groupId: supportGroup.id,
          userId: support.id,
          startedAt: new Date(now.getTime() - 60 * 60 * 1000),
        },
        {
          groupId: extra.id,
          userId: employeeId,
          startedAt: new Date(now.getTime() - 60 * 60 * 1000),
        },
      ],
    });
    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', supportCookie)
      .send({
        userId: employeeId,
        mealDate: mealDate(2),
        mealType: MealType.LUNCH,
        menuItemId: day2Lunch,
      });
    expect(created.status).toBe(201);
    const names = created.body.currentCycle.groups.map(
      (group: { groupNameSnapshot: string }) => group.groupNameSnapshot,
    );
    expect(names).toEqual(
      expect.arrayContaining(['گروه سفارش ب', 'گروه سفارش همزمان-معتبر']),
    );
    expect(names).not.toContain('گروه سفارش آینده');
    expect(names).not.toContain('گروه سفارش پایان‌یافته');
    expect(names).not.toContain('گروه سفارش پشتیبان');
    await prisma.group.update({
      where: { id: future.id },
      data: { name: 'گروه سفارش آینده-تغییر' },
    });
    await prisma.groupMembership.updateMany({
      where: { userId: employeeId, groupId: extra.id },
      data: { endedAt: new Date() },
    });
    const deadlineSwap = await request(app.getHttpServer())
      .put('/api/v1/order-deadline-policy')
      .set('Cookie', supportCookie)
      .send({
        items: [
          {
            mealType: MealType.LUNCH,
            relation: 'SAME_DAY',
            hour: 23,
            minute: 59,
          },
          {
            mealType: MealType.DINNER,
            relation: 'SAME_DAY',
            hour: 23,
            minute: 59,
          },
        ],
      });
    expect(deadlineSwap.status).toBe(200);
    const again = await request(app.getHttpServer())
      .get(`/api/v1/orders/${created.body.id as string}`)
      .set('Cookie', supportCookie);
    expect(again.body.currentCycle.groups).toEqual(
      created.body.currentCycle.groups,
    );
  });

  it('lets management read lunch, dinner, monthly filters and snapshots without mutating', async () => {
    const dinner = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', employeeCookie)
      .send({
        mealDate: mealDate(1),
        mealType: MealType.DINNER,
        menuItemId: dinnerA,
      });
    expect([201, 409]).toContain(dinner.status);

    const lunchReport = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({
        from: mealDate(1),
        to: mealDate(2),
        mealType: MealType.LUNCH,
        status: 'ACTIVE',
        page: 1,
        pageSize: 20,
      })
      .set('Cookie', managementCookie);
    expect(lunchReport.status).toBe(200);
    expect(Number.isInteger(lunchReport.body.total)).toBe(true);
    expect(lunchReport.body.total).toBeGreaterThanOrEqual(
      lunchReport.body.items.length,
    );
    expect(
      (lunchReport.body.items as Array<{ mealType: string }>).every(
        (row) => row.mealType === MealType.LUNCH,
      ),
    ).toBe(true);

    const dinnerReport = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({
        from: mealDate(1),
        to: mealDate(2),
        mealType: MealType.DINNER,
        status: 'ACTIVE',
        page: 1,
        pageSize: 20,
      })
      .set('Cookie', managementCookie);
    expect(dinnerReport.status).toBe(200);
    expect(
      (dinnerReport.body.items as Array<{ mealType: string }>).every(
        (row) => row.mealType === MealType.DINNER,
      ),
    ).toBe(true);

    const monthly = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({
        from: mealDate(1),
        to: mealDate(2),
        status: 'ACTIVE',
        page: 1,
        pageSize: 20,
      })
      .set('Cookie', managementCookie);
    expect(monthly.status).toBe(200);
    expect(monthly.body.total).toBeGreaterThan(0);

    const byBuilding = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({ buildingId, from: mealDate(1), to: mealDate(2), pageSize: 50 })
      .set('Cookie', managementCookie);
    expect(byBuilding.status).toBe(200);
    expect(
      (
        byBuilding.body.items as Array<{
          currentCycle?: { buildingIdSnapshot: string | null };
        }>
      ).every(
        (row) => row.currentCycle?.buildingIdSnapshot === buildingId,
      ),
    ).toBe(true);

    const byEmployee = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({ userId: employeeId, from: mealDate(1), to: mealDate(2), pageSize: 50 })
      .set('Cookie', managementCookie);
    expect(byEmployee.status).toBe(200);
    expect(
      (byEmployee.body.items as Array<{ userId: string }>).every(
        (row) => row.userId === employeeId,
      ),
    ).toBe(true);

    const byGroup = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({ groupId, from: mealDate(1), to: mealDate(2), pageSize: 50 })
      .set('Cookie', managementCookie);
    expect(byGroup.status).toBe(200);
    expect(byGroup.body.items.length).toBeGreaterThan(0);

    const sample = monthly.body.items[0] as {
      id: string;
      currentCycle: {
        usernameSnapshot: string;
        buildingNameSnapshot: string;
        groups: Array<{ groupNameSnapshot: string }>;
      };
    };
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${sample.id}`)
      .set('Cookie', managementCookie);
    expect(detail.status).toBe(200);
    expect(detail.body.currentCycle.usernameSnapshot).toBe(
      sample.currentCycle.usernameSnapshot,
    );
    expect(detail.body.currentCycle.buildingNameSnapshot).toBe(
      sample.currentCycle.buildingNameSnapshot,
    );
    expect(detail.body.currentCycle.groups).toEqual(
      sample.currentCycle.groups,
    );

    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/ratings')
          .set('Cookie', managementCookie)
      ).status,
    ).toBe(200);

    const overviewLunch = await request(app.getHttpServer())
      .get('/api/v1/orders')
      .query({
        from: mealDate(1),
        to: mealDate(2),
        mealType: MealType.LUNCH,
        status: 'ACTIVE',
        page: 1,
        pageSize: 1,
      })
      .set('Cookie', managementCookie);
    expect(overviewLunch.status).toBe(200);
    expect(Number.isInteger(overviewLunch.body.total)).toBe(true);
    expect(overviewLunch.body.pageSize).toBe(1);
    expect(overviewLunch.body.items.length).toBeLessThanOrEqual(1);
    expect(overviewLunch.body.total).toBeGreaterThanOrEqual(
      overviewLunch.body.items.length,
    );

    const publishedMenu = await request(app.getHttpServer())
      .get(`/api/v1/published-menus/${YEAR}/${MONTH}`)
      .set('Cookie', managementCookie);
    expect(publishedMenu.status).toBe(200);
    const deadlines = await request(app.getHttpServer())
      .get('/api/v1/order-deadline-policy')
      .set('Cookie', managementCookie);
    expect(deadlines.status).toBe(200);
    expect(Array.isArray(deadlines.body)).toBe(true);
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/guest-orders')
          .set('Cookie', managementCookie)
      ).status,
    ).toBe(403);

    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/orders')
          .set('Cookie', managementCookie)
          .send({
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            menuItemId: lunchA,
          })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .patch(`/api/v1/orders/${sample.id}`)
          .set('Cookie', managementCookie)
          .send({ menuItemId: lunchB })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/v1/orders/${sample.id}/cancel`)
          .set('Cookie', managementCookie)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/guest-orders')
          .set('Cookie', managementCookie)
          .send({
            buildingId,
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            menuItemId: lunchA,
            quantity: 1,
          })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .put('/api/v1/order-deadline-policy')
          .set('Cookie', managementCookie)
          .send({ items: [] })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .put('/api/v1/meal-settings')
          .set('Cookie', managementCookie)
          .send({ items: [] })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/menus')
          .set('Cookie', managementCookie)
          .send({ year: YEAR, month: MONTH })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.getHttpServer())
          .put(`/api/v1/orders/me/${sample.id}/rating`)
          .set('Cookie', managementCookie)
          .send({ score: 5 })
      ).status,
    ).toBe(403);
  });

  it('writes complete before/after deadline policy audits and rejects incomplete payloads', async () => {
    const support = await prisma.user.findUniqueOrThrow({
      where: { username: 'e2e.order.support' },
    });
    const beforeCount = await prisma.auditLog.count({
      where: { action: 'ORDER_DEADLINE_POLICY_UPDATED' },
    });
    const updated = await request(app.getHttpServer())
      .put('/api/v1/order-deadline-policy')
      .set('Cookie', supportCookie)
      .send({
        items: [
          {
            mealType: MealType.LUNCH,
            relation: 'SAME_DAY',
            hour: 11,
            minute: 30,
          },
          {
            mealType: MealType.DINNER,
            relation: 'PREVIOUS_DAY',
            hour: 16,
            minute: 0,
          },
        ],
      });
    expect(updated.status).toBe(200);
    const failed = await request(app.getHttpServer())
      .put('/api/v1/order-deadline-policy')
      .set('Cookie', supportCookie)
      .send({
        items: [
          {
            mealType: MealType.LUNCH,
            relation: 'SAME_DAY',
            hour: 11,
            minute: 30,
          },
        ],
      });
    expect(failed.status).toBe(400);
    const audits = await prisma.auditLog.findMany({
      where: { action: 'ORDER_DEADLINE_POLICY_UPDATED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audits).toHaveLength(beforeCount + 1);
    const latest = audits[0];
    expect(latest.actorId).toBe(support.id);
    const afterState = latest.afterData as {
      policies: { mealType: string; relation: string; hour: number }[];
    };
    expect(afterState.policies).toHaveLength(2);
    await expect(
      prisma.auditLog.update({
        where: { id: latest.id },
        data: { action: 'TAMPER' },
      }),
    ).rejects.toThrow();

    const listed = await request(app.getHttpServer())
      .get('/api/v1/order-deadline-policy')
      .set('Cookie', supportCookie);
    expect(listed.body).toHaveLength(2);
  });

  it('keeps historical guest orders readable when the menu option cannot be resolved', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { username: 'e2e.order.admin' },
    });
    const legacy = await prisma.guestOrder.create({
      data: {
        buildingId,
        menuItemId: null,
        mealDate: utcDateFromGregorian(jalaliToGregorian(YEAR, MONTH, 1)!),
        mealType: MealType.LUNCH,
        quantity: 3,
        status: 'ACTIVE',
        buildingNameSnapshot: null,
        mealTitleSnapshot: null,
        createdBy: admin.id,
      },
    });
    await prisma.$executeRaw`
      UPDATE "guest_orders" AS g
      SET "buildingNameSnapshot" = b."name"
      FROM "buildings" AS b
      WHERE g."id" = ${legacy.id}::uuid AND g."buildingId" = b."id"
    `;
    await prisma.guestOrderHistory.create({
      data: {
        guestOrderId: legacy.id,
        actorId: admin.id,
        action: 'CREATED',
        beforeData: {},
        afterData: { legacy: true },
      },
    });
    const read = await request(app.getHttpServer())
      .get(`/api/v1/guest-orders/${legacy.id}`)
      .set('Cookie', adminCookie);
    expect(read.status).toBe(200);
    expect(read.body.menuItemId).toBeNull();
    expect(read.body.buildingNameSnapshot).toBe('e2e-order-main');
    expect(read.body.history).toHaveLength(1);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/guest-orders')
          .set('Cookie', adminCookie)
          .send({
            buildingId,
            mealDate: mealDate(1),
            mealType: MealType.LUNCH,
            menuItemId: '00000000-0000-0000-0000-000000000000',
            quantity: 1,
          })
      ).status,
    ).toBe(404);
    const created = await request(app.getHttpServer())
      .post('/api/v1/guest-orders')
      .set('Cookie', adminCookie)
      .send({
        buildingId,
        mealDate: mealDate(1),
        mealType: MealType.LUNCH,
        menuItemId: lunchA,
        quantity: 2,
      });
    expect(created.status).toBe(201);
    expect(created.body.menuItemId).toBe(lunchA);
    expect(created.body.mealTitleSnapshot).toBe('چلوکباب');
  });
});
