import axios from 'axios';

import { apiV1Client } from './httpClient';

const API_KEY =
  process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY ?? process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? '';

interface SuggestRawTitle {
  text?: string;
}

interface SuggestRawAddress {
  formatted_address?: string;
  full_address?: string;
}

export interface YandexSuggestItem {
  title: string;
  subtitle?: string;
  value: string;
  uri?: string;
}

export const fetchAddressSuggestions = async (
  query: string,
  options: { signal?: AbortSignal } = {},
): Promise<YandexSuggestItem[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  let responseData: unknown;
  try {
    const response = await apiV1Client.get('/ymaps/suggest/', {
      params: { q: trimmed },
      signal: options.signal,
    });
    responseData = response.data;
  } catch (error) {
    if (axios.isCancel(error) || (error as Error).name === 'CanceledError') {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      throw abortError;
    }
    if (axios.isAxiosError(error) && error.response) {
      return [];
    }
    throw error;
  }

  const payload = (responseData ?? {}) as Record<string, unknown>;
  const rawResults = Array.isArray(payload['results'])
    ? (payload['results'] as unknown[])
    : [];
  const suggestions: YandexSuggestItem[] = [];

  for (const item of rawResults) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const rawTitle: SuggestRawTitle | string =
      (record.title as SuggestRawTitle | string | undefined) ?? '';
    const rawSubtitle: SuggestRawTitle | string | undefined = record.subtitle as
      | SuggestRawTitle
      | string
      | undefined;
    const rawAddress: SuggestRawAddress | undefined = record.address as
      | SuggestRawAddress
      | undefined;
    const title = typeof rawTitle === 'string' ? rawTitle : (rawTitle?.text ?? '');
    const subtitle =
      typeof rawSubtitle === 'string' ? rawSubtitle : (rawSubtitle?.text ?? undefined);
    const formatted = rawAddress?.formatted_address ?? rawAddress?.full_address ?? title;
    const value = formatted || title;
    const uri = typeof record.uri === 'string' ? record.uri : undefined;

    if (!value) {
      continue;
    }

    suggestions.push({
      title: title || value,
      subtitle,
      value,
      uri,
    });
  }

  return suggestions;
};

export interface YandexGeocodeResult {
  normalized: string;
  lat: number | null;
  lon: number | null;
  kind: string;
  precision: string;
  uri: string;
}

export const geocodeAddress = async (
  query: string,
  options: { signal?: AbortSignal } = {}
): Promise<YandexGeocodeResult | null> => {
  const trimmed = query.trim();
  if (!API_KEY || !trimmed) {
    return null;
  }

  const params = new URLSearchParams({
    apikey: API_KEY,
    geocode: trimmed,
    format: 'json',
    lang: 'ru_RU',
  });

  const response = await fetch(`https://geocode-maps.yandex.ru/v1/?${params.toString()}`, {
    signal: options.signal,
  });
  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const collection = payload?.response?.GeoObjectCollection ?? {};
  const rawMembers = Array.isArray(collection?.featureMember)
    ? (collection.featureMember as unknown[])
    : [];
  if (rawMembers.length === 0) {
    return null;
  }

  const firstMember = rawMembers[0];
  if (!firstMember || typeof firstMember !== 'object') {
    return null;
  }

  const geoObjectRecord = firstMember as Record<string, unknown>;
  const geoObject = (geoObjectRecord.GeoObject as Record<string, unknown> | undefined) ?? {};
  const metaDataProperty = geoObject.metaDataProperty as Record<string, unknown> | undefined;
  const geocoderMeta = metaDataProperty?.GeocoderMetaData as Record<string, unknown> | undefined;
  const address = geocoderMeta?.Address as Record<string, unknown> | undefined;
  const posSource = geoObject.Point as Record<string, unknown> | undefined;
  const pos = typeof posSource?.pos === 'string' ? posSource.pos : '';
  const [lonStr, latStr] = pos.split(' ');
  const lat = latStr ? Number(latStr) : null;
  const lon = lonStr ? Number(lonStr) : null;
  const normalized =
    (address?.formatted as string | undefined) ??
    (geocoderMeta?.text as string | undefined) ??
    trimmed;
  const kind = typeof geocoderMeta?.kind === 'string' ? (geocoderMeta.kind as string) : '';
  const precision =
    typeof geocoderMeta?.precision === 'string' ? (geocoderMeta.precision as string) : '';
  const uri = typeof geoObject?.uri === 'string' ? (geoObject.uri as string) : '';

  return {
    normalized,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    kind,
    precision,
    uri,
  };
};
