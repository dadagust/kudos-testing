import { useQuery } from '@tanstack/react-query';

import { ordersApi } from '@/entities/order';

import { OrderListQuery, OrderListResponse } from '../model/types';

export const useOrdersQuery = (params: OrderListQuery) =>
  useQuery<OrderListResponse>({
    queryKey: ['orders', params] as const,
    queryFn: () => ordersApi.list(params),
  });
