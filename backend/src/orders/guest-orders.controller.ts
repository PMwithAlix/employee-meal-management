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
import { CreateGuestOrderDto } from './dto/create-guest-order.dto';
import { ListGuestOrdersQueryDto } from './dto/list-guest-orders.query';
import { UpdateGuestOrderDto } from './dto/update-guest-order.dto';
import { GuestOrdersService } from './guest-orders.service';

@ApiTags('guest-orders')
@ApiCookieAuth()
@Controller('guest-orders')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPPORT)
export class GuestOrdersController {
  constructor(private readonly guests: GuestOrdersService) {}

  @Post()
  @ApiOperation({ summary: 'ثبت سفارش مهمان' })
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateGuestOrderDto) {
    return this.guests.create(actor, dto);
  }

  @Get()
  @ApiOperation({ summary: 'فهرست سفارش‌های مهمان' })
  list(@Query() query: ListGuestOrdersQueryDto) {
    return this.guests.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات سفارش مهمان' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.guests.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش سفارش مهمان' })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGuestOrderDto,
  ) {
    return this.guests.update(actor, id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'لغو سفارش مهمان' })
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.guests.cancel(actor, id);
  }
}
