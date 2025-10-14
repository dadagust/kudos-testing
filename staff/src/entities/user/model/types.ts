import { AdminSection, Role } from '@/shared/config/roles';

export type AccessMatrix = Record<AdminSection, boolean>;

export interface UserProfile {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  avatar?: string | null;
  access: AccessMatrix;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: UserProfile;
}
