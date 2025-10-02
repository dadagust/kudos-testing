"use client";

import clsx from "clsx";
import { FC, ReactNode } from "react";

import styles from "./tag.module.sass";

interface TagProps {
  children: ReactNode;
  className?: string;
}

export const Tag: FC<TagProps> = ({ children, className }) => (
  <span className={clsx(styles.tag, className)}>{children}</span>
);
