import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import type { AuthUser } from '../../../common/types/auth-user';
import { ListRatingsQueryDto } from './dto/list-ratings.query';
import { UpsertRatingDto } from './dto/upsert-rating.dto';
import { RatingsService } from './ratings.service';

@ApiTags('ratings')
@ApiCookieAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Put('orders/me/:id/rating')
  @Roles(Role.EMPLOYEE, Role.HR, Role.SUPPORT, Role.ADMIN)
  @ApiOperation({ summary: 'ثبت یا ویرایش نظرسنجی سفارش خود' })
  upsertMine(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertRatingDto,
  ) {
    return this.ratings.upsertMine(actor, id, dto);
  }

  @Get('orders/me/:id/rating')
  @ApiOperation({ summary: 'مشاهده نظرسنجی سفارش خود' })
  getMine(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ratings.getMine(actor, id);
  }

  @Get('ratings')
  @Roles(Role.ADMIN, Role.SUPPORT, Role.MANAGEMENT)
  @ApiOperation({ summary: 'فهرست نظرسنجی‌ها برای نقش‌های مجاز' })
  list(@CurrentUser() actor: AuthUser, @Query() query: ListRatingsQueryDto) {
    return this.ratings.list(actor, query);
  }
}
