import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface PillButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  shape?: 'pill' | 'rounded' | 'circle';
  icon?: React.ComponentType<{ className?: string }>;
  iconPosition?: 'left' | 'right';
}

export const PillButton: React.FC<PillButtonProps> = ({
  variant = 'primary',
  size = 'md',
  shape = 'pill',
  icon: Icon,
  iconPosition = 'left',
  className,
  children,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-offset-2';

  const shapeClasses = {
    pill: 'rounded-full',
    rounded: 'rounded-xl',
    circle: 'rounded-full aspect-square p-0',
  }[shape];

  const sizeClasses = {
    sm: shape === 'circle' ? 'w-8 h-8 text-xs' : 'px-3 py-1.5 text-xs gap-1.5',
    md: shape === 'circle' ? 'w-10 h-10 text-sm' : 'px-4 py-2 text-xs font-semibold gap-2',
    lg: shape === 'circle' ? 'w-12 h-12 text-base' : 'px-5 py-2.5 text-sm font-semibold gap-2.5',
  }[size];

  const variantClasses = {
    primary:
      'bg-brand-primary text-white hover:bg-brand-primary-hover shadow-sm focus-visible:ring-brand-primary',
    secondary:
      'bg-brand-primary-light text-brand-primary hover:bg-blue-100 focus-visible:ring-brand-primary',
    outline:
      'bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 shadow-2xs focus-visible:ring-slate-400',
    ghost:
      'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400',
    danger:
      'bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-rose-100 focus-visible:ring-rose-500',
  }[variant];

  return (
    <button
      className={twMerge(clsx(baseClasses, shapeClasses, sizeClasses, variantClasses, className))}
      {...props}
    >
      {Icon && iconPosition === 'left' && (
        <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      )}
      {children}
      {Icon && iconPosition === 'right' && (
        <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      )}
    </button>
  );
};
