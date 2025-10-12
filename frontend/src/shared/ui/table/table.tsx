'use client';

import { ReactNode } from 'react';

import styles from './table.module.sass';

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage?: string;
}

type TableRowRecord = Record<PropertyKey, unknown>;

export const Table = <T extends object>({ columns, data, emptyMessage }: TableProps<T>) => {
  if (!data.length) {
    return <div className={styles.emptyState}>{emptyMessage ?? 'Нет данных для отображения.'}</div>;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={String(column.key)}>
                  {column.render
                    ? column.render(row)
                    : ((row as TableRowRecord)[column.key as keyof TableRowRecord] as ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
