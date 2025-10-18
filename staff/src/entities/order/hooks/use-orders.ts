import { useMutation, useQuery } from '@tanstack/react-query';

import { ordersApi } from '../api/orders-api';
import {
  CreateOrderPayload,
  OrderDetailResponse,
  OrderListQuery,
  OrderListResponse,
  UpdateOrderPayload,
} from '../model/types';

export const useOrdersQuery = (params: OrderListQuery) =>
  useQuery<OrderListResponse, Error>({
    queryKey: ['orders', params] as const,
    queryFn: () => ordersApi.list(params),
  });

export const useOrderQuery = (orderId: number, enabled = true) =>
  useQuery<OrderDetailResponse, Error>({
    queryKey: ['order', orderId] as const,
    queryFn: () => ordersApi.details(orderId),
    enabled,
  });

export const useCreateOrderMutation = () =>
  useMutation<OrderDetailResponse, Error, CreateOrderPayload>({
    mutationFn: (payload) => ordersApi.create(payload),
  });

export const useUpdateOrderMutation = () =>
  useMutation<OrderDetailResponse, Error, { orderId: number; payload: UpdateOrderPayload }>({
    mutationFn: ({ orderId, payload }) => ordersApi.update(orderId, payload),
  });

export const orderQueries = {
  listKey: (params: OrderListQuery) => ['orders', params] as const,
  detailKey: (orderId: number) => ['order', orderId] as const,
};
