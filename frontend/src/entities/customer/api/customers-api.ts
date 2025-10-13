import { apiV1Client } from '@/shared/api/httpClient';

import {
  CreateCustomerPayload,
  CustomerDetailResponse,
  CustomerListQuery,
  CustomerListResponse,
  UpdateCustomerPayload,
} from '../model/types';

const buildListParams = (params: CustomerListQuery) => {
  const searchParams = new URLSearchParams();

  if (params.search) {
    searchParams.set('search', params.search.trim());
  }

  if (params.sort) {
    searchParams.set('sort', params.sort);
  }

  if (params.page) {
    searchParams.set('page', String(params.page));
  }

  if (params.page_size) {
    searchParams.set('page_size', String(params.page_size));
  }

  if (params.email) {
    searchParams.set('filter[email]', params.email.trim());
  }

  if (params.phone) {
    searchParams.set('filter[phone]', params.phone.trim());
  }

  if (params.company_id) {
    searchParams.set('filter[company_id]', params.company_id);
  }

  if (params.tags?.length) {
    params.tags.forEach((tag) => {
      if (tag.trim()) {
        searchParams.append('filter[tag]', tag.trim());
      }
    });
  }

  if (params.created_from) {
    searchParams.set('filter[created_at][from]', params.created_from);
  }

  if (params.created_to) {
    searchParams.set('filter[created_at][to]', params.created_to);
  }

  return searchParams;
};

export const customersApi = {
  list: async (params: CustomerListQuery): Promise<CustomerListResponse> => {
    const { data } = await apiV1Client.get<CustomerListResponse>('/customers/', {
      params: buildListParams(params),
    });

    return data;
  },
  details: async (customerId: string): Promise<CustomerDetailResponse> => {
    const { data } = await apiV1Client.get<CustomerDetailResponse>(`/customers/${customerId}/`);
    return data;
  },
  create: async (payload: CreateCustomerPayload): Promise<CustomerDetailResponse> => {
    const { data } = await apiV1Client.post<CustomerDetailResponse>('/customers/', payload);
    return data;
  },
  update: async (
    customerId: string,
    payload: UpdateCustomerPayload
  ): Promise<CustomerDetailResponse> => {
    const { data } = await apiV1Client.put<CustomerDetailResponse>(
      `/customers/${customerId}/`,
      payload
    );
    return data;
  },
  delete: async (customerId: string): Promise<void> => {
    await apiV1Client.delete(`/customers/${customerId}/`);
  },
};
