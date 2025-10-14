'use client';

import { useQuery } from '@tanstack/react-query';

import { customersApi } from '../api/customers-api';
import { CustomerDetailResponse } from '../model/types';

export const useCustomerQuery = (customerId: string, enabled = true) =>
  useQuery<CustomerDetailResponse, Error>({
    queryKey: ['customer', customerId],
    queryFn: () => customersApi.details(customerId),
    enabled: enabled && Boolean(customerId),
  });
