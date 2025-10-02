"use client";

import { ReactNode } from "react";

import { Role } from "@/shared/config/roles";
import { Alert } from "@/shared/ui";

import { useAuth } from "../hooks/use-auth";

interface RoleGuardProps {
  allow: Role[];
  fallback?: ReactNode;
  children: ReactNode;
}

export const RoleGuard = ({ allow, fallback, children }: RoleGuardProps) => {
  const { user } = useAuth();

  if (!user || !allow.includes(user.role)) {
    return (fallback ?? (
      <Alert title="Недостаточно прав" tone="danger">
        Для просмотра раздела необходима другая роль.
      </Alert>
    )) as ReactNode;
  }

  return <>{children}</>;
};
