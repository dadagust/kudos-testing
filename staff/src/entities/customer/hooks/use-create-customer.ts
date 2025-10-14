import { useMutation } from '@tanstack/react-query';

import { customersApi } from '../api/customers-api';
import { CreateCustomerPayload, CustomerDetailResponse } from '../model/types';

export const useCreateCustomerMutation = () =>
  useMutation<CustomerDetailResponse, Error, CreateCustomerPayload>({
    mutationFn: (payload) => customersApi.create(payload),
  });
