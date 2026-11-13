import type { AuthUser } from '../common/types/auth-user';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export {};
