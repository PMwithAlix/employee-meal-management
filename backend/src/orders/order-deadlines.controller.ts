import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user';
import { UpsertDeadlinesDto } from './dto/upsert-deadlines.dto';
import { OrderDeadlinesService } from './order-deadlines.service';

@ApiTags('order-deadlines')
@ApiCookieAuth()
@Controller('order-deadlines')
@UseGuards(AuthGuard, RolesGuard)
export class OrderDeadlinesController {
  constructor(private readonly deadlines: OrderDeadlinesService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست مهلت‌ها؛ فیلتر اختیاری سال و ماه جلالی' })
  list(@Query('year') year?: string, @Query('month') month?: string) {
    return this.deadlines.list(
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }

  @Get(':year/:month')
  @ApiOperation({ summary: 'مهلت‌های یک ماه جلالی' })
  listMonth(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.deadlines.listMonth(year, month);
  }

  @Put(':year/:month')
  @Roles(Role.ADMIN, Role.SUPPORT)
  @ApiOperation({ summary: 'جایگزینی مهلت‌های ناهار و شام یک ماه جلالی' })
  replace(
    @CurrentUser() actor: AuthUser,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body() dto: UpsertDeadlinesDto,
  ) {
    return this.deadlines.replaceMonth(actor, year, month, dto);
  }
}
