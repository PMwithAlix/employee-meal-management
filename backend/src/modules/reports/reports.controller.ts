import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DailyReportQueryDto } from './dto/daily-report.query';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiCookieAuth()
@Controller('reports')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPPORT, Role.MANAGEMENT)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('daily')
  @ApiOperation({ summary: 'گزارش سفارش‌های یک روز برای رستوران و ساختمان‌ها' })
  daily(@Query() query: DailyReportQueryDto) {
    return this.reports.daily(query);
  }
}
