import { apiV1Client } from '@/shared/api/httpClient';

import {
  CreateOrderPayload,
  OrderCalculationResponse,
  OrderDetailResponse,
  OrderListQuery,
  OrderListResponse,
  UpdateOrderPayload,
} from '../model/types';

const buildListParams = (params: OrderListQuery) => {
  const searchParams = new URLSearchParams();

  if (params.status_group) {
    searchParams.set('status_group', params.status_group);
  }

  if (params.status) {
    searchParams.set('status', params.status);
  }

  if (params.search) {
    searchParams.set('search', params.search.trim());
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
  details: async (orderId: number | string): Promise<OrderDetailResponse> => {
    const { data } = await apiV1Client.get<OrderDetailResponse>(`/order/${orderId}/`);
    return data;
  },
  create: async (payload: CreateOrderPayload): Promise<OrderDetailResponse> => {
    const { data } = await apiV1Client.post<OrderDetailResponse>('/order/', payload);
    return data;
  },
  update: async (
    orderId: number | string,
    payload: UpdateOrderPayload
  ): Promise<OrderDetailResponse> => {
    const { data } = await apiV1Client.put<OrderDetailResponse>(`/order/${orderId}/`, payload);
    return data;
  },
  calculateTotal: async (
    payload: CreateOrderPayload,
    signal?: AbortSignal
  ): Promise<OrderCalculationResponse> => {
    const { data } = await apiV1Client.post<OrderCalculationResponse>(
      '/order/calculate-total/',
      payload,
      { signal }
    );
    return data;
  },
};
