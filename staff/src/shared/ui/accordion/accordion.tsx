'use client';

import clsx from 'clsx';
import { FC, ReactNode, useState } from 'react';

import { Icon } from '../icon/icon';

import styles from './accordion.module.sass';

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
}

export const Accordion: FC<AccordionProps> = ({
  title,
  children,
  defaultOpen = false,
  actions,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={clsx(styles.accordion, open && styles.open)}>
      <button type="button" className={styles.header} onClick={() => setOpen((prev) => !prev)}>
        <span className={styles.title}>{title}</span>
        <span className={styles.controls}>
          {actions ? <span className={styles.actions}>{actions}</span> : null}
          <span className={styles.chevron} aria-hidden>
            <Icon name="chevron-down" size={14} />
          </span>
        </span>
      </button>
      {open ? <div className={styles.content}>{children}</div> : null}
    </div>
  );
};
