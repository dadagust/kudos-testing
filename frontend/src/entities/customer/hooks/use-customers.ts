import { useQuery } from '@tanstack/react-query';

import { customersApi } from '../api/customers-api';
import { CustomerListQuery, CustomerListResponse } from '../model/types';

export const useCustomersQuery = (params: CustomerListQuery) =>
  useQuery<CustomerListResponse, Error>({
    queryKey: ['customers', params],
    queryFn: () => customersApi.list(params),
    keepPreviousData: true,
  });
