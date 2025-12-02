import { apiV1Client } from '@/shared/api/httpClient';
import { ensureAbsoluteUrl } from '@/shared/lib/url';

import { ProductGroup, ProductGroupListResponse, ProductGroupPayload } from '../model/types';

const normalizeGroup = (group: ProductGroup): ProductGroup => ({
  ...group,
  image_url: ensureAbsoluteUrl(group.image_url ?? undefined),
  products: group.products.map((product) => ({
    ...product,
    thumbnail_url: ensureAbsoluteUrl(product.thumbnail_url),
  })),
});

const buildGroupFormData = (payload: ProductGroupPayload) => {
  const formData = new FormData();
  formData.append('name', payload.name);
  formData.append('category_id', payload.category_id);
  formData.append('show_in_new', String(payload.show_in_new));
  payload.product_ids.forEach((id) => formData.append('product_ids', id));

  if (payload.image instanceof File) {
    formData.append('image', payload.image);
  } else if (payload.image === null) {
    formData.append('image', '');
  }

  if (payload.remove_image) {
    formData.append('remove_image', String(payload.remove_image));
  }

  return formData;
};

export const productGroupsApi = {
  list: async (): Promise<ProductGroup[]> => {
    const { data } = await apiV1Client.get<ProductGroupListResponse | ProductGroup[]>(
      '/products/groups'
    );
    const groups = Array.isArray(data) ? data : (data?.data ?? []);
    return groups.map(normalizeGroup);
  },
  details: async (groupId: string): Promise<ProductGroup> => {
    const { data } = await apiV1Client.get<ProductGroup>(`/products/groups/${groupId}`);
    return normalizeGroup(data);
  },
  create: async (payload: ProductGroupPayload): Promise<ProductGroup> => {
    const formData = buildGroupFormData(payload);
    const { data } = await apiV1Client.post<ProductGroup>('/products/groups', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return normalizeGroup(data);
  },
  update: async (groupId: string, payload: ProductGroupPayload): Promise<ProductGroup> => {
    const formData = buildGroupFormData(payload);
    const { data } = await apiV1Client.patch<ProductGroup>(`/products/groups/${groupId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return normalizeGroup(data);
  },
  remove: async (groupId: string): Promise<void> => {
    await apiV1Client.delete(`/products/groups/${groupId}`);
  },
};
