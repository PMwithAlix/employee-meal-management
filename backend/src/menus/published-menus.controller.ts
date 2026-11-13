import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { MenusService } from './menus.service';

@ApiTags('published-menus')
@ApiCookieAuth()
@Controller('published-menus')
@UseGuards(AuthGuard, RolesGuard)
export class PublishedMenusController {
  constructor(private readonly menus: MenusService) {}

  @Get(':year/:month')
  @ApiOperation({ summary: 'منوی منتشرشده ماه جلالی برای سفارش' })
  get(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.menus.getPublished(year, month);
  }
}
