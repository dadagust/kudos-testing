import { apiV1Client } from '@/shared/api/httpClient';

import {
  CreateOrderPayload,
  LogisticsState,
  OrderCalculationResponse,
  OrderDetailResponse,
  OrderListQuery,
  OrderListResponse,
  PaymentStatus,
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

  if (params.payment_status?.length) {
    params.payment_status.forEach((status) => {
      searchParams.append('payment_status', status);
    });
  }

  if (params.logistics_state?.length) {
    params.logistics_state.forEach((state) => {
      searchParams.append('logistics_state', state);
    });
  }

  if (params.shipment_date_from) {
    searchParams.set('shipment_date_from', params.shipment_date_from);
  }

  if (params.shipment_date_to) {
    searchParams.set('shipment_date_to', params.shipment_date_to);
  }

  if (params.q) {
    searchParams.set('q', params.q.trim());
  }

  return searchParams;
};

export const ordersApi = {
  list: async (params: OrderListQuery): Promise<OrderListResponse> => {
    const { data } = await apiV1Client.get<OrderListResponse>('/orders/', {
      params: buildListParams(params),
    });

    return data;
  },
  details: async (orderId: number | string): Promise<OrderDetailResponse> => {
    const { data } = await apiV1Client.get<OrderDetailResponse>(`/orders/${orderId}/`);
    return data;
  },
  create: async (payload: CreateOrderPayload): Promise<OrderDetailResponse> => {
    const { data } = await apiV1Client.post<OrderDetailResponse>('/orders/', payload);
    return data;
  },
  update: async (
    orderId: number | string,
    payload: UpdateOrderPayload
  ): Promise<OrderDetailResponse> => {
    const { data } = await apiV1Client.put<OrderDetailResponse>(`/orders/${orderId}/`, payload);
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
  updatePaymentStatus: async (
    orderId: number | string,
    paymentStatus: PaymentStatus
  ): Promise<OrderDetailResponse> => {
    const { data } = await apiV1Client.patch<OrderDetailResponse>(
      `/orders/${orderId}/payment-status/`,
      { payment_status: paymentStatus }
    );
    return data;
  },
  updateLogisticsState: async (
    orderId: number | string,
    logisticsState: LogisticsState | null
  ): Promise<OrderDetailResponse> => {
    const { data } = await apiV1Client.patch<OrderDetailResponse>(
      `/orders/${orderId}/logistics-state/`,
      { logistics_state: logisticsState }
    );
    return data;
  },
  receive: async (orderId: number | string): Promise<OrderDetailResponse> => {
    const { data } = await apiV1Client.post<OrderDetailResponse>(`/orders/${orderId}/receive/`, {});
    return data;
  },
};
