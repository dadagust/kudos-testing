"use client";

import { createContext, useContext } from "react";

import { UserProfile } from "@/entities/user";
import { Role } from "@/shared/config/roles";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  user: UserProfile | null;
  status: AuthStatus;
  login: (payload: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  setRole: (role: Role) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuthContext = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("AuthContext is not provided");
  }

  return context;
};
