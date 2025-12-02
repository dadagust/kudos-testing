import { ProductListItem } from '@/entities/product';
import type { PaginationLinks, PaginationMeta } from '@/shared/api/types';

export type ProductGroup = {
  id: string;
  category_id: string | null;
  name: string;
  image_url?: string | null;
  products: ProductListItem[];
  created_at?: string;
  updated_at?: string;
};

export type ProductGroupPayload = {
  name: string;
  category_id: string;
  product_ids: string[];
  image?: File | null;
  remove_image?: boolean;
};

export type ProductGroupListResponse = {
  data: ProductGroup[];
  meta?: { pagination: PaginationMeta };
  links?: PaginationLinks;
};
