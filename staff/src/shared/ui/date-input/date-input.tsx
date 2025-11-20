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
  value?: string;
  onChange?: (value: string, event?: ChangeEvent<HTMLInputElement>) => void;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASHED_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const sanitizeDisplayValue = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('/');
};

const toDisplayValue = (value?: string): string => {
  if (!value) {
    return '';
  }
  const isoMatch = ISO_DATE_PATTERN.exec(value.trim());
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }
  const slashMatch = SLASHED_DATE_PATTERN.exec(value.trim());
  if (slashMatch) {
    return slashMatch[0];
  }
  return '';
};

const toIsoValue = (value: string): string => {
  const match = SLASHED_DATE_PATTERN.exec(value);
  if (!match) {
    return '';
  }
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() + 1 !== Number(month) ||
    date.getDate() !== Number(day)
  ) {
    return '';
  }
  return `${year}-${month}-${day}`;
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
      setDisplayValue(toDisplayValue(event.target.value));
      onChange?.(event.target.value, event);
    };

    const handlePickerOpen = () => {
      if (disabled) {
        return;
      }
      const picker = pickerRef.current;
      if (!picker) {
        return;
      }
      picker.focus({ preventScroll: true });
      if (picker.showPicker) {
        picker.showPicker();
      } else {
        picker.click();
      }
    };

    const inputPlaceholder = useMemo(() => rest.placeholder ?? 'dd/mm/yyyy', [rest.placeholder]);

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
          <button
            type="button"
            className={clsx(styles.calendarButton, disabled && styles.calendarButtonDisabled)}
            onClick={handlePickerOpen}
            aria-label="Выбрать дату"
            disabled={disabled}
          >
            <Icon name="calendar" size={18} />
          </button>
          <input
            ref={pickerRef}
            type="date"
            className={styles.hiddenDateInput}
            value={value ?? ''}
            onChange={handlePickerChange}
            tabIndex={-1}
            aria-hidden
            disabled={disabled}
          />
        </div>
        {error ? <span className={clsx(styles.helper, styles.helperError)}>{error}</span> : null}
        {!error && helperText ? <span className={styles.helper}>{helperText}</span> : null}
      </label>
    );
  }
);

DateInput.displayName = 'DateInput';
