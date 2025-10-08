'use client';

import clsx from 'clsx';
import { ButtonHTMLAttributes, DetailedHTMLProps, FC, ReactNode } from 'react';

import { Icon } from '../icon/icon';

import styles from './button.module.sass';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';

type NativeButtonProps = DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>;

interface ButtonProps extends Omit<NativeButtonProps, 'type'> {
  variant?: ButtonVariant;
  iconLeft?: string;
  iconRight?: string;
  type?: 'button' | 'submit' | 'reset';
  children: ReactNode;
}

export const Button: FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  iconLeft,
  iconRight,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    className={clsx(styles.button, className, variant !== 'primary' && styles[variant])}
    {...rest}
  >
    {iconLeft ? <Icon name={iconLeft} size={18} /> : null}
    {children}
    {iconRight ? <Icon name={iconRight} size={18} /> : null}
  </button>
);
