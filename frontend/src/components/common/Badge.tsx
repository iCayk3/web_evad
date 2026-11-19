import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type BadgeVariant =
  | 'ok'
  | 'risk'
  | 'overdue'
  | 'primary'
  | 'secondary'
  | 'neutral'
  | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  pulse?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  pulse = false,
  icon: Icon,
  className,
  children,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap';

  const variantClasses: Record<BadgeVariant, string> = {
    ok: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
    risk: 'bg-amber-50 text-amber-700 border border-amber-200/60',
    overdue: 'bg-rose-50 text-rose-700 border border-rose-200/60',
    primary: 'bg-brand-primary-light text-brand-primary border border-blue-200/60',
    secondary: 'bg-amber-50 text-amber-800 border border-amber-200/60',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200/70',
    outline: 'bg-white text-slate-700 border border-slate-300',
  };

  const pulseColors: Record<BadgeVariant, string> = {
    ok: 'bg-emerald-500',
    risk: 'bg-amber-500',
    overdue: 'bg-rose-500',
    primary: 'bg-brand-primary',
    secondary: 'bg-amber-500',
    neutral: 'bg-slate-400',
    outline: 'bg-slate-400',
  };

  return (
    <span
      className={twMerge(clsx(baseClasses, variantClasses[variant], className))}
      {...props}
    >
      {pulse && (
        <span
          className={twMerge(
            'w-1.5 h-1.5 rounded-full animate-pulse shrink-0',
            pulseColors[variant]
          )}
          aria-hidden="true"
        />
      )}
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      <span>{children}</span>
    </span>
  );
};
