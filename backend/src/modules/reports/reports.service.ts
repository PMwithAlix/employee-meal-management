import { Injectable } from '@nestjs/common';
import { GuestOrderStatus, OrderCycleStatus } from '@prisma/client';
import {
  formatDateOnly,
  formatJalali,
  jalaliFromUtcDate,
} from '../../common/calendar/jalali';
import { parseGregorianDateOnly } from '../../common/calendar/iso-date';
import { PrismaService } from '../../database/prisma.service';
import { buildDailyReport } from './daily-report';
import { DailyReportQueryDto } from './dto/daily-report.query';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async daily(query: DailyReportQueryDto) {
    const mealDate = parseGregorianDateOnly(query.mealDate);
    const jalali = jalaliFromUtcDate(mealDate);
    const menu = jalali
      ? await this.prisma.menu.findUnique({
          where: { year_month: { year: jalali.year, month: jalali.month } },
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
              include: {
                items: {
                  where: { mealDate },
                  orderBy: [{ mealType: 'asc' }, { displayOrder: 'asc' }],
                },
              },
            },
          },
        })
      : null;
    const menuItems = menu?.versions[0]?.items ?? [];

    const [staffOrders, guestOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          mealDate,
          currentCycle: { status: OrderCycleStatus.ACTIVE },
        },
        include: {
          user: { select: { username: true } },
          currentCycle: true,
        },
      }),
      this.prisma.guestOrder.findMany({
        where: {
          mealDate,
          status: GuestOrderStatus.ACTIVE,
        },
      }),
    ]);

    return buildDailyReport({
      mealDate: formatDateOnly(mealDate),
      jalaliDate: jalali ? formatJalali(jalali) : null,
      generatedAt: new Date().toISOString(),
      menuItems: menuItems.map((item) => ({
        id: item.id,
        mealType: item.mealType,
        title: item.title,
        displayOrder: item.displayOrder,
      })),
      staffOrders: staffOrders.flatMap((order) => {
        const cycle = order.currentCycle;
        if (!cycle || cycle.status !== OrderCycleStatus.ACTIVE) return [];
        return [
          {
            id: order.id,
            userId: order.userId,
            mealType: order.mealType,
            username: cycle.usernameSnapshot || order.user.username,
            buildingId: cycle.buildingIdSnapshot,
            buildingName: cycle.buildingNameSnapshot,
            menuItemId: cycle.menuItemId,
            title: cycle.mealTitleSnapshot,
          },
        ];
      }),
      guestOrders: guestOrders.map((order) => ({
        id: order.id,
        mealType: order.mealType,
        buildingId: order.buildingId,
        buildingName: order.buildingNameSnapshot,
        menuItemId: order.menuItemId,
        title: order.mealTitleSnapshot ?? '',
        quantity: order.quantity,
        note: order.note,
      })),
    });
  }
}
