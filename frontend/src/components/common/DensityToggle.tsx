import React from 'react';
import { AlignJustify, List } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type TableDensity = 'comfortable' | 'compact';

export interface DensityToggleProps {
  density: TableDensity;
  onChange: (density: TableDensity) => void;
  className?: string;
}

export const DensityToggle: React.FC<DensityToggleProps> = ({
  density,
  onChange,
  className,
}) => {
  return (
    <div
      className={twMerge(
        'inline-flex items-center p-1 bg-slate-100/90 rounded-full border border-slate-200/80 text-xs shadow-2xs',
        className
      )}
      role="group"
      aria-label="Alternar densidade da tabela"
    >
      <button
        type="button"
        onClick={() => onChange('comfortable')}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-all duration-150',
          density === 'comfortable'
            ? 'bg-white text-brand-primary shadow-xs font-semibold'
            : 'text-slate-600 hover:text-slate-900'
        )}
        title="Densidade Confortável (mais respiro)"
      >
        <AlignJustify className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Confortável</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('compact')}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition-all duration-150',
          density === 'compact'
            ? 'bg-white text-brand-primary shadow-xs font-semibold'
            : 'text-slate-600 hover:text-slate-900'
        )}
        title="Densidade Compacta (alta densidade de dados)"
      >
        <List className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Compacta</span>
      </button>
    </div>
  );
};
