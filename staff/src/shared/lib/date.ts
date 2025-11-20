const pad = (value: number): string => value.toString().padStart(2, '0');

const DISPLAY_DATE_PATTERN = /^(\d{2})([./])(\d{2})\2(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;
const ISO_DATE_TIME_WITH_SECONDS_PATTERN = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/;
const TIME_ONLY_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

interface ParsedDateParts {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  hasTime: boolean;
  hasSeconds: boolean;
}

const createDateFromParts = (parts: ParsedDateParts, useUTC = false): Date | null => {
  const { year, month, day, hours, minutes, seconds } = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = useUTC
    ? new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, 0))
    : new Date(year, month - 1, day, hours, minutes, seconds, 0);
  if (
    (useUTC ? date.getUTCFullYear() : date.getFullYear()) !== year ||
    (useUTC ? date.getUTCMonth() : date.getMonth()) + 1 !== month ||
    (useUTC ? date.getUTCDate() : date.getDate()) !== day
  ) {
    return null;
  }
  return date;
};

const parseDisplayDate = (value: string): ParsedDateParts | null => {
  const match = DISPLAY_DATE_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, dayRaw, , monthRaw, yearRaw, hoursRaw, minutesRaw, secondsRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hours = hoursRaw ? Number(hoursRaw) : 0;
  const minutes = minutesRaw ? Number(minutesRaw) : 0;
  const seconds = secondsRaw ? Number(secondsRaw) : 0;
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds)
  ) {
    return null;
  }
  const parts: ParsedDateParts = {
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    hasTime: Boolean(hoursRaw || minutesRaw || secondsRaw),
    hasSeconds: Boolean(secondsRaw),
  };
  return createDateFromParts(parts, true) ? parts : null;
};

const parseIsoLikeDate = (value: string): ParsedDateParts | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalised = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const parsed = new Date(normalised);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const hasTime = ISO_DATE_TIME_PATTERN.test(trimmed);
  const hasSeconds = ISO_DATE_TIME_WITH_SECONDS_PATTERN.test(trimmed);
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
    hours: parsed.getHours(),
    minutes: parsed.getMinutes(),
    seconds: parsed.getSeconds(),
    hasTime,
    hasSeconds,
  };
};

const parseDateParts = (value: string | null | undefined): ParsedDateParts | null => {
  if (!value) {
    return null;
  }
  return parseDisplayDate(value) ?? parseIsoLikeDate(value);
};

const formatDateParts = (parts: ParsedDateParts): string =>
  `${pad(parts.day)}/${pad(parts.month)}/${parts.year}`;

const formatTimeParts = (parts: ParsedDateParts): string => {
  if (!parts.hasTime) {
    return '';
  }
  const base = `${pad(parts.hours)}:${pad(parts.minutes)}`;
  return parts.hasSeconds ? `${base}:${pad(parts.seconds)}` : base;
};

export const formatDateDisplay = (value: string | null | undefined): string | null => {
  const parts = parseDateParts(value);
  if (!parts) {
    return null;
  }
  return formatDateParts(parts);
};

export const formatDateTimeDisplay = (value: string | null | undefined): string | null => {
  const parts = parseDateParts(value);
  if (!parts) {
    return null;
  }
  const datePart = formatDateParts(parts);
  const timePart = formatTimeParts(parts);
  return timePart ? `${datePart} ${timePart}` : datePart;
};

export const toDateInputValue = (value: string | null | undefined): string => {
  const parts = parseDateParts(value);
  if (!parts) {
    return '';
  }
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
};

export const toServerDateValue = (value: string | null | undefined): string => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  const parts = parseDateParts(trimmed);
  if (!parts) {
    return trimmed;
  }
  return formatDateParts(parts);
};

export const toTimestamp = (value: string | null | undefined): number | null => {
  const parts = parseDateParts(value);
  if (!parts) {
    return null;
  }
  const date = createDateFromParts(parts, false);
  return date ? date.getTime() : null;
};

export const nowDateTimeString = (): string => {
  const iso = new Date().toISOString();
  return formatDateTimeDisplay(iso) ?? iso;
};

export const ensureDateDisplay = (value: string | null | undefined, fallback = '—'): string =>
  formatDateDisplay(value) ?? (value ? value : fallback);

export const ensureDateTimeDisplay = (value: string | null | undefined, fallback = '—'): string =>
  formatDateTimeDisplay(value) ?? (value ? value : fallback);

export const formatTimeDisplay = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return null;
  }
  const match = TIME_ONLY_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }
  const [, hours, minutes] = match;
  return `${hours}:${minutes}`;
};

export const ensureTimeDisplay = (value: string | null | undefined, fallback = '—'): string =>
  formatTimeDisplay(value) ?? (value ? value : fallback);

export const toTimeInputValue = (value: string | null | undefined): string => {
  const formatted = formatTimeDisplay(value);
  return formatted ?? '';
};
