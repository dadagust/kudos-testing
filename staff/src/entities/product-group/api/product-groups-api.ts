import { apiV1Client } from '@/shared/api/httpClient';
import { ensureAbsoluteUrl } from '@/shared/lib/url';

import { ProductGroup, ProductGroupPayload } from '../model/types';

const normalizeGroup = (group: ProductGroup): ProductGroup => ({
  ...group,
  products: group.products.map((product) => ({
    ...product,
    thumbnail_url: ensureAbsoluteUrl(product.thumbnail_url),
  })),
});

export const productGroupsApi = {
  list: async (): Promise<ProductGroup[]> => {
    const { data } = await apiV1Client.get<ProductGroup[]>('/products/groups');
    return data.map(normalizeGroup);
  },
  details: async (groupId: string): Promise<ProductGroup> => {
    const { data } = await apiV1Client.get<ProductGroup>(`/products/groups/${groupId}`);
    return normalizeGroup(data);
  },
  create: async (payload: ProductGroupPayload): Promise<ProductGroup> => {
    const { data } = await apiV1Client.post<ProductGroup>('/products/groups', payload);
    return normalizeGroup(data);
  },
  update: async (groupId: string, payload: ProductGroupPayload): Promise<ProductGroup> => {
    const { data } = await apiV1Client.patch<ProductGroup>(`/products/groups/${groupId}`, payload);
    return normalizeGroup(data);
  },
  remove: async (groupId: string): Promise<void> => {
    await apiV1Client.delete(`/products/groups/${groupId}`);
  },
};
