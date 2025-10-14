import { useQuery } from '@tanstack/react-query';

import { productsApi } from '../api/products-api';
import { ProductDetailResponse } from '../model/types';

export const useProductQuery = (productId: string) =>
  useQuery<ProductDetailResponse, Error>({
    queryKey: ['products', 'detail', productId],
    queryFn: () => productsApi.details(productId),
    enabled: Boolean(productId),
  });
