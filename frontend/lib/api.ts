const DEFAULT_CORE_PATH = '/core';
const DEFAULT_API_V1_PATH = '/api/v1';
export type OrderStatus = 'new' | 'reserved' | 'rented' | 'in_work' | 'archived' | 'declined';

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

const resolveApiUrls = (): { core: string; apiV1: string } => {
  const rawValue = process.env.NEXT_PUBLIC_API_URL;

  if (!rawValue) {
    return { core: DEFAULT_CORE_PATH, apiV1: DEFAULT_API_V1_PATH };
  }

  const normalized = normalizeBaseUrl(rawValue);
  const isAbsolute = /^https?:\/\//i.test(normalized);

  if (isAbsolute) {
    const apiRoot = resolveApiRoot(normalized);
    return {
      core: `${apiRoot}/core`,
      apiV1: `${apiRoot}/api/v1`,
    };
  }

  if (normalized.endsWith('/core')) {
    const prefix = normalized.slice(0, -'/core'.length);
    return {
      core: normalized,
      apiV1: prefix ? `${prefix}/api/v1` : DEFAULT_API_V1_PATH,
    };
  }

  if (normalized.endsWith('/api/v1')) {
    const prefix = normalized.slice(0, -'/api/v1'.length);
    return {
      core: `${prefix}/core`,
      apiV1: normalized,
    };
  }

  return {
    core: `${normalized}/core`,
    apiV1: `${normalized}/api/v1`,
  };
};

const { core: CORE_API_URL, apiV1: API_V1_URL } = resolveApiUrls();

const DEFAULT_BACKEND_ORIGIN = 'http://localhost:8000';

const detectBackendOrigin = () => {
  const rawValue = process.env.KUDOS_BACKEND_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL;

  if (!rawValue) {
    return DEFAULT_BACKEND_ORIGIN;
  }

  const normalized = normalizeBaseUrl(rawValue);
  const isAbsolute = /^https?:\/\//i.test(normalized);

  if (!isAbsolute) {
    return DEFAULT_BACKEND_ORIGIN;
  }

  return resolveApiRoot(normalized);
};

const BACKEND_ORIGIN = detectBackendOrigin();

const resolveMediaUrl = (value?: string | null) => {
  const normalized = (value ?? '').trim();

  if (!normalized) {
    return '';
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (normalized.startsWith('/media/')) {
    return `${BACKEND_ORIGIN}${normalized}`;
  }

  if (normalized.startsWith('media/')) {
    return `${BACKEND_ORIGIN}/${normalized}`;
  }

  return normalized;
};

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
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
  { method = 'GET', headers = {}, body, token, signal }: RequestOptions = {}
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

  if (signal) {
    requestInit.signal = signal;
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
  available_stock_qty: number;
  stock_qty: number;
}

export interface ProductListResponse {
  data: ProductSummary[];
}

export interface YandexSuggestItem {
  title: string;
  subtitle?: string;
  value: string;
  uri?: string;
}

export interface CatalogueCategory {
  id: string;
  name: string;
  slug: string;
  image: string | null;
}

export type NewArrivalType = 'product' | 'group';

export interface NewArrivalVariant {
  id: string;
  name?: string;
  color_name: string;
  color_value: string;
  image: string;
  slug?: string | null;
}

export interface NewArrivalItem {
  id: string;
  type: NewArrivalType;
  name: string;
  price_rub: number;
  image?: string | null;
  slug?: string | null;
  variants?: NewArrivalVariant[];
}

export interface CreateOrderPayload {
  status: OrderStatus;
  installation_date: string;
  mount_datetime_from: string | null;
  mount_datetime_to: string | null;
  dismantle_date: string;
  dismount_datetime_from: string | null;
  dismount_datetime_to: string | null;
  delivery_type: 'delivery' | 'pickup';
  delivery_address?: string | null;
  comment?: string | null;
  items: Array<{ product_id: string; quantity: number }>;
}

export interface OrderItem {
  id: number;
  product: string | null;
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
  mount_datetime_from: string | null;
  mount_datetime_to: string | null;
  dismantle_date: string;
  dismount_datetime_from: string | null;
  dismount_datetime_to: string | null;
  delivery_type: 'delivery' | 'pickup';
  delivery_address: string;
  comment: string;
  customer: { id: string; display_name: string; phone: string } | null;
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
      const response = await performRequest<ProductListResponse>(CORE_API_URL, '/products/', {
        method: 'GET',
        token,
      });
      return (response.data ?? []).map((item) => ({
        ...item,
        base_price: Number(item.base_price ?? item.base_price ?? 0) || 0,
        available_stock_qty: Number(item.available_stock_qty ?? 0) || 0,
        stock_qty: Number(item.stock_qty ?? 0) || 0,
      }));
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
            name: String(
              choice.display_name ?? choice.display ?? choice.label ?? choice.value ?? ''
            ),
            base_price: Number(choice.price ?? 0) || 0,
            available_stock_qty: Number(choice.available_stock_qty ?? choice.available ?? 0) || 0,
            stock_qty: Number(choice.stock_qty ?? choice.total ?? 0) || 0,
          }))
          .filter((item) => item.id.length > 0 && item.name.length > 0);
      }
      throw error;
    }
  },
};

export const catalogueApi = {
  list: async (): Promise<CatalogueCategory[]> => {
    const response = await performRequest<{ data?: CatalogueCategory[] }>(
      CORE_API_URL,
      '/catalogue/',
      {
        method: 'GET',
      }
    );

    return response.data ?? [];
  },
};

const normalizeNewArrivalVariant = (value: unknown): NewArrivalVariant | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const variant = value as Record<string, unknown>;
  const id = variant.id ?? variant.slug;
  const color = (variant.color ?? null) as Record<string, unknown> | null;

  if (!id) {
    return null;
  }

  return {
    id: String(id),
    name: String(
      variant.name ?? (typeof color?.name === 'string' ? color.name : '') ?? '',
    ),
    color_name: String(
      variant.color_name ?? (typeof color?.name === 'string' ? color.name : '') ?? '',
    ),
    color_value: String(
      variant.color_value ?? (typeof color?.value === 'string' ? color.value : '') ?? variant.value ?? '',
    ),
    image: resolveMediaUrl((variant.image ?? variant.image_url) as string | null | undefined),
    slug: (variant.slug ?? variant.url) as string | null | undefined,
  };
};

const normalizeNewArrivalItem = (value: unknown): NewArrivalItem | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rawId = record.id ?? record.slug;
  const rawType = (record.item_type ?? record.type ?? record.kind) as string | undefined;

  if (!rawId || !rawType) {
    return null;
  }

  const type = rawType === 'group' ? 'group' : 'product';
  const variantsRaw = Array.isArray(record.variants)
    ? (record.variants as unknown[])
    : Array.isArray(record.products)
      ? (record.products as unknown[])
      : [];
  const variants = variantsRaw.map(normalizeNewArrivalVariant).filter(Boolean) as NewArrivalVariant[];

  return {
    id: String(rawId),
    type,
    name: String(record.name ?? ''),
    price_rub: Number(record.price_rub ?? record.price ?? 0) || 0,
    image: resolveMediaUrl(
      (record.image_url ?? record.image ?? record.preview_image ?? record.thumbnail_url) as
        | string
        | null
        | undefined,
    ),
    slug: (record.slug ?? record.url) as string | null | undefined,
    variants: variants.length > 0 ? variants : undefined,
  };
};

export const newArrivalsApi = {
  list: async (): Promise<NewArrivalItem[]> => {
    const response = await performRequest<{ data?: unknown }>(CORE_API_URL, '/products/new-items/', {
      method: 'GET',
    });

    const data = Array.isArray(response?.data) ? (response.data as unknown[]) : [];

    return data.map(normalizeNewArrivalItem).filter((item): item is NewArrivalItem => Boolean(item));
  },
};

export const yandexApi = {
  fetchAddressSuggestions: async (
    query: string,
    { token, signal }: { token: string | null; signal?: AbortSignal }
  ): Promise<YandexSuggestItem[]> => {
    const trimmed = query.trim();

    if (!trimmed || !token) {
      return [];
    }

    let response: { results?: unknown[] };
    try {
      response = await performRequest<{ results?: unknown[] }>(
        CORE_API_URL,
        `/ymaps/suggest/?q=${encodeURIComponent(trimmed)}`,
        {
          method: 'GET',
          token,
          signal,
        }
      );
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }

      if (error instanceof ApiError) {
        return [];
      }

      throw error;
    }

    const rawResults = Array.isArray(response?.results) ? (response.results as unknown[]) : [];
    const suggestions: YandexSuggestItem[] = [];

    for (const item of rawResults) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const record = item as Record<string, unknown>;
      const rawTitle = (record.title as string | { text?: string } | undefined) ?? '';
      const rawSubtitle = record.subtitle as string | { text?: string } | undefined;
      const rawAddress = record.address as
        | { formatted_address?: string; full_address?: string }
        | undefined;

      const title = typeof rawTitle === 'string' ? rawTitle : (rawTitle.text ?? '');
      const subtitle =
        typeof rawSubtitle === 'string' ? rawSubtitle : (rawSubtitle?.text ?? undefined);
      const formatted = rawAddress?.formatted_address ?? rawAddress?.full_address ?? title;
      const value = formatted || title;
      const uri = typeof record.uri === 'string' ? record.uri : undefined;

      if (!value) {
        continue;
      }

      suggestions.push({
        title: title || value,
        subtitle,
        value,
        uri,
      });
    }

    return suggestions;
  },
};

export const ordersApi = {
  create: (payload: CreateOrderPayload, token: string) =>
    performRequest<OrderDetailResponse>(CORE_API_URL, '/orders/', {
      method: 'POST',
      body: payload,
      token,
    }),
};

export { ApiError };

console.debug('CORE_API_URL=', CORE_API_URL);
console.debug('API_V1_URL=', API_V1_URL);
