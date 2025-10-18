import { useQuery } from '@tanstack/react-query';

import { ordersApi } from '../api/orders-api';
import { OrderDetailResponse } from '../model/types';

export const useOrderDetailsQuery = (orderId: number | null) =>
  useQuery<OrderDetailResponse, Error>({
    queryKey: ['orders', orderId],
    queryFn: () => {
      if (orderId === null) {
        throw new Error('orderId is required');
      }
      return ordersApi.details(orderId);
    },
    enabled: orderId !== null,
  });
