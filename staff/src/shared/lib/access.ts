import { Role } from '../config/roles';

export const hasAccess = (role: Role | null, allowed: Role[]): boolean => {
  if (!role) {
    return false;
  }

  return allowed.includes(role);
};

export const isAdministrator = (role: Role | null): boolean => role === Role.Admin;
