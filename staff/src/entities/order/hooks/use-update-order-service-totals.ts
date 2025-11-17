import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ordersApi } from '../api/orders-api';
import { OrderDetailResponse, UpdateOrderServiceTotalsPayload } from '../model/types';

interface UpdateOrderServiceTotalsArgs {
  orderId: number | string;
  payload: UpdateOrderServiceTotalsPayload;
}

export const useUpdateOrderServiceTotalsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<OrderDetailResponse, unknown, UpdateOrderServiceTotalsArgs>({
    mutationFn: ({ orderId, payload }) => ordersApi.updateServiceTotals(orderId, payload),
    onSuccess: (response, { orderId }) => {
      const orderQueryKey = ['order', String(orderId)] as const;
      queryClient.setQueryData<OrderDetailResponse>(orderQueryKey, response);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};
