const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/core';

const normalizeBaseUrl = (value: string) => value.replace(/\/$/, '');

const resolveApiRoot = (value: string) => {
  const normalized = normalizeBaseUrl(value);
  if (normalized.endsWith('/core')) {
    return normalized.slice(0, -'/core'.length);
  }
  return normalized;
};

const API_ROOT = resolveApiRoot(DEFAULT_API_URL);
const CORE_API_URL = `${API_ROOT}/core`;
const API_V1_URL = `${API_ROOT}/api/v1`;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  token?: string | null;
}

interface ApiErrorPayload {
  detail?: string;
  message?: string;
  [key: string]: unknown;
}

class ApiError extends Error {
  status: number;
  payload: ApiErrorPayload | null;

  constructor(status: number, message: string, payload: ApiErrorPayload | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const buildUrl = (base: string, path: string) => {
  if (!path.startsWith('/')) {
    return `${base}/${path}`;
  }
  return `${base}${path}`;
};

const performRequest = async <T>(
  baseUrl: string,
  path: string,
  { method = 'GET', headers = {}, body, token }: RequestOptions = {}
): Promise<T> => {
  const url = buildUrl(baseUrl, path);

  const requestHeaders: HeadersInit = {
    Accept: 'application/json',
    ...headers,
  };

  const requestInit: RequestInit = {
    method,
    headers: requestHeaders,
    credentials: 'include',
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    requestInit.body = JSON.stringify(body);
  }

  const response = await fetch(url, requestInit);

  const contentType = response.headers.get('Content-Type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      (payload && (payload.detail as string)) ||
      (payload && (payload.message as string)) ||
      `Запрос завершился с ошибкой ${response.status}`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
};

export interface AuthResponse {
  access: string;
  refresh: string;
  user: UserProfile;
}

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
}

export interface ProductSummary {
  id: string;
  name: string;
  base_price: number;
}

export interface ProductListResponse {
  data: ProductSummary[];
}

export interface CreateOrderPayload {
  installation_date: string;
  dismantle_date: string;
  delivery_type: 'delivery' | 'pickup';
  delivery_address?: string | null;
  comment?: string | null;
  items: Array<{ product: string; quantity: number }>;
  status?: 'new';
  customer_id?: string | null;
}

export interface OrderItem {
  id: number;
  product: string;
  product_label: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface OrderDetail {
  id: number;
  status: string;
  status_label: string;
  installation_date: string;
  dismantle_date: string;
  delivery_type: 'delivery' | 'pickup';
  delivery_address: string;
  comment: string;
  customer: { id: string; display_name: string } | null;
  items: OrderItem[];
}

export interface OrderDetailResponse {
  data: OrderDetail;
}

export const authApi = {
  login: (email: string, password: string) =>
    performRequest<AuthResponse>(CORE_API_URL, '/auth/login/', {
      method: 'POST',
      body: { email, password },
    }),
  logout: (token: string) =>
    performRequest<void>(CORE_API_URL, '/auth/logout/', {
      method: 'POST',
      token,
    }),
  me: (token: string) =>
    performRequest<UserProfile>(CORE_API_URL, '/auth/me/', {
      method: 'GET',
      token,
    }),
};

export const productsApi = {
  list: async (token: string | null) => {
    try {
      const response = await performRequest<ProductListResponse>(CORE_API_URL, '/products', {
        method: 'GET',
        token,
      });
      return response.data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Fallback to products provided by the orders endpoint metadata (OPTIONS request)
        const metadata = await performRequest<Record<string, unknown>>(API_V1_URL, '/order/', {
          method: 'OPTIONS',
          token,
        });

        const actions = metadata?.actions as Record<string, unknown> | undefined;
        const postConfig = (actions?.POST ?? actions?.post) as Record<string, unknown> | undefined;
        const itemsField = (postConfig?.items as Record<string, unknown> | undefined) ?? null;
        const child = (itemsField?.child as Record<string, unknown> | undefined) ?? null;
        const choices = (child?.choices as Array<Record<string, unknown>> | undefined) ?? [];

        return choices
          .map((choice) => ({
            id: String(choice.value ?? choice.key ?? ''),
            name: String(choice.display_name ?? choice.display ?? choice.label ?? choice.value ?? ''),
            base_price: Number(choice.price ?? 0) || 0,
          }))
          .filter((item) => item.id.length > 0 && item.name.length > 0);
      }
      throw error;
    }
  },
};

export const ordersApi = {
  create: (payload: CreateOrderPayload, token: string) =>
    performRequest<OrderDetailResponse>(API_V1_URL, '/order/', {
      method: 'POST',
      body: payload,
      token,
    }),
};

export { ApiError };
