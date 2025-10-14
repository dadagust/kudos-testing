'use client';

import clsx from 'clsx';
import { FC, ReactNode } from 'react';

import styles from './tag.module.sass';

type TagTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface TagProps {
  children: ReactNode;
  className?: string;
  tone?: TagTone;
}

const toneClassNames: Record<TagTone, string | undefined> = {
  default: undefined,
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger,
  info: styles.info,
};

export const Tag: FC<TagProps> = ({ children, className, tone = 'default' }) => (
  <span className={clsx(styles.tag, toneClassNames[tone], className)}>{children}</span>
);
