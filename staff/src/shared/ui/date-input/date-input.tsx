'use client';

import clsx from 'clsx';
import {
  ChangeEvent,
  DetailedHTMLProps,
  InputHTMLAttributes,
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Icon } from '../icon/icon';

import styles from './date-input.module.sass';

type NativeInputProps = Omit<
  DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>,
  'type' | 'value' | 'onChange'
>;

interface DateInputProps extends NativeInputProps {
  label?: string;
  helperText?: string;
  error?: string;
  value?: string; // ISO 'YYYY-MM-DD' или 'dd.mm.yyyy'
  onChange?: (value: string, event?: ChangeEvent<HTMLInputElement>) => void; // наружу всегда ISO
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DOT_DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/;

// Маска dd.mm.yyyy
const sanitizeDisplayValue = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const len = digits.length;

  if (len === 0) return '';
  if (len <= 2) return digits; // d / dd
  if (len <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`; // dd.m / dd.mm
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`; // dd.mm.yyyy
};

// В отображение с точками
const toDisplayValue = (value?: string): string => {
  if (!value) return '';
  const trimmed = value.trim();

  const iso = ISO_DATE_PATTERN.exec(trimmed);
  if (iso) {
    const [, y, m, d] = iso;
    return `${d}.${m}.${y}`;
  }

  const dot = DOT_DATE_PATTERN.exec(trimmed);
  if (dot) return dot[0];

  // БЕЗ replaceAll: нормализуем слэши через регэксп
  const guess = trimmed.indexOf('/') >= 0 ? trimmed.replace(/\//g, '.') : trimmed;
  const dotGuess = DOT_DATE_PATTERN.exec(guess);
  return dotGuess ? dotGuess[0] : '';
};

// В ISO
const toIsoValue = (display: string): string => {
  const m = DOT_DATE_PATTERN.exec(display);
  if (!m) return '';
  const [, dd, mm, yyyy] = m;

  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const valid =
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(yyyy) &&
    date.getMonth() + 1 === Number(mm) &&
    date.getDate() === Number(dd);

  return valid ? `${yyyy}-${mm}-${dd}` : '';
};

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ label, helperText, error, value, onChange, className, disabled, ...rest }, ref) => {
    const [displayValue, setDisplayValue] = useState<string>(() => toDisplayValue(value));
    const pickerRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      setDisplayValue(toDisplayValue(value));
    }, [value]);

    const handleDisplayChange = (event: ChangeEvent<HTMLInputElement>) => {
      const masked = sanitizeDisplayValue(event.target.value);
      setDisplayValue(masked);
      onChange?.(toIsoValue(masked), event);
    };

    const handlePickerChange = (event: ChangeEvent<HTMLInputElement>) => {
      const iso = event.target.value || '';
      setDisplayValue(toDisplayValue(iso));
      onChange?.(iso, event);
    };

    const inputPlaceholder = useMemo(() => rest.placeholder ?? 'dd.mm.yyyy', [rest.placeholder]);

    const openPicker = () => {
      if (disabled) return;
      const pickerBase = pickerRef.current;
      if (!pickerBase) return;
      // безопасный вызов showPicker без ошибок TS
      const picker = pickerBase as HTMLInputElement & { showPicker?: () => void };
      picker.focus({ preventScroll: true });
      if (picker.showPicker) picker.showPicker();
      else picker.click();
    };

    return (
      <label className={styles.inputWrapper}>
        {label ? <span className={styles.label}>{label}</span> : null}
        <div className={styles.control}>
          <input
            {...rest}
            ref={ref}
            className={clsx(styles.input, className, error && styles.error)}
            value={displayValue}
            onChange={handleDisplayChange}
            placeholder={inputPlaceholder}
            inputMode="numeric"
            disabled={disabled}
          />
          <input
            ref={pickerRef}
            type="date"
            className={styles.hiddenDateInput}
            value={
              ISO_DATE_PATTERN.test(value ?? '') ? (value as string) : toIsoValue(displayValue)
            }
            onChange={handlePickerChange}
            tabIndex={-1}
            disabled={disabled}
          />
          <button
            type="button"
            className={clsx(styles.calendarButton, disabled && styles.calendarButtonDisabled)}
            aria-label="Выбрать дату"
            disabled={disabled}
            onClick={openPicker}
          >
            <Icon name="calendar" size={18} />
          </button>
        </div>
        {error ? <span className={clsx(styles.helper, styles.helperError)}>{error}</span> : null}
        {!error && helperText ? <span className={styles.helper}>{helperText}</span> : null}
      </label>
    );
  }
);

DateInput.displayName = 'DateInput';
