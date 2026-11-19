import React, { useState } from 'react';
import {
  Inbox,
  AlertOctagon,
  Clock,
  ArrowDownRight,
  CheckCircle,
  Percent,
  Repeat,
  Info,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
} from 'lucide-react';

interface MetricCardProps {
  id: string;
  name: string;
  value: number | string;
  changePercent: number | null;
  definition: string;
  coverage: number;
  unit?: string;
  onClick: () => void;
  accent?: 'normal' | 'danger' | 'warning' | 'success';
  icon: React.ElementType;
}

const MetricCard: React.FC<MetricCardProps> = ({
  id,
  name,
  value,
  changePercent,
  definition,
  coverage,
  onClick,
  accent = 'normal',
  icon: Icon,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const getAccentStyles = () => {
    switch (accent) {
      case 'danger':
        return {
          iconBg: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200/70',
          borderHover: 'hover:border-rose-300',
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/70',
          borderHover: 'hover:border-amber-300',
        };
      case 'success':
        return {
          iconBg: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70',
          borderHover: 'hover:border-emerald-300',
        };
      default:
        return {
          iconBg: 'bg-brand-primary-light text-brand-primary ring-1 ring-blue-200/70',
          borderHover: 'hover:border-brand-primary/40',
        };
    }
  };

  const { iconBg, borderHover } = getAccentStyles();

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`relative p-5 rounded-2xl bg-white border border-slate-100/90 shadow-premium-card hover:shadow-premium-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between group ${borderHover}`}
      aria-label={`Indicador: ${name}, Valor: ${value}. Clique para abrir detalhamento.`}
    >
      <div>
        {/* Topo do Card: Ícone em recipiente arredondado + Pílula de variação ou info */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${iconBg}`}>
            <Icon className="w-5 h-5" strokeWidth={1.75} />
          </div>

          <div className="flex items-center gap-1.5">
            {changePercent !== null ? (
              <span
                className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border shadow-2xs ${
                  changePercent > 0
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200/70'
                    : changePercent < 0
                    ? 'text-rose-700 bg-rose-50 border-rose-200/70'
                    : 'text-slate-600 bg-slate-50 border-slate-200'
                }`}
              >
                {changePercent > 0 ? (
                  <TrendingUp className="w-3 h-3 mr-0.5 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-0.5 text-rose-600" />
                )}
                {changePercent > 0 ? `+${changePercent}%` : `${changePercent}%`}
              </span>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTooltip(!showTooltip);
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label={`Fórmula de cálculo de ${name}`}
                >
                  <Info className="w-3.5 h-3.5" />
                </button>

                {showTooltip && (
                  <div className="absolute right-0 top-8 z-30 w-64 p-3 bg-slate-900/95 backdrop-blur-sm text-white text-[11px] rounded-xl shadow-xl border border-slate-700 pointer-events-none">
                    <div className="font-semibold text-slate-200 mb-1">Como é apurado:</div>
                    <div className="text-slate-300 font-mono text-[10px] bg-slate-800/80 p-2 rounded-lg mb-1.5 border border-slate-700">
                      {definition}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Cobertura: <strong className="text-emerald-400">{coverage}% dos registros</strong>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Valor em destaque com número tabular */}
        <div className="mt-1">
          <div className="text-3xl font-bold tracking-tight text-slate-900 font-sans">
            {value}
          </div>
          <div className="text-xs font-medium text-slate-500 mt-1 leading-snug">
            {name}
          </div>
        </div>
      </div>

      {/* Rodapé com link de drill-down elegante */}
      <div className="mt-4 pt-3 border-t border-slate-100/90 flex items-center justify-between text-[11px] text-slate-400">
        <span className="truncate group-hover:text-slate-600 transition-colors">
          Ver chamados
        </span>
        <div className="w-5 h-5 rounded-full bg-slate-50 group-hover:bg-brand-primary-light flex items-center justify-center transition-colors">
          <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-brand-primary transition-colors" />
        </div>
      </div>
    </div>
  );
};

interface MetricCardsGridProps {
  cards: Record<string, any>;
  onCardClick: (metricId: string) => void;
}

export const MetricCardsGrid: React.FC<MetricCardsGridProps> = ({ cards, onCardClick }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Atendimentos Abertos */}
      {cards.atendimentos_abertos && (
        <MetricCard
          id="atendimentos_abertos"
          name={cards.atendimentos_abertos.name}
          value={cards.atendimentos_abertos.value}
          changePercent={cards.atendimentos_abertos.changePercent}
          definition={cards.atendimentos_abertos.definition}
          coverage={cards.atendimentos_abertos.coverage}
          icon={Inbox}
          onClick={() => onCardClick('atendimentos_abertos')}
        />
      )}

      {/* 2. SLA Vencido */}
      {cards.sla_vencido && (
        <MetricCard
          id="sla_vencido"
          name={cards.sla_vencido.name}
          value={cards.sla_vencido.value}
          changePercent={cards.sla_vencido.changePercent}
          definition={cards.sla_vencido.definition}
          coverage={cards.sla_vencido.coverage}
          accent="danger"
          icon={AlertOctagon}
          onClick={() => onCardClick('sla_vencido')}
        />
      )}

      {/* 3. SLA em Risco */}
      {cards.sla_em_risco && (
        <MetricCard
          id="sla_em_risco"
          name={cards.sla_em_risco.name}
          value={cards.sla_em_risco.value}
          changePercent={cards.sla_em_risco.changePercent}
          definition={cards.sla_em_risco.definition}
          coverage={cards.sla_em_risco.coverage}
          accent="warning"
          icon={Clock}
          onClick={() => onCardClick('sla_em_risco')}
        />
      )}

      {/* 4. Taxa de Cumprimento de SLA */}
      {cards.taxa_cumprimento_sla && (
        <MetricCard
          id="taxa_cumprimento_sla"
          name={cards.taxa_cumprimento_sla.name}
          value={cards.taxa_cumprimento_sla.value}
          changePercent={cards.taxa_cumprimento_sla.changePercent}
          definition={cards.taxa_cumprimento_sla.definition}
          coverage={cards.taxa_cumprimento_sla.coverage}
          accent="success"
          icon={Percent}
          onClick={() => onCardClick('taxa_cumprimento_sla')}
        />
      )}

      {/* 5. Entradas no Período */}
      {cards.entradas_periodo && (
        <MetricCard
          id="entradas_periodo"
          name={cards.entradas_periodo.name}
          value={cards.entradas_periodo.value}
          changePercent={cards.entradas_periodo.changePercent}
          definition={cards.entradas_periodo.definition}
          coverage={cards.entradas_periodo.coverage}
          icon={ArrowDownRight}
          onClick={() => onCardClick('entradas_periodo')}
        />
      )}

      {/* 6. Concluídos no Período */}
      {cards.concluidos_periodo && (
        <MetricCard
          id="concluidos_periodo"
          name={cards.concluidos_periodo.name}
          value={cards.concluidos_periodo.value}
          changePercent={cards.concluidos_periodo.changePercent}
          definition={cards.concluidos_periodo.definition}
          coverage={cards.concluidos_periodo.coverage}
          icon={CheckCircle}
          onClick={() => onCardClick('concluidos_periodo')}
        />
      )}

      {/* 7. Clientes com Recorrência */}
      {cards.clientes_com_recorrencia && (
        <MetricCard
          id="clientes_com_recorrencia"
          name={cards.clientes_com_recorrencia.name}
          value={cards.clientes_com_recorrencia.value}
          changePercent={cards.clientes_com_recorrencia.changePercent}
          definition={cards.clientes_com_recorrencia.definition}
          coverage={cards.clientes_com_recorrencia.coverage}
          accent="warning"
          icon={Repeat}
          onClick={() => onCardClick('clientes_com_recorrencia')}
        />
      )}
    </div>
  );
};
