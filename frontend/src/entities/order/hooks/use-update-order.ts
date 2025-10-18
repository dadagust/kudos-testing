import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { ordersApi } from '../api/orders-api';
import { OrderDetailResponse, OrderUpdatePayload } from '../model/types';

type OrderErrorResponse = Record<string, string[] | string> | { detail?: string };

export const useUpdateOrderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<
    OrderDetailResponse,
    AxiosError<OrderErrorResponse>,
    { orderId: number; payload: OrderUpdatePayload }
  >({
    mutationFn: ({ orderId, payload }) => ordersApi.update(orderId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders', variables.orderId] });
    },
  });
};
