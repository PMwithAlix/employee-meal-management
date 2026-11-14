import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user';
import { BuildingsService } from './buildings.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

@ApiTags('buildings')
@ApiCookieAuth()
@Controller('buildings')
@UseGuards(AuthGuard, RolesGuard)
export class BuildingsController {
  constructor(private readonly buildings: BuildingsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'ایجاد ساختمان' })
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateBuildingDto) {
    return this.buildings.create(actor, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.HR, Role.SUPPORT, Role.MANAGEMENT)
  @ApiOperation({ summary: 'فهرست ساختمان‌ها' })
  list() {
    return this.buildings.list();
  }

  @Post(':id/deactivate')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'غیرفعال‌سازی ساختمان بدون کارمند فعال' })
  deactivate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.buildings.deactivate(actor, id);
  }

  @Post(':id/reactivate')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'فعال‌سازی مجدد ساختمان' })
  reactivate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.buildings.reactivate(actor, id);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.HR, Role.SUPPORT, Role.MANAGEMENT)
  @ApiOperation({ summary: 'جزئیات ساختمان' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.buildings.get(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'ویرایش نام ساختمان' })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBuildingDto,
  ) {
    return this.buildings.update(actor, id, dto);
  }
}
