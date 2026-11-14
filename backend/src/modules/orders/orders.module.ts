import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GuestOrdersController } from './guests/guest-orders.controller';
import { GuestOrdersService } from './guests/guest-orders.service';
import { MealSettingsController } from './settings/meal-settings.controller';
import { MealSettingsService } from './settings/meal-settings.service';
import { OrderDeadlinesController } from './deadlines/order-deadlines.controller';
import { OrderDeadlinesService } from './deadlines/order-deadlines.service';
import { OrdersController } from './employee/orders.controller';
import { OrdersService } from './employee/orders.service';
import { RatingsController } from './ratings/ratings.controller';
import { RatingsService } from './ratings/ratings.service';

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
