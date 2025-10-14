'use client';

import clsx from 'clsx';
import { FC } from 'react';

import styles from './spinner.module.sass';

interface SpinnerProps {
  label?: string;
  className?: string;
  fullscreen?: boolean;
}

export const Spinner: FC<SpinnerProps> = ({ label, className, fullscreen }) => {
  const content = (
    <div className={clsx(styles.spinner, className)}>
      <svg width={32} height={32} viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          opacity="0.2"
        />
        <path
          d="M22 12a10 10 0 0 1-10 10"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {label ? <span>{label}</span> : null}
    </div>
  );

  if (fullscreen) {
    return <div className={styles.fullscreen}>{content}</div>;
  }

  return content;
};
