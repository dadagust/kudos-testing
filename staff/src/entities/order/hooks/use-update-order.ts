import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ordersApi } from '../api/orders-api';
import { OrderDetailResponse, UpdateOrderPayload } from '../model/types';

interface UpdateOrderArgs {
  orderId: number | string;
  payload: UpdateOrderPayload;
}

export const useUpdateOrderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<OrderDetailResponse, unknown, UpdateOrderArgs>({
    mutationFn: ({ orderId, payload }) => ordersApi.update(orderId, payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['order', String(variables.orderId)] });
    },
  });
};
