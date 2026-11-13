import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders.query';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiCookieAuth()
@Controller('orders')
@UseGuards(AuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'ثبت سفارش کارمند (خود یا توسط SUPPORT/ADMIN)' })
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(actor, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'سفارش‌های کاربر جاری' })
  listMine(@CurrentUser() actor: AuthUser, @Query() query: ListOrdersQueryDto) {
    return this.orders.listMine(actor, query);
  }

  @Get('me/:id')
  @ApiOperation({ summary: 'جزئیات سفارش کاربر جاری' })
  getMine(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.getMine(actor, id);
  }

  @Patch('me/:id')
  @ApiOperation({ summary: 'تغییر گزینه سفارش خود قبل از مهلت' })
  updateMine(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.orders.update(actor, id, dto, true);
  }

  @Post('me/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'لغو سفارش خود قبل از مهلت' })
  cancelMine(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.cancel(actor, id, true);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPPORT)
  @ApiOperation({ summary: 'فهرست سفارش‌های سازمان' })
  listManaged(@Query() query: ListOrdersQueryDto) {
    return this.orders.listManaged(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPPORT)
  @ApiOperation({ summary: 'جزئیات سفارش کارمند' })
  getManaged(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getManaged(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPPORT)
  @ApiOperation({ summary: 'ویرایش سفارش کارمند توسط SUPPORT/ADMIN' })
  updateManaged(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.orders.update(actor, id, dto, false);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.SUPPORT)
  @ApiOperation({ summary: 'لغو سفارش کارمند توسط SUPPORT/ADMIN' })
  cancelManaged(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orders.cancel(actor, id, false);
  }
}
