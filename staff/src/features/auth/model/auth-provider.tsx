'use client';

import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

import { UserProfile } from '@/entities/user';
import { refreshTokens } from '@/shared/api/httpClient';
import { Role } from '@/shared/config/roles';
import { useAuthStore } from '@/shared/state/auth-store';

import { authApi } from '../api/auth-api';

import { AuthContext, AuthStatus } from './auth-context';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const { accessToken, refreshToken, setTokens, clearTokens } = useAuthStore();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [isHydrated, setIsHydrated] = useState(useAuthStore.persist.hasHydrated());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isHydrated) {
      return;
    }

    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    return () => {
      unsubscribe();
    };
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!accessToken) {
      if (refreshToken) {
        let isActive = true;
        setStatus('loading');
        setIsReady(false);

        refreshTokens(refreshToken)
          .then((data) => {
            if (!isActive) {
              return;
            }

            setTokens(data.access, data.refresh);
            setUser(data.user);
          })
          .catch(() => {
            if (!isActive) {
              return;
            }

            clearTokens();
            setUser(null);
            setStatus('unauthenticated');
            setIsReady(true);
          });

        return () => {
          isActive = false;
        };
      }

      setUser(null);
      setStatus('unauthenticated');
      setIsReady(true);
      return;
    }

    let isActive = true;
    setStatus('loading');
    setIsReady(false);

    authApi
      .me()
      .then((profile) => {
        if (!isActive) {
          return;
        }

        setUser(profile);
        setStatus('authenticated');
        setIsReady(true);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        clearTokens();
        setUser(null);
        setStatus('unauthenticated');
        setIsReady(true);
      });

    return () => {
      isActive = false;
    };
  }, [accessToken, clearTokens, isHydrated, refreshToken, setTokens]);

  const handleLogin = useCallback(
    async (payload: { email: string; password: string }) => {
      setStatus('loading');
      setIsReady(false);

      try {
        const data = await authApi.login(payload);
        setTokens(data.access, data.refresh);
        setUser(data.user);
        setStatus('authenticated');
        setIsReady(true);
      } catch (error) {
        clearTokens();
        setStatus('unauthenticated');
        setIsReady(true);
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
      setIsReady(true);
    }
  }, [clearTokens]);

  const handleSetRole = useCallback(async (role: Role) => {
    setUser((prev) => (prev ? { ...prev, role } : prev));
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      ready: isReady,
      login: handleLogin,
      logout: handleLogout,
      setRole: handleSetRole,
    }),
    [user, status, isReady, handleLogin, handleLogout, handleSetRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
