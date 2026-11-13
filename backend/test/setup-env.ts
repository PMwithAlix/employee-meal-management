process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3000';
process.env.DATABASE_URL ??=
  'postgresql://khaan:khaan@localhost:5432/khaan?schema=public';
process.env.FRONTEND_ORIGIN ??= 'http://localhost:5173';
