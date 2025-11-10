import { API_ROOT } from '@/shared/api/httpClient';

const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

export const makeAbsoluteUrl = (url: string): string => {
  if (isAbsoluteUrl(url)) {
    return url;
  }

  const prefix = url.startsWith('/') ? '' : '/';
  return `${API_ROOT}${prefix}${url}`;
};

export const ensureAbsoluteUrl = (url: string | null | undefined): string | null | undefined => {
  if (url === undefined || url === null) {
    return url;
  }

  return makeAbsoluteUrl(url);
};
