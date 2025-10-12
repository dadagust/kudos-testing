import { useQuery } from '@tanstack/react-query';

import { customersApi } from '../api/customers-api';
import { CustomerDetailResponse } from '../model/types';

export const useCustomerDetailsQuery = (customerId: string | null) =>
  useQuery<CustomerDetailResponse, Error>({
    queryKey: ['customer', customerId],
    queryFn: () => {
      if (!customerId) {
        throw new Error('customerId is required');
      }
      return customersApi.details(customerId);
    },
    enabled: Boolean(customerId),
    staleTime: 30 * 1000,
  });
