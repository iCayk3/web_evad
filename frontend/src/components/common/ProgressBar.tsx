import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
  max?: number;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'amber';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  color = 'primary',
  size = 'md',
  showLabel = false,
  className,
  ...props
}) => {
  const percentage = Math.min(Math.max(0, (value / max) * 100), 100);

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  }[size];

  const colorClasses = {
    primary: 'bg-brand-primary',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    amber: 'bg-[#EF8F00]',
  }[color];

  return (
    <div className={twMerge('w-full', className)} {...props}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mb-1.5">
          <span>Progresso</span>
          <span className="font-mono">{percentage.toFixed(0)}%</span>
        </div>
      )}
      <div
        className={twMerge(
          'w-full bg-slate-100 rounded-full overflow-hidden p-0.5',
          sizeClasses
        )}
      >
        <div
          className={twMerge(
            'h-full rounded-full transition-all duration-500 ease-out',
            colorClasses
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
