import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user';
import { UpsertMealSettingsDto } from './dto/upsert-meal-settings.dto';
import { MealSettingsService } from './meal-settings.service';

@ApiTags('meal-settings')
@ApiCookieAuth()
@Controller('meal-settings')
@UseGuards(AuthGuard, RolesGuard)
export class MealSettingsController {
  constructor(private readonly meals: MealSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'ساعت وعده‌های غذایی از تنظیمات سامانه' })
  list() {
    return this.meals.list();
  }

  @Put()
  @Roles(Role.ADMIN, Role.SUPPORT)
  @ApiOperation({ summary: 'به‌روزرسانی ساعت ناهار و شام' })
  replace(@CurrentUser() actor: AuthUser, @Body() dto: UpsertMealSettingsDto) {
    return this.meals.replace(actor, dto);
  }
}
