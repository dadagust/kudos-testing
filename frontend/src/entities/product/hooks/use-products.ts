import { useQuery } from '@tanstack/react-query';

import { productsApi } from '../api/products-api';
import { ProductListQuery, ProductListResponse } from '../model/types';

export const useProductsQuery = (params: ProductListQuery) =>
  useQuery<ProductListResponse, Error>({
    queryKey: ['products', params],
    queryFn: () => productsApi.list(params),
    staleTime: 30 * 1000,
  });
