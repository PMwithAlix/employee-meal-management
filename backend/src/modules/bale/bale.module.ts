import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MenusModule } from '../menus/menus.module';
import { OrdersModule } from '../orders/orders.module';
import { BaleApiClient } from './bale-api.client';
import { BaleController } from './bale.controller';
import { BaleLinkStore } from './bale.links';
import { BaleService } from './bale.service';

@Module({
  imports: [AuthModule, OrdersModule, MenusModule],
  controllers: [BaleController],
  providers: [BaleService, BaleApiClient, BaleLinkStore],
})
export class BaleModule {}
