import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { GuestOrderStatus, MealType, OrderCycleStatus } from '@prisma/client';
import {
  datesInJalaliMonth,
  formatDateOnly,
  formatJalali,
  JALALI_MONTHS,
  jalaliFromUtcDate,
} from '../../common/calendar/jalali';
import { parseGregorianDateOnly } from '../../common/calendar/iso-date';
import { PrismaService } from '../../database/prisma.service';
import { buildDailyReport } from './daily-report';
import { DailyReportQueryDto } from './dto/daily-report.query';
import { MonthlyReportQueryDto } from './dto/monthly-report.query';
import { buildMonthlyReport } from './monthly-report';
import { buildMonthlyWorkbook, monthlyWorkbookFilename } from './monthly-workbook';
import { itemsFromCurrentMenu } from './published-menu';
import type { ReportMealFilter } from './report-common';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async daily(query: DailyReportQueryDto) {
    const mealDate = parseGregorianDateOnly(query.mealDate);
    const jalali = jalaliFromUtcDate(mealDate);
    const meal = query.meal ?? 'ALL';
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
    const loaded = await this.loadActiveOrders(mealDate, mealDate, meal);
    return buildDailyReport({
      mealDate: formatDateOnly(mealDate),
      jalaliDate: jalali ? formatJalali(jalali) : null,
      generatedAt: new Date().toISOString(),
      meal,
      menuItems: itemsFromCurrentMenu(menu).map((item) => ({
        id: item.id,
        mealType: item.mealType,
        title: item.title,
        displayOrder: item.displayOrder,
      })),
      staffOrders: loaded.staffOrders,
      guestOrders: loaded.guestOrders,
    });
  }

  async monthly(query: MonthlyReportQueryDto) {
    const days = datesInJalaliMonth(query.year, query.month);
    if (days.length === 0) {
      throw new UnprocessableEntityException('ماه جلالی نامعتبر است.');
    }
    const from = days[0].utc;
    const to = days[days.length - 1].utc;
    const meal = query.meal ?? 'ALL';
    const menu = await this.prisma.menu.findUnique({
      where: { year_month: { year: query.year, month: query.month } },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            items: {
              orderBy: [{ mealType: 'asc' }, { displayOrder: 'asc' }],
            },
          },
        },
      },
    });
    const loaded = await this.loadActiveOrders(from, to, meal);
    return buildMonthlyReport({
      year: query.year,
      month: query.month,
      monthLabel: `${JALALI_MONTHS[query.month - 1]} ${query.year}`,
      generatedAt: new Date().toISOString(),
      meal,
      menuItems: itemsFromCurrentMenu(menu).map((item) => ({
        id: item.id,
        mealType: item.mealType,
        title: item.title,
      })),
      staffOrders: loaded.staffOrders,
      guestOrders: loaded.guestOrders,
    });
  }

  async monthlyExcel(query: MonthlyReportQueryDto) {
    const report = await this.monthly(query);
    const buffer = await buildMonthlyWorkbook(report);
    return {
      buffer,
      filename: monthlyWorkbookFilename(report),
      downloadName: `گزارش-ماهانه-${report.monthLabel}-${report.mealLabel}.xlsx`,
    };
  }

  private async loadActiveOrders(
    from: Date,
    to: Date,
    meal: ReportMealFilter,
  ) {
    const mealDate = from.getTime() === to.getTime()
      ? from
      : { gte: from, lte: to };
    const mealType = meal === 'ALL' ? undefined : (meal as MealType);
    const [staffOrders, guestOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          mealDate,
          currentCycle: { status: OrderCycleStatus.ACTIVE },
          ...(mealType ? { mealType } : {}),
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
          ...(mealType ? { mealType } : {}),
        },
      }),
    ]);
    return {
      staffOrders: staffOrders.flatMap((order) => {
        const cycle = order.currentCycle;
        if (!cycle || cycle.status !== OrderCycleStatus.ACTIVE) return [];
        if (mealType && order.mealType !== mealType) return [];
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
      guestOrders: guestOrders.flatMap((order) => {
        if (mealType && order.mealType !== mealType) return [];
        return [
          {
            id: order.id,
            mealType: order.mealType,
            buildingId: order.buildingId,
            buildingName: order.buildingNameSnapshot,
            menuItemId: order.menuItemId,
            title: order.mealTitleSnapshot ?? '',
            quantity: order.quantity,
            note: order.note,
          },
        ];
      }),
    };
  }
}
