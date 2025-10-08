'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

import { UserProfile } from '@/entities/user';
import { Role } from '@/shared/config/roles';
import { useAuthStore } from '@/shared/state/auth-store';

import { authApi } from '../api/auth-api';

import { AuthContext, AuthStatus } from './auth-context';

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const queryClient = useQueryClient();
  const { accessToken, setTokens, clearTokens } = useAuthStore();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    enabled: Boolean(accessToken),
    retry: false,
  });

  useEffect(() => {
    if (!accessToken) {
      setUser(null);
      setStatus('unauthenticated');
      queryClient.removeQueries({ queryKey: ['auth', 'me'] });
      return;
    }

    if (meQuery.isLoading) {
      setStatus('loading');
      return;
    }

    if (meQuery.isError) {
      clearTokens();
      setUser(null);
      setStatus('unauthenticated');
      return;
    }

    if (meQuery.data) {
      setUser(meQuery.data);
      setStatus('authenticated');
    }
  }, [accessToken, meQuery.data, meQuery.isError, meQuery.isLoading, clearTokens, queryClient]);

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setTokens(data.access, data.refresh);
      setUser(data.user);
      setStatus('authenticated');
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
    onError: () => {
      clearTokens();
      setStatus('unauthenticated');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearTokens();
      setUser(null);
      setStatus('unauthenticated');
      queryClient.removeQueries({ queryKey: ['auth'] });
    },
  });

  const handleLogin = useCallback(
    async (payload: { email: string; password: string }) => {
      setStatus('loading');
      await loginMutation.mutateAsync(payload);
    },
    [loginMutation]
  );

  const handleLogout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const handleSetRole = useCallback(
    async (role: Role) => {
      if (!user) {
        return;
      }

      const updatedUser: UserProfile = { ...user, role };
      setUser(updatedUser);
      queryClient.setQueryData(['auth', 'me'], updatedUser);
    },
    [user, queryClient]
  );

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
