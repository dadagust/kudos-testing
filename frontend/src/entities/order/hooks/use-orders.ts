import { useQuery } from '@tanstack/react-query';

import { ordersApi } from '../api/orders-api';
import { OrderListQuery, OrderListResponse } from '../model/types';

export const useOrdersQuery = (params: OrderListQuery) =>
  useQuery<OrderListResponse, Error>({
    queryKey: ['orders', params],
    queryFn: () => ordersApi.list(params),
    staleTime: 15 * 1000,
  });
