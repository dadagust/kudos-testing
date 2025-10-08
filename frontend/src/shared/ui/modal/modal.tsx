'use client';

import clsx from 'clsx';
import { FC, ReactNode } from 'react';

import { Icon } from '../icon/icon';

import styles from './modal.module.sass';

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export const Modal: FC<ModalProps> = ({ open, title, onClose, children, className }) => {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal>
      <div className={clsx(styles.modal, className)}>
        <div className={styles.header}>
          {title ? <span className={styles.title}>{title}</span> : <span />}
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
