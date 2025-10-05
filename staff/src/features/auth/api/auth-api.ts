import { AuthResponse, UserProfile } from "@/entities/user";
import { httpClient } from "@/shared/api/httpClient";

interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await httpClient.post<AuthResponse>("/auth/login/", payload);
    return data;
  },
  logout: async (): Promise<void> => {
    await httpClient.post("/auth/logout/");
  },
  me: async (): Promise<UserProfile> => {
    const { data } = await httpClient.get<UserProfile>("/auth/me/");
    return data;
  },
};
