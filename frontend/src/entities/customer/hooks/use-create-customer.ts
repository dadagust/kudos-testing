import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { customersApi } from '../api/customers-api';
import { CustomerCreatePayload, CustomerDetailResponse } from '../model/types';

type CustomerErrorResponse = Record<string, string[] | string> | { detail?: string };

export const useCreateCustomerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<
    CustomerDetailResponse,
    AxiosError<CustomerErrorResponse>,
    CustomerCreatePayload
  >({
    mutationFn: (payload) => customersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
