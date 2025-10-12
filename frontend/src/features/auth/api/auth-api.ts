import { AuthResponse, UserProfile } from '@/entities/user';
import { httpClient } from '@/shared/api/httpClient';

interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await httpClient.post<AuthResponse>('/core/auth/login/', payload);
    return data;
  },
  logout: async (): Promise<void> => {
    await httpClient.post('/core/auth/logout/');
  },
  me: async (): Promise<UserProfile> => {
    const { data } = await httpClient.get<UserProfile>('/core/auth/me/');
    return data;
  },
};
