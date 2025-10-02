"use client";

import { FC, ReactNode } from "react";

import styles from "./drawer.module.sass";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export const Drawer: FC<DrawerProps> = ({ open, onClose, children }) => {
  if (!open) {
    return null;
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} role="presentation" />
      <aside className={styles.drawer}>{children}</aside>
    </>
  );
};
