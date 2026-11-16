import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import type { AuthUser } from '../../../common/types/auth-user';
import { UpsertDeadlinePolicyDto } from './dto/upsert-deadline-policy.dto';
import { OrderDeadlinesService } from './order-deadlines.service';

@ApiTags('order-deadline-policy')
@ApiCookieAuth()
@Controller('order-deadline-policy')
@UseGuards(AuthGuard, RolesGuard)
export class OrderDeadlinesController {
  constructor(private readonly deadlines: OrderDeadlinesService) {}

  @Get()
  @ApiOperation({ summary: 'سیاست عمومی مهلت ثبت سفارش ناهار و شام' })
  list() {
    return this.deadlines.listPolicy();
  }

  @Put()
  @Roles(Role.ADMIN, Role.SUPPORT)
  @ApiOperation({ summary: 'به‌روزرسانی سیاست مهلت ناهار و شام' })
  replace(
    @CurrentUser() actor: AuthUser,
    @Body() dto: UpsertDeadlinePolicyDto,
  ) {
    return this.deadlines.replacePolicy(actor, dto);
  }
}
