import { useQuery } from '@tanstack/react-query';

import { customersApi } from '../api/customers-api';
import { CustomerDetail } from '../model/types';

export const useCustomer = (customerId: number, enabled = true) =>
  useQuery<CustomerDetail, Error>({
    queryKey: ['customer', customerId],
    queryFn: () => customersApi.retrieve(customerId),
    enabled: enabled && Number.isFinite(customerId),
  });
