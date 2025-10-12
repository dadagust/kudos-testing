import { httpClient } from '@/shared/api/httpClient';

import {
  CustomerDetail,
  CustomerListQuery,
  CustomerListResponse,
  CustomerPayload,
} from '../model/types';

const sanitizeParams = (params: CustomerListQuery): Record<string, string | number> => {
  const entries = Object.entries(params).filter(([, value]) => {
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }
    return false;
  });

  return Object.fromEntries(entries) as Record<string, string | number>;
};

export const customersApi = {
  list: async (params: CustomerListQuery): Promise<CustomerListResponse> => {
    const { data } = await httpClient.get<CustomerListResponse>('/api/v1/customers/', {
      params: sanitizeParams(params),
    });
    return data;
  },
  retrieve: async (customerId: number): Promise<CustomerDetail> => {
    const { data } = await httpClient.get<CustomerDetail>(`/api/v1/customers/${customerId}/`);
    return data;
  },
  create: async (payload: CustomerPayload): Promise<CustomerDetail> => {
    const { data } = await httpClient.post<CustomerDetail>('/api/v1/customers/', payload);
    return data;
  },
  update: async (
    customerId: number,
    payload: Partial<CustomerPayload>
  ): Promise<CustomerDetail> => {
    const { data } = await httpClient.patch<CustomerDetail>(
      `/api/v1/customers/${customerId}/`,
      payload
    );
    return data;
  },
  remove: async (customerId: number): Promise<void> => {
    await httpClient.delete(`/api/v1/customers/${customerId}/`);
  },
};
