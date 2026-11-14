import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BootstrapAdminService } from '../modules/auth/bootstrap-admin.service';

async function bootstrapAdmin() {
  const logger = new Logger('BootstrapAdmin');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const bootstrap = app.get(BootstrapAdminService);
    const result = await bootstrap.ensureInitialAdmin({
      failIfUsersExist: true,
    });
    if (result === 'created') {
      logger.log('Initial ADMIN is ready.');
    }
  } finally {
    await app.close();
  }
}

void bootstrapAdmin().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Bootstrap failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
