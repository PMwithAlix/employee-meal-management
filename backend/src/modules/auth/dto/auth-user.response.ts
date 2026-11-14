import { Role } from '@prisma/client';

export class AuthUserResponse {
  id!: string;
  username!: string;
  role!: Role;
  buildingId!: string | null;
  expiresAt!: string;
}
