export type CustomerType = 'individual' | 'corporate';

export interface Company {
  id: number;
  name: string;
  legal_name: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface Address {
  id: number;
  title: string | null;
  address_type: 'shipping' | 'billing' | 'other';
  postal_code: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
  apartment: string | null;
  comment: string | null;
  is_primary: boolean;
  is_active: boolean;
}

export interface Contact {
  id: number;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_primary: boolean;
  is_active: boolean;
}

export interface CustomerSummary {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  customer_type: CustomerType;
  tags: string[];
  company: Company | null;
  created_at: string;
}

export interface CustomerDetail extends CustomerSummary {
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  gdpr_consent: boolean;
  marketing_consent: boolean;
  notes: string | null;
  owner: number | null;
  addresses: Address[];
  contacts: Contact[];
  is_active: boolean;
  updated_at: string;
}

export interface CustomerListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CustomerSummary[];
}

export interface CustomerListQuery {
  page?: number;
  page_size?: number;
  q?: string;
  email?: string;
  phone?: string;
  tag?: string;
  company_id?: number;
  created_at__gte?: string;
  created_at__lte?: string;
  ordering?: 'name' | '-name' | 'created_at' | '-created_at';
}

export interface CustomerPayload {
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  email: string;
  phone: string;
  customer_type: CustomerType;
  tags?: string[];
  gdpr_consent?: boolean;
  marketing_consent?: boolean;
  notes?: string | null;
  company?: Partial<Company> | null;
  addresses?: Partial<Address>[];
  contacts?: Partial<Contact>[];
}
