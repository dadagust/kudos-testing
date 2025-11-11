'use client';

import clsx from 'clsx';
import { ChangeEvent, FocusEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Input, Spinner } from '@/shared/ui';
import {
  YandexGeocodeResult,
  YandexSuggestItem,
  fetchAddressSuggestions,
  geocodeAddress,
} from '@/shared/api/yandexMaps';

import styles from './yandex-address-input.module.sass';

type ValidationStatus = 'idle' | 'pending' | 'validated' | 'error';

export interface AddressValidationInfo {
  status: ValidationStatus;
  normalized?: string;
  exact?: boolean;
  message?: string;
}

interface YandexAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  error?: string;
  onValidationChange?: (info: {
    state: AddressValidationInfo;
    geocode?: YandexGeocodeResult | null;
  }) => void;
}

const DEFAULT_VALIDATION: AddressValidationInfo = { status: 'idle' };

export const YandexAddressInput = ({
  value,
  onChange,
  label,
  placeholder,
  required,
  disabled,
  helperText,
  error,
  onValidationChange,
}: YandexAddressInputProps) => {
  const [suggestions, setSuggestions] = useState<YandexSuggestItem[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoadingSuggest, setIsLoadingSuggest] = useState(false);
  const [validation, setValidation] = useState<AddressValidationInfo>(DEFAULT_VALIDATION);
  const fetchAbortController = useRef<AbortController | null>(null);
  const geocodeAbortController = useRef<AbortController | null>(null);
  const focusTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  const handleFocus = () => {
    if (focusTimeout.current) {
      clearTimeout(focusTimeout.current);
    }
    setIsDropdownOpen(true);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (focusTimeout.current) {
      clearTimeout(focusTimeout.current);
    }
    focusTimeout.current = setTimeout(() => {
      if (!event.currentTarget.contains(document.activeElement)) {
        closeDropdown();
      }
    }, 150);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    onChange(nextValue);
    setValidation({ status: 'idle' });
    onValidationChange?.({ state: { status: 'idle' } });
    setIsDropdownOpen(true);
  };

  const performGeocode = useCallback(
    async (query: string) => {
      if (!onValidationChange) {
        return;
      }
      if (geocodeAbortController.current) {
        geocodeAbortController.current.abort();
      }
      const controller = new AbortController();
      geocodeAbortController.current = controller;
      setValidation({ status: 'pending' });
      onValidationChange({ state: { status: 'pending' } });
      try {
        const geocode = await geocodeAddress(query, { signal: controller.signal });
        if (!geocode) {
          const state: AddressValidationInfo = {
            status: 'error',
            message: 'Адрес не найден. Уточните запрос.',
          };
          setValidation(state);
          onValidationChange({ state, geocode: null });
          return;
        }
        const state: AddressValidationInfo = {
          status: 'validated',
          normalized: geocode.normalized,
          exact: geocode.kind === 'house' && geocode.precision === 'exact',
        };
        setValidation(state);
        onValidationChange({ state, geocode });
      } catch (error_) {
        if ((error_ as Error).name === 'AbortError') {
          return;
        }
        const state: AddressValidationInfo = {
          status: 'error',
          message: 'Не удалось проверить адрес. Попробуйте снова.',
        };
        setValidation(state);
        onValidationChange?.({ state, geocode: null });
      }
    },
    [onValidationChange]
  );

  const handleSuggestionClick = (suggestion: YandexSuggestItem) => {
    onChange(suggestion.value);
    closeDropdown();
    void performGeocode(suggestion.value);
  };

  useEffect(() => {
    if (!isDropdownOpen) {
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      setSuggestions([]);
      setIsLoadingSuggest(false);
      return;
    }

    if (fetchAbortController.current) {
      fetchAbortController.current.abort();
    }
    const controller = new AbortController();
    fetchAbortController.current = controller;
    setIsLoadingSuggest(true);
    const timer = setTimeout(() => {
      fetchAddressSuggestions(trimmed, { signal: controller.signal })
        .then((items) => {
          setSuggestions(items);
        })
        .catch((error_) => {
          if ((error_ as Error).name === 'AbortError') {
            return;
          }
          setSuggestions([]);
        })
        .finally(() => {
          setIsLoadingSuggest(false);
        });
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isDropdownOpen, value]);

  useEffect(() => {
    return () => {
      if (focusTimeout.current) {
        clearTimeout(focusTimeout.current);
      }
      fetchAbortController.current?.abort();
      geocodeAbortController.current?.abort();
    };
  }, []);

  const validationMessage = useMemo(() => {
    if (validation.status === 'pending') {
      return 'Проверяем адрес…';
    }
    if (validation.status === 'validated') {
      if (!validation.normalized) {
        return 'Адрес подтверждён.';
      }
      const prefix = validation.exact ? 'Адрес подтверждён' : 'Адрес уточнён';
      return `${prefix}: ${validation.normalized}`;
    }
    if (validation.status === 'error') {
      return validation.message ?? 'Не удалось подтвердить адрес.';
    }
    return helperText;
  }, [helperText, validation]);

  return (
    <div className={styles.wrapper}>
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        required={required}
        disabled={disabled}
        error={error}
        helperText={validationMessage}
        autoComplete="off"
      />
      {isDropdownOpen && (suggestions.length > 0 || isLoadingSuggest) ? (
        <div className={styles.dropdown}>
          {isLoadingSuggest ? (
            <div className={styles.dropdownStatus}>
              <Spinner size="sm" />
              <span>Ищем подсказки…</span>
            </div>
          ) : null}
          <ul className={clsx(styles.list, isLoadingSuggest && styles.listLoading)}>
            {suggestions.map((suggestion) => (
              <li key={`${suggestion.value}-${suggestion.uri ?? ''}`}>
                <button
                  type="button"
                  className={styles.item}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <span className={styles.itemTitle}>{suggestion.title}</span>
                  {suggestion.subtitle ? (
                    <span className={styles.itemSubtitle}>{suggestion.subtitle}</span>
                  ) : null}
                </button>
              </li>
            ))}
            {!isLoadingSuggest && suggestions.length === 0 ? (
              <li>
                <div className={styles.dropdownStatus}>Подсказки не найдены.</div>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
