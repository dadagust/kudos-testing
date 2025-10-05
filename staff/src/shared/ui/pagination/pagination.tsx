'use client';

import clsx from 'clsx';
import { FC } from 'react';

import styles from './pagination.module.sass';

interface PaginationProps {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}

export const Pagination: FC<PaginationProps> = ({ page, pages, onChange }) => {
  if (pages <= 1) {
    return null;
  }

  const buttons = Array.from({ length: pages }, (_, index) => index + 1);

  return (
    <nav className={styles.pagination} aria-label="Пагинация">
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
      >
        ←
      </button>
      {buttons.map((number) => (
        <button
          key={number}
          type="button"
          className={clsx(styles.button, number === page && styles.active)}
          onClick={() => onChange(number)}
        >
          {number}
        </button>
      ))}
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(Math.min(pages, page + 1))}
        disabled={page === pages}
      >
        →
      </button>
    </nav>
  );
};
