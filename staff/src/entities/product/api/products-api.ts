import { apiV1Client, API_ROOT } from '@/shared/api/httpClient';

import {
  ProductCategoriesResponseItem,
  ProductCreatePayload,
  ProductCreateResponse,
  ProductDetail,
  ProductEnumsResponse,
  ProductImage,
  ProductImagesReorderPayload,
  ProductListQuery,
  ProductListResponse,
  ProductUpdatePayload,
  ProductStockTransaction,
  CreateProductStockTransactionPayload,
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

const makeAbsoluteUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `${API_ROOT}${url.startsWith('/') ? '' : '/'}${url}`;
};

const ensureAbsoluteUrl = (url: string | null | undefined): string | null | undefined => {
  if (url === undefined || url === null) {
    return url;
  }
  return makeAbsoluteUrl(url);
};

const normalizeImages = (images: ProductImage[]): ProductImage[] =>
  images.map((image) => ({ ...image, url: makeAbsoluteUrl(image.url) }));

const normalizeOptionalImages = (images?: ProductImage[]) =>
  images ? normalizeImages(images) : undefined;

export const productsApi = {
  list: async (params: ProductListQuery): Promise<ProductListResponse> => {
    const { data } = await apiV1Client.get<ProductListResponse>('/products', {
      params: sanitizeParams(params),
    });
    return {
      ...data,
      results: data.results.map((product) => ({
        ...product,
        thumbnail_url: ensureAbsoluteUrl(product.thumbnail_url),
        images: normalizeOptionalImages(product.images),
      })),
    };
  },
  create: async (payload: ProductCreatePayload): Promise<ProductCreateResponse> => {
    const { data } = await apiV1Client.post<ProductCreateResponse>('/products', payload);
    return data;
  },
  update: async (productId: string, payload: ProductUpdatePayload): Promise<ProductDetail> => {
    const { data } = await apiV1Client.patch<ProductDetail>(`/products/${productId}`, payload);
    const normalizedImages = normalizeOptionalImages(data.images) ?? [];
    return {
      ...data,
      thumbnail_url: ensureAbsoluteUrl(data.thumbnail_url),
      images: normalizedImages,
    };
  },
  details: async (productId: string, include?: string): Promise<ProductDetail> => {
    const { data } = await apiV1Client.get<ProductDetail>(`/products/${productId}`, {
      params: include ? { include } : undefined,
    });
    return {
      ...data,
      thumbnail_url: ensureAbsoluteUrl(data.thumbnail_url),
      images: normalizeImages(data.images),
    };
  },
  remove: async (productId: string): Promise<void> => {
    await apiV1Client.delete(`/products/${productId}`);
  },
  uploadImages: async (
    productId: string,
    files: { file: File; position: number }[]
  ): Promise<ProductImage[]> => {
    const formData = new FormData();
    files.forEach(({ file, position }) => {
      formData.append('files', file);
      formData.append('positions', String(position));
    });

    const { data } = await apiV1Client.post<ProductImage[]>(
      `/products/${productId}/images`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return normalizeImages(data);
  },
  reorderImages: async (productId: string, payload: ProductImagesReorderPayload): Promise<void> => {
    await apiV1Client.patch(`/products/${productId}/images/reorder`, payload);
  },
  deleteImage: async (productId: string, imageId: string): Promise<void> => {
    await apiV1Client.delete(`/products/${productId}/images/${imageId}`);
  },
  listTransactions: async (productId: string): Promise<ProductStockTransaction[]> => {
    const { data } = await apiV1Client.get<ProductStockTransaction[]>(
      `/products/${productId}/transactions`
    );
    return data;
  },
  createTransaction: async (
    productId: string,
    payload: CreateProductStockTransactionPayload
  ): Promise<ProductStockTransaction> => {
    const { data } = await apiV1Client.post<ProductStockTransaction>(
      `/products/${productId}/transactions`,
      payload
    );
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
