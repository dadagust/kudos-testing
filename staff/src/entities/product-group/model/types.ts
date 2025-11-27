import { ProductListItem } from '@/entities/product';
import type { PaginationLinks, PaginationMeta } from '@/shared/api/types';

export type ProductGroup = {
  id: string;
  name: string;
  products: ProductListItem[];
  created_at?: string;
  updated_at?: string;
};

export type ProductGroupPayload = {
  name: string;
  product_ids: string[];
};

export type ProductGroupListResponse = {
  data: ProductGroup[];
  meta?: { pagination: PaginationMeta };
  links?: PaginationLinks;
};
