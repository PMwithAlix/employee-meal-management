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
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthUser } from '../../common/types/auth-user';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import { UpdateImportMealDto } from './dto/update-import-meal.dto';
import { CreateMenuDto } from './dto/create-menu.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { ListMenusQueryDto } from './dto/list-menus.query';
import { UpsertMealDto } from './dto/upsert-meal.dto';
import { MenuImportService } from './import/menu-import.service';
import { MenusService } from './menus.service';

@ApiTags('menus')
@ApiCookieAuth()
@Controller('menus')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPPORT)
export class MenusController {
  constructor(
    private readonly menus: MenusService,
    private readonly imports: MenuImportService,
  ) {}

  @Post('imports/preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'اعتبارسنجی فایل اکسل و پیش‌نمایش اثر واردسازی' })
  preview(
    @CurrentUser() actor: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer) {
      throw new UnprocessableEntityException('فایل اکسل ارسال نشده است.');
    }
    return this.imports.preview(actor, file.buffer);
  }

  @Patch('imports/:importId')
  @ApiOperation({ summary: 'ویرایش یک وعده در پیش‌نمایش واردسازی اکسل' })
  updatePreviewMeal(
    @CurrentUser() actor: AuthUser,
    @Param('importId', ParseUUIDPipe) importId: string,
    @Body() dto: UpdateImportMealDto,
  ) {
    return this.imports.updateMeal(actor, importId, dto);
  }

  @Post('imports/:importId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تأیید واردسازی اکسل با سیاست جایگزینی' })
  confirm(
    @CurrentUser() actor: AuthUser,
    @Param('importId', ParseUUIDPipe) importId: string,
    @Body() dto: ConfirmImportDto,
  ) {
    return this.imports.confirm(actor, importId, dto.policy);
  }

  @Get()
  @ApiOperation({ summary: 'فهرست منوهای ماهانه' })
  list(@Query() query: ListMenusQueryDto) {
    return this.menus.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'ایجاد منوی ماهانه جلالی' })
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateMenuDto) {
    return this.menus.create(actor, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات منوی ماهانه' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.menus.get(id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'فهرست نسخه‌های منو' })
  listVersions(@Param('id', ParseUUIDPipe) id: string) {
    return this.menus.listVersions(id);
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'ایجاد نسخه پیش‌نویس' })
  createVersion(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVersionDto,
  ) {
    return this.menus.createVersion(actor, id, dto);
  }

  @Get(':id/versions/:versionId')
  @ApiOperation({ summary: 'جزئیات نسخه منو' })
  getVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.menus.getVersion(id, versionId);
  }

  @Patch(':id/versions/:versionId')
  @ApiOperation({ summary: 'ویرایش وعده در نسخه پیش‌نویس' })
  updateDraft(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: UpsertMealDto,
  ) {
    return this.menus.upsertMeal(actor, id, versionId, dto);
  }

  @Post(':id/versions/:versionId/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'انتشار اتمی نسخه پیش‌نویس' })
  publish(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.menus.publish(actor, id, versionId);
  }
}
