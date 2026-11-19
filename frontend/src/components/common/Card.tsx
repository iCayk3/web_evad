import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'signature' | 'subtle';
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  hoverable = false,
  className,
  children,
  ...props
}) => {
  const baseClasses = 'relative transition-all duration-200';

  const variantClasses = {
    default:
      'bg-white rounded-2xl border border-slate-100/90 shadow-premium-card text-slate-900',
    signature:
      'bg-[#0A1938] text-white rounded-3xl shadow-signature border border-blue-900/30 overflow-hidden',
    subtle:
      'bg-slate-50/80 rounded-2xl border border-slate-200/70 text-slate-900',
  }[variant];

  const hoverClasses = hoverable
    ? 'hover:shadow-premium-hover hover:-translate-y-0.5 cursor-pointer'
    : '';

  return (
    <div
      className={twMerge(clsx(baseClasses, variantClasses, hoverClasses, className))}
      {...props}
    >
      {variant === 'signature' && (
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.07] overflow-hidden"
          aria-hidden="true"
        >
          <svg
            className="w-full h-full object-cover"
            viewBox="0 0 400 300"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="360" cy="50" r="160" stroke="#FFFFFF" strokeWidth="1.5" />
            <circle cx="360" cy="50" r="220" stroke="#FFFFFF" strokeWidth="1.5" />
            <circle cx="360" cy="50" r="280" stroke="#FFFFFF" strokeWidth="1.5" />
            <path
              d="M -50 200 C 50 150, 150 280, 300 220"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
          </svg>
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
};
