"use client";

import clsx from "clsx";
import { FC } from "react";

import styles from "./icon.module.sass";

interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

export const Icon: FC<IconProps> = ({ name, className, size = 20 }) => (
  <svg className={clsx(styles.icon, className)} width={size} height={size} aria-hidden>
    <use xlinkHref={`/icons/sprite.svg#${name}`} />
  </svg>
);
