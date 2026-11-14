import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BootstrapAdminService } from './bootstrap-admin.service';
import { LoginRateLimiter } from './login-rate-limiter';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    LoginRateLimiter,
    BootstrapAdminService,
    AuthGuard,
    RolesGuard,
  ],
  exports: [
    PasswordService,
    SessionService,
    AuthGuard,
    RolesGuard,
    BootstrapAdminService,
  ],
})
export class AuthModule {}
