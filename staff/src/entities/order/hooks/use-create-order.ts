import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ordersApi } from '../api/orders-api';
import { CreateOrderPayload, OrderDetailResponse } from '../model/types';

export const useCreateOrderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<OrderDetailResponse, unknown, CreateOrderPayload>({
    mutationFn: (payload) => ordersApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};
