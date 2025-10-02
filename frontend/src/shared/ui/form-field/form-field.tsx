"use client";

import clsx from "clsx";
import { FC, ReactNode } from "react";

import styles from "./form-field.module.sass";

interface FormFieldProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export const FormField: FC<FormFieldProps> = ({ label, description, children, className }) => (
  <div className={clsx(styles.field, className)}>
    <span className={styles.label}>{label}</span>
    {description ? <span className={styles.description}>{description}</span> : null}
    <div className={styles.content}>{children}</div>
  </div>
);
