import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AppModule } from '../app.module';
import { normalizeUsername, usernameIssue } from '../modules/auth/security/username';
import { passwordIssue } from '../modules/auth/password.policy';
import { PasswordService } from '../modules/auth/password.service';
import { PrismaService } from '../database/prisma.service';

async function bootstrapAdmin() {
  const logger = new Logger('BootstrapAdmin');
  const usernameRaw = process.env.BOOTSTRAP_ADMIN_USERNAME ?? '';
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
  const usernameError = usernameIssue(usernameRaw);
  if (usernameError) {
    throw new Error(
      'BOOTSTRAP_ADMIN_USERNAME is missing or invalid. Set a normalized English username in the environment.',
    );
  }
  if (passwordIssue(password)) {
    throw new Error(
      'BOOTSTRAP_ADMIN_PASSWORD does not meet the password policy.',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const prisma = app.get(PrismaService);
    const passwords = app.get(PasswordService);
    const existing = await prisma.user.count();
    if (existing > 0) {
      throw new Error(
        'Bootstrap refused: users already exist. The first admin can only be created on an empty user table.',
      );
    }

    const username = normalizeUsername(usernameRaw);
    const passwordHash = await passwords.hash(password);
    const admin = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: Role.ADMIN,
        buildingId: null,
      },
      select: { id: true, username: true, role: true },
    });
    logger.log(`Initial ADMIN created: ${admin.username}`);
  } finally {
    await app.close();
  }
}

void bootstrapAdmin().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Bootstrap failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
