import { PermissionCode } from '@/shared/config/permissions';
import { Role } from '@/shared/config/roles';

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  avatar?: string | null;
  permissions: PermissionCode[];
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: UserProfile;
}
