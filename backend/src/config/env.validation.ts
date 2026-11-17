import { Transform, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';
import {
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
} from '../modules/auth/default-admin';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export enum SameSiteMode {
  Lax = 'lax',
  Strict = 'strict',
  None = 'none',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  FRONTEND_ORIGIN!: string;

  @IsInt()
  @Min(60)
  SESSION_TTL_SECONDS!: number;

  @IsString()
  @IsNotEmpty()
  SESSION_COOKIE_NAME!: string;

  @IsString()
  @IsNotEmpty()
  SESSION_COOKIE_PATH!: string;

  @IsEnum(SameSiteMode)
  SESSION_SAMESITE!: SameSiteMode;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  SESSION_SECURE!: boolean;

  @IsInt()
  @Min(1024)
  ARGON2_MEMORY_KIB!: number;

  @IsInt()
  @Min(1)
  ARGON2_TIME_COST!: number;

  @IsInt()
  @Min(1)
  ARGON2_PARALLELISM!: number;

  @IsInt()
  @Min(1)
  LOGIN_RATE_LIMIT_MAX!: number;

  @IsInt()
  @Min(60)
  LOGIN_RATE_LIMIT_WINDOW_SECONDS!: number;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (value === undefined || value === '') {
      return undefined;
    }
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  BOOTSTRAP_ADMIN_ENABLED!: boolean;

  @IsString()
  @IsNotEmpty()
  BOOTSTRAP_ADMIN_USERNAME!: string;

  @IsString()
  @IsNotEmpty()
  BOOTSTRAP_ADMIN_PASSWORD!: string;

  @Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  BALE_MINI_APP_ENABLED!: boolean;

  @IsString()
  BALE_BOT_TOKEN!: string;

  @IsString()
  @IsNotEmpty()
  BALE_API_BASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  BALE_MINI_APP_URL!: string;

  @IsString()
  BALE_WEBHOOK_URL!: string;

  @IsString()
  BALE_WEBHOOK_SECRET!: string;

  @IsInt()
  @Min(60)
  BALE_INIT_DATA_TTL_SECONDS!: number;
}

const defaultsFor = (config: Record<string, unknown>) => {
  const env =
    typeof config.NODE_ENV === 'string' ? config.NODE_ENV : 'development';
  const isTest = env === 'test';
  return {
    SESSION_TTL_SECONDS: isTest ? 3600 : 28800,
    SESSION_COOKIE_NAME: 'khaan.sid',
    SESSION_COOKIE_PATH: '/',
    SESSION_SAMESITE: SameSiteMode.Lax,
    SESSION_SECURE: false,
    ARGON2_MEMORY_KIB: isTest ? 4096 : 19456,
    ARGON2_TIME_COST: isTest ? 1 : 2,
    ARGON2_PARALLELISM: 1,
    LOGIN_RATE_LIMIT_MAX: isTest ? 1000 : 5,
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: 900,
    BOOTSTRAP_ADMIN_ENABLED: !isTest,
    BOOTSTRAP_ADMIN_USERNAME: DEFAULT_ADMIN_USERNAME,
    BOOTSTRAP_ADMIN_PASSWORD: DEFAULT_ADMIN_PASSWORD,
    BALE_MINI_APP_ENABLED: false,
    BALE_BOT_TOKEN: '',
    BALE_API_BASE_URL: 'https://tapi.bale.ai/bot',
    BALE_MINI_APP_URL: 'https://food.kavosh.site/mini-app',
    BALE_WEBHOOK_URL: '',
    BALE_WEBHOOK_SECRET: '',
    BALE_INIT_DATA_TTL_SECONDS: 86400,
  };
};

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(
    EnvironmentVariables,
    { ...defaultsFor(config), ...config },
    { enableImplicitConversion: true },
  );
  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: true,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  assertBaleRuntimeConfig(validated);
  return validated;
}

export function assertBaleRuntimeConfig(config: {
  BALE_MINI_APP_ENABLED: boolean;
  BALE_BOT_TOKEN: string;
  BALE_WEBHOOK_SECRET: string;
}) {
  if (!config.BALE_MINI_APP_ENABLED) {
    return;
  }
  if (!config.BALE_BOT_TOKEN.trim()) {
    throw new Error(
      'Invalid environment configuration: BALE_BOT_TOKEN is required when BALE_MINI_APP_ENABLED is true.',
    );
  }
  if (config.BALE_WEBHOOK_SECRET.trim().length < 16) {
    throw new Error(
      'Invalid environment configuration: BALE_WEBHOOK_SECRET is required when BALE_MINI_APP_ENABLED is true.',
    );
  }
}
