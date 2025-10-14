import { mockClient } from '@/shared/api/httpClient';

import { ProductDetailResponse, ProductListQuery, ProductListResponse } from '../model/types';

const sanitizeParams = (params: ProductListQuery): Record<string, string | number> => {
  const entries = Object.entries(params).filter(([, value]) => {
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }
    return false;
  });

  return Object.fromEntries(entries) as Record<string, string | number>;
};

export const productsApi = {
  list: async (params: ProductListQuery): Promise<ProductListResponse> => {
    const { data } = await mockClient.get<ProductListResponse>('/products', {
      params: sanitizeParams(params),
    });
    return data;
  },
  details: async (productId: string): Promise<ProductDetailResponse> => {
    const { data } = await mockClient.get<ProductDetailResponse>(`/products/${productId}`);
    return data;
  },
};
