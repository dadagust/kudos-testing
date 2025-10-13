import { useMutation } from '@tanstack/react-query';

import { customersApi } from '../api/customers-api';

export const useDeleteCustomerMutation = () =>
  useMutation<void, Error, string>({
    mutationFn: (customerId) => customersApi.delete(customerId),
  });
