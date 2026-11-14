import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { EnvironmentVariables, NodeEnv } from '../../config/env.validation';
import { PrismaService } from '../../database/prisma.service';
import { passwordIssue } from './password.policy';
import { PasswordService } from './password.service';
import { normalizeUsername, usernameIssue } from './security/username';

@Injectable()
export class BootstrapAdminService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async onModuleInit() {
    if (!this.config.get('BOOTSTRAP_ADMIN_ENABLED', { infer: true })) {
      return;
    }
    await this.ensureInitialAdmin();
  }

  async ensureInitialAdmin(options?: { failIfUsersExist?: boolean }) {
    const usernameRaw = this.config.get('BOOTSTRAP_ADMIN_USERNAME', {
      infer: true,
    });
    const password = this.config.get('BOOTSTRAP_ADMIN_PASSWORD', {
      infer: true,
    });
    const usernameError = usernameIssue(usernameRaw);
    if (usernameError) {
      throw new Error(usernameError);
    }
    const policy = passwordIssue(password);
    if (policy) {
      throw new Error(policy);
    }

    const existing = await this.prisma.user.count();
    if (existing > 0) {
      if (options?.failIfUsersExist) {
        throw new Error(
          'Bootstrap refused: users already exist. The first admin can only be created on an empty user table.',
        );
      }
      return 'skipped' as const;
    }

    const username = normalizeUsername(usernameRaw);
    const passwordHash = await this.passwords.hash(password);
    const admin = await this.prisma.user.create({
      data: {
        username,
        passwordHash,
        role: Role.ADMIN,
        buildingId: null,
      },
      select: { username: true },
    });
    this.logger.log(
      `Initial ADMIN created: ${admin.username}. Change this password from Settings after first login.`,
    );
    return 'created' as const;
  }
}
