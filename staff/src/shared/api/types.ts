export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginationLinks {
  self: string;
  first: string;
  last: string;
  next: string | null;
  prev: string | null;
}
