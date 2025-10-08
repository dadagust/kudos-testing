'use client';

import clsx from 'clsx';
import { DetailedHTMLProps, InputHTMLAttributes, forwardRef } from 'react';

import styles from './input.module.sass';

type NativeInputProps = DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;

interface InputProps extends NativeInputProps {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, className, ...rest }, ref) => (
    <label className={styles.inputWrapper}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <input ref={ref} className={clsx(styles.input, className, error && styles.error)} {...rest} />
      {error ? <span className={clsx(styles.helper, styles.helperError)}>{error}</span> : null}
      {!error && helperText ? <span className={styles.helper}>{helperText}</span> : null}
    </label>
  )
);

Input.displayName = 'Input';
