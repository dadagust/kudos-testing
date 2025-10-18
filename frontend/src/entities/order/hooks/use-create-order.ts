import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { ordersApi } from '../api/orders-api';
import { OrderCreatePayload, OrderDetailResponse } from '../model/types';

type OrderErrorResponse = Record<string, string[] | string> | { detail?: string };

export const useCreateOrderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<OrderDetailResponse, AxiosError<OrderErrorResponse>, OrderCreatePayload>({
    mutationFn: (payload) => ordersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
};
