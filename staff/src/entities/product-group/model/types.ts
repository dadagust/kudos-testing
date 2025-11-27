import { ProductListItem } from '@/entities/product';

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
