'use client';

import { useMutation } from '@tanstack/react-query';

import { customersApi } from '../api/customers-api';
import { CustomerDetailResponse, UpdateCustomerPayload } from '../model/types';

interface UpdateCustomerVariables {
  customerId: string;
  payload: UpdateCustomerPayload;
}

export const useUpdateCustomerMutation = () =>
  useMutation<CustomerDetailResponse, Error, UpdateCustomerVariables>({
    mutationFn: ({ customerId, payload }) => customersApi.update(customerId, payload),
  });
