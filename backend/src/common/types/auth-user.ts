import { Role } from '@prisma/client';

export type AuthUser = {
  id: string;
  username: string;
  role: Role;
  buildingId: string | null;
  sessionId: string;
  sessionExpiresAt: Date;
};
