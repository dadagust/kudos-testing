import type { FC } from 'react';

import styles from './icon.module.sass';

type IconProps = {
  name: string;
  size?: number;
  className?: string;
};

export const Icon: FC<IconProps> = ({ name, size = 20, className }) => (
  <svg
    className={`${styles.icon}${className ? ` ${className}` : ''}`}
    width={size}
    height={size}
    aria-hidden
  >
    <use xlinkHref={`/sprite.svg#${name}`} />
  </svg>
);
