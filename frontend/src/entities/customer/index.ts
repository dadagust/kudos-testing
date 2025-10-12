export * from './api/customers-api';
export * from './hooks/use-customers';
export * from './hooks/use-customer';
export * from './hooks/use-create-customer';
export * from './model/types';

export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  personal: 'Физическое лицо',
  business: 'Юридическое лицо',
};

export const ADDRESS_TYPE_LABELS: Record<string, string> = {
  billing: 'Платёжный адрес',
  shipping: 'Адрес доставки',
  other: 'Другой адрес',
};
