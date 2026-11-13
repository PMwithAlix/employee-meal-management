import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { AddGroupMemberDto } from './dto/add-group-member.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@ApiCookieAuth()
@Controller('groups')
@UseGuards(AuthGuard, RolesGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'ایجاد گروه' })
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateGroupDto) {
    return this.groups.create(actor, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.HR, Role.SUPPORT)
  @ApiOperation({ summary: 'فهرست گروه‌ها' })
  list() {
    return this.groups.list();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.HR, Role.SUPPORT)
  @ApiOperation({ summary: 'جزئیات گروه' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.groups.get(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'ویرایش نام گروه' })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groups.update(actor, id, dto);
  }

  @Post(':id/deactivate')
  @Roles(Role.ADMIN, Role.HR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'غیرفعال‌سازی گروه و بستن عضویت‌های فعال' })
  deactivate(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.groups.deactivate(actor, id);
  }

  @Get(':id/members')
  @Roles(Role.ADMIN, Role.HR, Role.SUPPORT)
  @ApiOperation({ summary: 'اعضای فعال گروه' })
  members(@Param('id', ParseUUIDPipe) id: string) {
    return this.groups.members(id);
  }

  @Post(':id/members')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'افزودن کاربر به گروه' })
  addMember(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddGroupMemberDto,
  ) {
    return this.groups.addMember(actor, id, dto);
  }

  @Delete(':id/members/:userId')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'پایان عضویت فعال کاربر' })
  removeMember(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.groups.removeMember(actor, id, userId);
  }

  @Get(':id/memberships/history')
  @Roles(Role.ADMIN, Role.HR, Role.SUPPORT)
  @ApiOperation({ summary: 'تاریخچه عضویت‌های گروه' })
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.groups.history(id);
  }
}
