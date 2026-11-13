import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GuestOrdersController } from './guest-orders.controller';
import { GuestOrdersService } from './guest-orders.service';
import { OrderDeadlinesController } from './order-deadlines.controller';
import { OrderDeadlinesService } from './order-deadlines.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule],
  controllers: [
    OrdersController,
    GuestOrdersController,
    OrderDeadlinesController,
  ],
  providers: [OrdersService, GuestOrdersService, OrderDeadlinesService],
})
export class OrdersModule {}
