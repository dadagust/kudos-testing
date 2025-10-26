import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { productsApi } from '../api/products-api';
import { ProductListQuery, ProductListResponse } from '../model/types';

export const useProductsQuery = (params: ProductListQuery) =>
  useQuery<ProductListResponse, Error>({
    queryKey: ['products', params],
    queryFn: () => productsApi.list(params),
    staleTime: 30 * 1000,
  });

export const useInfiniteProductsQuery = (params: ProductListQuery) =>
  useInfiniteQuery<ProductListResponse, Error>({
    queryKey: ['products', 'infinite', params],
    queryFn: ({ pageParam }) =>
      productsApi.list({ ...params, cursor: (pageParam as string | undefined) ?? undefined }),
    initialPageParam: params.cursor ?? undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    staleTime: 30 * 1000,
  });
