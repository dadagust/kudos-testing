"use client";

import clsx from "clsx";
import { FC, ReactNode } from "react";

import styles from "./badge.module.sass";

type BadgeTone = "success" | "warning" | "danger" | "info";

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const toneClass: Record<BadgeTone, string | null> = {
  success: null,
  warning: styles.warning,
  danger: styles.danger,
  info: styles.info,
};

export const Badge: FC<BadgeProps> = ({ tone = "success", children, className }) => (
  <span className={clsx(styles.badge, toneClass[tone], className)}>{children}</span>
);
