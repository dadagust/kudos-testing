import { useQuery } from '@tanstack/react-query';

import { productsApi } from '../api/products-api';
import { ProductDetail } from '../model/types';

export const useProductQuery = (productId: string) =>
  useQuery<ProductDetail, Error>({
    queryKey: ['products', 'detail', productId],
    queryFn: () => productsApi.details(productId),
    enabled: Boolean(productId),
  });
