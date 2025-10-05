'use client';

import clsx from 'clsx';
import { FC, ReactNode } from 'react';

import { Icon } from '../icon/icon';

import styles from './alert.module.sass';

type AlertTone = 'danger' | 'info' | 'success';

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}

const toneIcon: Record<AlertTone, string> = {
  danger: 'alert',
  info: 'info',
  success: 'check',
};

export const Alert: FC<AlertProps> = ({ tone = 'danger', title, children, className }) => (
  <div className={clsx(styles.alert, styles[tone], className)}>
    <Icon name={toneIcon[tone]} size={20} />
    <div>
      {title ? <strong>{title}</strong> : null}
      {children ? <div>{children}</div> : null}
    </div>
  </div>
);
