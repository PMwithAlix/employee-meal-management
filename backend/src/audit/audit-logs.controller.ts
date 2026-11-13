import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query';

@ApiTags('audit-logs')
@ApiCookieAuth()
@Controller('audit-logs')
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPPORT)
export class AuditLogsController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'فهرست فقط‌خواندنی تاریخچه فعالیت‌ها' })
  list(@Query() query: ListAuditLogsQueryDto) {
    return this.audit.list(query);
  }
}
