'use client';

import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

import { UserProfile } from '@/entities/user';
import { Role } from '@/shared/config/roles';
import { useAuthStore } from '@/shared/state/auth-store';

import { authApi } from '../api/auth-api';

import { AuthContext, AuthStatus } from './auth-context';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const { accessToken, setTokens, clearTokens } = useAuthStore();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    if (!accessToken) {
      setUser(null);
      setStatus('unauthenticated');
      return;
    }

    let isActive = true;
    setStatus('loading');

    authApi
      .me()
      .then((profile) => {
        if (!isActive) {
          return;
        }

        setUser(profile);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        clearTokens();
        setUser(null);
        setStatus('unauthenticated');
      });

    return () => {
      isActive = false;
    };
  }, [accessToken, clearTokens]);

  const handleLogin = useCallback(
    async (payload: { email: string; password: string }) => {
      setStatus('loading');

      try {
        const data = await authApi.login(payload);
        setTokens(data.access, data.refresh);
        setUser(data.user);
        setStatus('authenticated');
      } catch (error) {
        clearTokens();
        setStatus('unauthenticated');
        throw error;
      }
    },
    [clearTokens, setTokens]
  );

  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearTokens();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [clearTokens]);

  const handleSetRole = useCallback(async (role: Role) => {
    setUser((prev) => (prev ? { ...prev, role } : prev));
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      login: handleLogin,
      logout: handleLogout,
      setRole: handleSetRole,
    }),
    [user, status, handleLogin, handleLogout, handleSetRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
