"use client";

import clsx from "clsx";
import { DetailedHTMLProps, SelectHTMLAttributes, forwardRef } from "react";

import styles from "./select.module.sass";

type NativeSelectProps = DetailedHTMLProps<
  SelectHTMLAttributes<HTMLSelectElement>,
  HTMLSelectElement
>;

interface SelectProps extends NativeSelectProps {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, error, className, children, ...rest }, ref) => (
    <label className={styles.selectWrapper}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <select ref={ref} className={clsx(styles.select, className, error && styles.error)} {...rest}>
        {children}
      </select>
      {error ? <span className={clsx(styles.helper, styles.helperError)}>{error}</span> : null}
      {!error && helperText ? <span className={styles.helper}>{helperText}</span> : null}
    </label>
  ),
);

Select.displayName = "Select";
