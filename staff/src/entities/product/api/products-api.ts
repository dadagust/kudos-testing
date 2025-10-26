import { apiV1Client } from '@/shared/api/httpClient';

import {
  ProductCategoriesResponseItem,
  ProductCreatePayload,
  ProductCreateResponse,
  ProductDetail,
  ProductEnumsResponse,
  ProductListQuery,
  ProductListResponse,
} from '../model/types';

const sanitizeParams = (params: ProductListQuery): Record<string, string | number | boolean> => {
  const result: Record<string, string | number | boolean> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === 'string' && value.trim().length === 0) {
      return;
    }
    if (key === 'self_pickup') {
      result[key] = value ? 'true' : 'false';
      return;
    }
    result[key] = value as string | number | boolean;
  });
  return result;
};

export const productsApi = {
  list: async (params: ProductListQuery): Promise<ProductListResponse> => {
    const { data } = await apiV1Client.get<ProductListResponse>('/products', {
      params: sanitizeParams(params),
    });
    return data;
  },
  create: async (payload: ProductCreatePayload): Promise<ProductCreateResponse> => {
    const { data } = await apiV1Client.post<ProductCreateResponse>('/products', payload);
    return data;
  },
  details: async (productId: string, include?: string): Promise<ProductDetail> => {
    const { data } = await apiV1Client.get<ProductDetail>(`/products/${productId}`, {
      params: include ? { include } : undefined,
    });
    return data;
  },
  categories: async (): Promise<ProductCategoriesResponseItem[]> => {
    const { data } = await apiV1Client.get<ProductCategoriesResponseItem[]>('/products/categories');
    return data;
  },
  enums: async (): Promise<ProductEnumsResponse> => {
    const { data } = await apiV1Client.get<ProductEnumsResponse>('/products/enums');
    return data;
  },
};
