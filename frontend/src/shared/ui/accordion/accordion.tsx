'use client';

import clsx from 'clsx';
import { PropsWithChildren } from 'react';

import styles from './accordion.module.sass';

interface AccordionProps {
  className?: string;
}

export const Accordion = ({ children, className }: PropsWithChildren<AccordionProps>) => (
  <div className={clsx(styles.accordion, className)}>{children}</div>
);

interface AccordionItemProps {
  title: string;
  defaultOpen?: boolean;
}

export const AccordionItem = ({ title, defaultOpen, children }: PropsWithChildren<AccordionItemProps>) => (
  <details className={styles.item} open={defaultOpen}>
    <summary className={styles.summary}>{title}</summary>
    <div className={styles.content}>{children}</div>
  </details>
);
