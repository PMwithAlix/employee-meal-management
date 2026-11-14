import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MenuExcelParser } from './import/menu-excel.parser';
import { MenuImportService } from './import/menu-import.service';
import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';
import { PublishedMenusController } from './published-menus.controller';

@Module({
  imports: [AuthModule],
  controllers: [MenusController, PublishedMenusController],
  providers: [MenusService, MenuImportService, MenuExcelParser],
  exports: [MenusService],
})
export class MenusModule {}
