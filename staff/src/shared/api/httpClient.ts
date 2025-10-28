import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

import { auditLogger } from '../lib/logger';
import { useAuthStore } from '../state/auth-store';

const DEFAULT_CORE_PATH = '/core';
const DEFAULT_API_V1_PATH = '/api/v1';
const DEFAULT_BACKEND_ORIGIN = 'http://localhost:8000';

const normalizeBaseUrl = (value: string) => value.replace(/\/$/, '');

const resolveApiRoot = (value: string) => {
  const normalized = normalizeBaseUrl(value);
  if (normalized.endsWith('/core')) {
    return normalized.slice(0, -'/core'.length);
  }
  if (normalized.endsWith('/api/v1')) {
    return normalized.slice(0, -'/api/v1'.length);
  }
  return normalized;
};

const looksLikeInternalHostname = (hostname: string) => {
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return false;
  }
  return !hostname.includes('.');
};

const shouldUseRelativeUrlsInBrowser = (value?: string | null) => {
  if (!value) {
    return true;
  }

  const normalized = normalizeBaseUrl(value);

  if (!normalized) {
    return true;
  }

  if (!/^https?:\/\//i.test(normalized)) {
    return false;
  }

  try {
    const url = new URL(normalized);
    return looksLikeInternalHostname(url.hostname);
  } catch (error) {
    return true;
  }
};

const resolveApiUrls = (rawValue?: string | null) => {
  if (!rawValue) {
    return {
      root: '',
      core: DEFAULT_CORE_PATH,
      apiV1: DEFAULT_API_V1_PATH,
    };
  }

  const normalized = normalizeBaseUrl(rawValue);

  if (!normalized) {
    return {
      root: '',
      core: DEFAULT_CORE_PATH,
      apiV1: DEFAULT_API_V1_PATH,
    };
  }

  const isAbsolute = /^https?:\/\//i.test(normalized);

  if (isAbsolute) {
    const apiRoot = resolveApiRoot(normalized);
    return {
      root: apiRoot,
      core: `${apiRoot}/core`,
      apiV1: `${apiRoot}/api/v1`,
    };
  }

  if (normalized.endsWith('/core')) {
    const prefix = normalized.slice(0, -'/core'.length);
    return {
      root: prefix,
      core: normalized,
      apiV1: prefix ? `${prefix}/api/v1` : DEFAULT_API_V1_PATH,
    };
  }

  if (normalized.endsWith('/api/v1')) {
    const prefix = normalized.slice(0, -'/api/v1'.length);
    return {
      root: prefix,
      core: `${prefix}/core`,
      apiV1: normalized,
    };
  }

  return {
    root: normalized,
    core: `${normalized}/core`,
    apiV1: `${normalized}/api/v1`,
  };
};

const resolveBrowserApiUrls = () => {
  const rawValue = process.env.NEXT_PUBLIC_API_URL;

  if (shouldUseRelativeUrlsInBrowser(rawValue)) {
    return resolveApiUrls(null);
  }

  return resolveApiUrls(rawValue);
};

const resolveServerApiUrls = () => {
  const rawValue =
    process.env.KUDOS_BACKEND_ORIGIN ??
    process.env.NEXT_PUBLIC_API_URL ??
    DEFAULT_BACKEND_ORIGIN;

  return resolveApiUrls(rawValue);
};

const { root: API_ROOT, core: CORE_API_URL, apiV1: API_V1_URL } =
  typeof window === 'undefined' ? resolveServerApiUrls() : resolveBrowserApiUrls();

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
