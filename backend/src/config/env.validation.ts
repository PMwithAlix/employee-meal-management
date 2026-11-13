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
}

const defaultsFor = (config: Record<string, unknown>) => {
  const env =
    typeof config.NODE_ENV === 'string' ? config.NODE_ENV : 'development';
  const isTest = env === 'test';
  const isProduction = env === 'production';
  return {
    SESSION_TTL_SECONDS: isTest ? 3600 : 28800,
    SESSION_COOKIE_NAME: 'khaan.sid',
    SESSION_COOKIE_PATH: '/api/v1',
    SESSION_SAMESITE: SameSiteMode.Lax,
    SESSION_SECURE: isProduction,
    ARGON2_MEMORY_KIB: isTest ? 4096 : 19456,
    ARGON2_TIME_COST: isTest ? 1 : 2,
    ARGON2_PARALLELISM: 1,
    LOGIN_RATE_LIMIT_MAX: isTest ? 1000 : 5,
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: 900,
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

  return validated;
}
