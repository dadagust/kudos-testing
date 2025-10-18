import { apiV1Client } from '@/shared/api/httpClient';

import {
  CreateOrderPayload,
  OrderDetailResponse,
  OrderListQuery,
  OrderListResponse,
  UpdateOrderPayload,
} from '../model/types';

const buildListParams = (params: OrderListQuery) => {
  const searchParams = new URLSearchParams();

  if (params.search) {
    searchParams.set('search', params.search.trim());
  }

  if (params.customer) {
    searchParams.set('filter[customer]', params.customer);
  }

  if (params.status?.length) {
    params.status.forEach((status) => {
      searchParams.append('filter[status]', status);
    });
  }

  return searchParams;
};

export const ordersApi = {
  list: async (params: OrderListQuery): Promise<OrderListResponse> => {
    const { data } = await apiV1Client.get<OrderListResponse>('/order/', {
      params: buildListParams(params),
    });

    return data;
  },
  details: async (orderId: number): Promise<OrderDetailResponse> => {
    const { data } = await apiV1Client.get<OrderDetailResponse>(`/order/${orderId}/`);
    return data;
  },
  create: async (payload: CreateOrderPayload): Promise<OrderDetailResponse> => {
    const { data } = await apiV1Client.post<OrderDetailResponse>('/order/', payload);
    return data;
  },
  update: async (
    orderId: number,
    payload: UpdateOrderPayload
  ): Promise<OrderDetailResponse> => {
    const { data } = await apiV1Client.put<OrderDetailResponse>(`/order/${orderId}/`, payload);
    return data;
  },
};
