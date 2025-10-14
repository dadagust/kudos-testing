const sanitizeDigits = (value: string): string => value.replace(/\D/g, '');

const ensureRussianPhoneDigits = (digits: string): string => {
  if (!digits) {
    return '';
  }

  let normalized = digits;

  if (normalized.startsWith('8')) {
    normalized = `7${normalized.slice(1)}`;
  } else if (normalized.startsWith('9') && normalized.length <= 10) {
    normalized = `7${normalized}`;
  } else if (!normalized.startsWith('7')) {
    normalized = `7${normalized}`;
  }

  return normalized.slice(0, 11);
};

const buildMaskedPhone = (digits: string): string => {
  if (!digits) {
    return '';
  }

  const country = digits.slice(0, 1);
  const city = digits.slice(1, 4);
  const first = digits.slice(4, 7);
  const second = digits.slice(7, 9);
  const third = digits.slice(9, 11);

  let result = `+${country}`;

  if (city) {
    result += ` (${city}`;
    if (city.length === 3) {
      result += ')';
    }
  }

  if (first) {
    result += ` ${first}`;
  }

  if (second) {
    result += `-${second}`;
  }

  if (third) {
    result += `-${third}`;
  }

  return result;
};

export const formatPhoneInput = (value: string): string => {
  const digits = sanitizeDigits(value);

  if (!digits) {
    return '';
  }

  const normalized = ensureRussianPhoneDigits(digits);
  return buildMaskedPhone(normalized);
};

export const normalizePhoneNumber = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }

  const digits = sanitizeDigits(value);

  if (!digits) {
    return undefined;
  }

  const normalized = ensureRussianPhoneDigits(digits);

  return normalized ? `+${normalized}` : undefined;
};

export const formatPhoneDisplay = (value?: string | null): string => {
  if (!value) {
    return '';
  }

  const digits = sanitizeDigits(value);

  if (!digits) {
    return value;
  }

  const normalized = ensureRussianPhoneDigits(digits);

  if (!normalized) {
    return value;
  }

  return buildMaskedPhone(normalized);
};
