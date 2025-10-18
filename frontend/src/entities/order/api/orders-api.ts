import { apiV1Client } from '@/shared/api/httpClient';

import {
  OrderCreatePayload,
  OrderDetailResponse,
  OrderListQuery,
  OrderListResponse,
  OrderUpdatePayload,
} from '../model/types';

const sanitizeListParams = (params: OrderListQuery): URLSearchParams => {
  const searchParams = new URLSearchParams();

  if (params.scope) {
    searchParams.set('scope', params.scope);
  }
  if (params.status) {
    searchParams.set('filter[status]', params.status);
  }
  if (params.customer) {
    searchParams.set('filter[customer]', params.customer);
  }
  if (params.search) {
    searchParams.set('search', params.search.trim());
  }

  return searchParams;
};

const pruneObject = (source: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (value === null) {
      result[key] = value;
      return;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return;
      }
      result[key] = trimmed;
      return;
    }

    if (Array.isArray(value)) {
      const prepared = value
        .map((item) => {
          if (item === undefined || item === null) {
            return undefined;
          }
          if (typeof item === 'string') {
            const trimmed = item.trim();
            return trimmed.length > 0 ? trimmed : undefined;
          }
          if (typeof item === 'object') {
            const nested = pruneObject(item as Record<string, unknown>);
            return Object.keys(nested).length > 0 ? nested : undefined;
          }
          return item;
        })
        .filter((item) => item !== undefined);
      if (prepared.length) {
        result[key] = prepared;
      }
      return;
    }

    if (typeof value === 'object') {
      const nested = pruneObject(value as Record<string, unknown>);
      if (Object.keys(nested).length > 0) {
        result[key] = nested;
      }
      return;
    }

    result[key] = value;
  });

  return result;
};

const normalizePayload = (payload: OrderCreatePayload | OrderUpdatePayload) =>
  pruneObject(payload as Record<string, unknown>);

export const ordersApi = {
  list: async (params: OrderListQuery): Promise<OrderListResponse> => {
    const { data } = await apiV1Client.get<OrderListResponse>('/orders/', {
      params: sanitizeListParams(params),
    });
    return data;
  },
  details: async (orderId: number): Promise<OrderDetailResponse> => {
    const { data } = await apiV1Client.get<OrderDetailResponse>(`/orders/${orderId}/`);
    return data;
  },
  create: async (payload: OrderCreatePayload): Promise<OrderDetailResponse> => {
    const normalized = normalizePayload(payload);
    const { data } = await apiV1Client.post<OrderDetailResponse>('/orders/', normalized);
    return data;
  },
  update: async (orderId: number, payload: OrderUpdatePayload): Promise<OrderDetailResponse> => {
    const normalized = normalizePayload(payload);
    const { data } = await apiV1Client.patch<OrderDetailResponse>(
      `/orders/${orderId}/`,
      normalized
    );
    return data;
  },
};

export type OrdersApi = typeof ordersApi;
