import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthUser } from '../../common/types/auth-user';
import { BaleService } from './bale.service';
import { BaleLoginDto } from './dto/bale-login.dto';

@ApiTags('bale')
@Controller('bale')
@UseGuards(AuthGuard, RolesGuard)
export class BaleController {
  constructor(private readonly bale: BaleService) {}

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'وضعیت فعال‌بودن مینی‌اپ بله بدون افشای Secret' })
  status() {
    return this.bale.status();
  }

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ورود خوان پس از اعتبارسنجی initData بله' })
  login(
    @Body() dto: BaleLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.bale.login(dto, request, response);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'دریافت آپدیت بازوی بله' })
  webhook(
    @Body() body: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.bale.handleWebhook(body, headers);
  }

  @Get('webhook/info')
  @Roles(Role.ADMIN)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'اطلاعات وب‌هوک بله برای ادمین' })
  webhookInfo() {
    return this.bale.webhookInfo();
  }

  @Post('webhook/sync')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'ثبت وب‌هوک بله از روی متغیرهای محیطی' })
  syncWebhook(@CurrentUser() actor: AuthUser) {
    return this.bale.syncWebhook(actor);
  }
}
