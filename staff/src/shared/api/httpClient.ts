import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

import { auditLogger } from '../lib/logger';
import { useAuthStore } from '../state/auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/core';

const normalizeBaseUrl = (value: string) => value.replace(/\/$/, '');

const resolveApiRoot = (value: string) => {
  const normalized = normalizeBaseUrl(value);
  if (normalized.endsWith('/core')) {
    return normalized.slice(0, -'/core'.length);
  }
  return normalized;
};

const API_ROOT = resolveApiRoot(API_URL);
const CORE_API_URL = `${API_ROOT}/core`;
const API_V1_URL = `${API_ROOT}/api/v1`;

type ExtendedAxiosRequestConfig = AxiosRequestConfig & { kudosTraceId?: string };

const createTraceId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `trace-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

interface CreateClientOptions {
  baseURL: string;
  withCredentials?: boolean;
  attachAuthToken?: boolean;
}

const attachInterceptors = (client: AxiosInstance, options: CreateClientOptions) => {
  client.interceptors.request.use((config) => {
    const traceId = createTraceId();
    (config as ExtendedAxiosRequestConfig).kudosTraceId = traceId;

    config.headers = config.headers ?? {};
    config.headers['X-Trace-Id'] = traceId;

    if (options.attachAuthToken) {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    const url = client.getUri(config);
    auditLogger.logRequest({ method: config.method, url, traceId });

    return config;
  });

  client.interceptors.response.use(
    (response) => {
      const extendedConfig = response.config as ExtendedAxiosRequestConfig;
      const traceId = extendedConfig.kudosTraceId ?? createTraceId();
      const url = client.getUri(response.config);

      auditLogger.logResponse({
        method: response.config.method,
        url,
        status: response.status,
        traceId,
      });

      return response;
    },
    (error) => {
      const config = error.config as ExtendedAxiosRequestConfig | undefined;
      const traceId = config?.kudosTraceId ?? createTraceId();
      const url = config ? client.getUri(config) : options.baseURL;
      const status = error.response?.status;

      auditLogger.logError({
        method: config?.method,
        url,
        status,
        traceId,
        message: error.message,
      });

      if (options.attachAuthToken && status === 401) {
        useAuthStore.getState().clearTokens();
      }

      return Promise.reject(error);
    }
  );
};

const createHttpClient = (options: CreateClientOptions) => {
  const instance = axios.create({
    baseURL: options.baseURL,
    withCredentials: options.withCredentials,
  });

  attachInterceptors(instance, options);

  return instance;
};

export const httpClient = createHttpClient({
  baseURL: CORE_API_URL,
  withCredentials: true,
  attachAuthToken: true,
});

export const mockClient = createHttpClient({
  baseURL: '/core',
});

export const apiV1Client = createHttpClient({
  baseURL: API_V1_URL,
  withCredentials: true,
  attachAuthToken: true,
});
