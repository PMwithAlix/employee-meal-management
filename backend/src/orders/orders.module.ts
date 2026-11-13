import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GuestOrdersController } from './guest-orders.controller';
import { GuestOrdersService } from './guest-orders.service';
import { MealSettingsController } from './meal-settings.controller';
import { MealSettingsService } from './meal-settings.service';
import { OrderDeadlinesController } from './order-deadlines.controller';
import { OrderDeadlinesService } from './order-deadlines.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [AuthModule],
  controllers: [
    OrdersController,
    GuestOrdersController,
    OrderDeadlinesController,
    MealSettingsController,
    RatingsController,
  ],
  providers: [
    OrdersService,
    GuestOrdersService,
    OrderDeadlinesService,
    MealSettingsService,
    RatingsService,
  ],
})
export class OrdersModule {}
