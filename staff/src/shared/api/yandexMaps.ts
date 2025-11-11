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
  options: { signal?: AbortSignal } = {}
): Promise<YandexSuggestItem[]> => {
  const trimmed = query.trim();
  if (!API_KEY || !trimmed) {
    return [];
  }

  const params = new URLSearchParams({
    apikey: API_KEY,
    text: trimmed,
    lang: 'ru_RU',
    type: 'geo',
    print_address: '1',
    results: '5',
  });

  const response = await fetch(`https://suggest-maps.yandex.ru/v1/suggest?${params.toString()}`, {
    signal: options.signal,
  });
  if (!response.ok) {
    return [];
  }
  const payload = await response.json();
  const results: any[] = payload?.results ?? [];
  return results
    .map((item) => {
      const rawTitle: SuggestRawTitle | string = item?.title ?? '';
      const rawSubtitle: SuggestRawTitle | string | undefined = item?.subtitle;
      const rawAddress: SuggestRawAddress | undefined = item?.address;
      const title = typeof rawTitle === 'string' ? rawTitle : rawTitle?.text ?? '';
      const subtitle =
        typeof rawSubtitle === 'string' ? rawSubtitle : rawSubtitle?.text ?? undefined;
      const formatted = rawAddress?.formatted_address ?? rawAddress?.full_address ?? title;
      const value = formatted || title;
      const uri: string | undefined = typeof item?.uri === 'string' ? item.uri : undefined;
      if (!value) {
        return null;
      }
      return {
        title: title || value,
        subtitle,
        value,
        uri,
      } satisfies YandexSuggestItem | null;
    })
    .filter((item): item is YandexSuggestItem => Boolean(item));
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
  const members: any[] = collection?.featureMember ?? [];
  if (!Array.isArray(members) || members.length === 0) {
    return null;
  }

  const geoObject = members[0]?.GeoObject ?? {};
  const meta = geoObject?.metaDataProperty?.GeocoderMetaData ?? {};
  const pos = typeof geoObject?.Point?.pos === 'string' ? geoObject.Point.pos : '';
  const [lonStr, latStr] = pos.split(' ');
  const lat = latStr ? Number(latStr) : null;
  const lon = lonStr ? Number(lonStr) : null;
  const normalized = meta?.Address?.formatted ?? meta?.text ?? trimmed;
  const kind = typeof meta?.kind === 'string' ? meta.kind : '';
  const precision = typeof meta?.precision === 'string' ? meta.precision : '';
  const uri = typeof geoObject?.uri === 'string' ? geoObject.uri : '';

  return {
    normalized,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    kind,
    precision,
    uri,
  };
};
