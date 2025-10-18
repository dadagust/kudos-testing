import { useQuery } from '@tanstack/react-query';

import { ordersApi } from '../api/orders-api';
import { OrderDetailResponse } from '../model/types';

export const useOrderQuery = (orderId: number | string, enabled = true) =>
  useQuery<OrderDetailResponse>({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.details(orderId),
    enabled,
  });
