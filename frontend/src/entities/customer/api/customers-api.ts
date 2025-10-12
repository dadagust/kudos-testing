import { apiV1Client } from '@/shared/api/httpClient';

import {
  CustomerCreatePayload,
  CustomerDetailResponse,
  CustomerListQuery,
  CustomerListResponse,
} from '../model/types';

const sanitizeListParams = (params: CustomerListQuery): URLSearchParams => {
  const searchParams = new URLSearchParams();

  if (typeof params.page === 'number' && Number.isFinite(params.page)) {
    searchParams.set('page', params.page.toString());
  }

  if (typeof params.page_size === 'number' && Number.isFinite(params.page_size)) {
    searchParams.set('page_size', params.page_size.toString());
  }

  if (params.search?.trim()) {
    searchParams.set('search', params.search.trim());
  }

  if (params.sort?.trim()) {
    searchParams.set('sort', params.sort.trim());
  }

  if (params.email?.trim()) {
    searchParams.set('filter[email]', params.email.trim());
  }

  if (params.phone?.trim()) {
    searchParams.set('filter[phone]', params.phone.trim());
  }

  if (params.company_id?.trim()) {
    searchParams.set('filter[company_id]', params.company_id.trim());
  }

  if (params.tags?.length) {
    params.tags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .forEach((tag) => searchParams.append('filter[tag]', tag));
  }

  if (params.created_from?.trim()) {
    searchParams.set('filter[created_at][from]', params.created_from.trim());
  }

  if (params.created_to?.trim()) {
    searchParams.set('filter[created_at][to]', params.created_to.trim());
  }

  return searchParams;
};

const pruneObject = (source: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  Object.entries(source).forEach(([key, value]) => {
    if (value === undefined || value === null) {
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
        .map((item) => (typeof item === 'string' ? item.trim() : item))
        .filter((item) => {
          if (item === undefined || item === null) {
            return false;
          }
          if (typeof item === 'string') {
            return item.length > 0;
          }
          return true;
        });
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

const normalizePayload = (payload: CustomerCreatePayload) =>
  pruneObject(payload as unknown as Record<string, unknown>);

export const customersApi = {
  list: async (params: CustomerListQuery): Promise<CustomerListResponse> => {
    const { data } = await apiV1Client.get<CustomerListResponse>('/customers/', {
      params: sanitizeListParams(params),
    });
    return data;
  },
  details: async (customerId: string): Promise<CustomerDetailResponse> => {
    const { data } = await apiV1Client.get<CustomerDetailResponse>(`/customers/${customerId}/`);
    return data;
  },
  create: async (payload: CustomerCreatePayload): Promise<CustomerDetailResponse> => {
    const { data } = await apiV1Client.post<CustomerDetailResponse>(
      '/customers/',
      normalizePayload(payload)
    );
    return data;
  },
};

export type CustomersApi = typeof customersApi;
