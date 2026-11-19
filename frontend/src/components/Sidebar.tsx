import React from 'react';
import { 
  Building2, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  Wifi,
  TrendingUp,
  Wrench,
  LayoutDashboard,
  Headphones,
  ClipboardCheck,
  Users,
  ShieldCheck
} from 'lucide-react';

export type MainMenuOption = 
  | 'empresa' 
  | 'autenticacoes'
  | 'recuperados' 
  | 'commercial' 
  | 'os_analytics' 
  | 'gestao' 
  | 'omnichannel' 
  | 'atendimentos' 
  | 'clientes' 
  | 'audit';

interface SidebarProps {
  currentMenu: MainMenuOption;
  onSelectMenu: (menu: MainMenuOption) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  rbxStatus?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentMenu,
  onSelectMenu,
  isCollapsed,
  onToggleCollapse,
  rbxStatus = 'conectado',
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const handleNavClick = (menu: MainMenuOption) => {
    onSelectMenu(menu);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Backdrop para mobile quando o menu lateral estiver aberto */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      <aside
        className={`
          fixed lg:static top-0 bottom-0 left-0 z-50
          bg-white text-slate-800
          border-r border-slate-200
          flex flex-col justify-between
          transition-all duration-300 ease-in-out
          print:hidden select-none h-screen
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Topo: Logo & Branding */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="h-16 flex items-center px-4 border-b border-slate-200 justify-between shrink-0">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-lg shadow-xs shrink-0">
                <Wifi className="w-5 h-5 text-white" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0 transition-opacity duration-200">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-extrabold text-slate-900 text-base tracking-tight truncate">
                      EVAD
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded font-bold">
                      ISP
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    Gestão Telecom & RBX
                  </p>
                </div>
              )}
            </div>

            {/* Botão de colapsar (visível em desktop) */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title={isCollapsed ? 'Expandir Menu' : 'Recolher Menu'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Seção de Navegação com Rolagem Suave */}
          <div className="p-3 space-y-1 overflow-y-auto flex-1">
            {!isCollapsed && (
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Corporativo & Retenção
              </div>
            )}

            {/* Minha Empresa */}
            <button
              type="button"
              onClick={() => handleNavClick('empresa')}
              title="Minha Empresa (Dados corporativos, filiais e estrutura)"
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer text-left group
                ${currentMenu === 'empresa'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                currentMenu === 'empresa' 
                  ? 'bg-white/15 text-white' 
                  : 'bg-slate-100 text-slate-600 group-hover:text-slate-900 group-hover:bg-slate-200/60'
              }`}>
                <Building2 className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px]">Minha Empresa</span>
                  </div>
                  <p className={`text-[10px] truncate ${
                    currentMenu === 'empresa' ? 'text-slate-300' : 'text-slate-400'
                  }`}>
                    Visão geral corporativa
                  </p>
                </div>
              )}
            </button>

            {/* Clientes Recuperados */}
            <button
              type="button"
              onClick={() => handleNavClick('recuperados')}
              title="Clientes Recuperados (Retenção, Coortes, KPIs e Recuperação de Equipamentos)"
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer text-left group
                ${currentMenu === 'recuperados'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                currentMenu === 'recuperados' 
                  ? 'bg-white/15 text-white' 
                  : 'bg-slate-100 text-slate-600 group-hover:text-slate-900 group-hover:bg-slate-200/60'
              }`}>
                <RotateCcw className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px]">Clientes Recuperados</span>
                  </div>
                  <p className={`text-[10px] truncate ${
                    currentMenu === 'recuperados' ? 'text-slate-300' : 'text-slate-400'
                  }`}>
                    Retenção, KPIs & Hardware
                  </p>
                </div>
              )}
            </button>

            {!isCollapsed && (
              <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Operações & RBX
              </div>
            )}

            {/* CRM Comercial */}
            <button
              type="button"
              onClick={() => handleNavClick('commercial')}
              title="CRM Comercial (Leads, Funil, Vendas e Cancelamentos)"
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer text-left group
                ${currentMenu === 'commercial'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                currentMenu === 'commercial' 
                  ? 'bg-white/15 text-white' 
                  : 'bg-slate-100 text-slate-600 group-hover:text-slate-900 group-hover:bg-slate-200/60'
              }`}>
                <TrendingUp className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px]">CRM Comercial</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      Vendas
                    </span>
                  </div>
                  <p className={`text-[10px] truncate ${
                    currentMenu === 'commercial' ? 'text-slate-300' : 'text-slate-400'
                  }`}>
                    Leads, Funil & Fechamentos
                  </p>
                </div>
              )}
            </button>

            {/* Análise de OS */}
            <button
              type="button"
              onClick={() => handleNavClick('os_analytics')}
              title="Análise de Ordens de Serviço (Produtividade, SLA e OS Abortadas)"
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer text-left group
                ${currentMenu === 'os_analytics'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                currentMenu === 'os_analytics' 
                  ? 'bg-white/15 text-white' 
                  : 'bg-slate-100 text-slate-600 group-hover:text-slate-900 group-hover:bg-slate-200/60'
              }`}>
                <Wrench className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px]">Análise de OS</span>
                  </div>
                  <p className={`text-[10px] truncate ${
                    currentMenu === 'os_analytics' ? 'text-slate-300' : 'text-slate-400'
                  }`}>
                    Produtividade, SLA & Abortadas
                  </p>
                </div>
              )}
            </button>

            {/* Painel de Gestão & SLA */}
            <button
              type="button"
              onClick={() => handleNavClick('gestao')}
              title="Painel de Gestão (SLA, Distribuição por Fila e Causas)"
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer text-left group
                ${currentMenu === 'gestao'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                currentMenu === 'gestao' 
                  ? 'bg-white/15 text-white' 
                  : 'bg-slate-100 text-slate-600 group-hover:text-slate-900 group-hover:bg-slate-200/60'
              }`}>
                <LayoutDashboard className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px]">Painel de Gestão</span>
                  </div>
                  <p className={`text-[10px] truncate ${
                    currentMenu === 'gestao' ? 'text-slate-300' : 'text-slate-400'
                  }`}>
                    Indicadores, Prazos & SLA
                  </p>
                </div>
              )}
            </button>

            {/* Omnichannel & ISPCHAT */}
            <button
              type="button"
              onClick={() => handleNavClick('omnichannel')}
              title="Omnichannel & ISPCHAT (Saúde do Cliente e Termômetro de Churn)"
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer text-left group
                ${currentMenu === 'omnichannel'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                currentMenu === 'omnichannel' 
                  ? 'bg-white/15 text-white' 
                  : 'bg-slate-100 text-slate-600 group-hover:text-slate-900 group-hover:bg-slate-200/60'
              }`}>
                <Headphones className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px]">Omnichannel ISPCHAT</span>
                  </div>
                  <p className={`text-[10px] truncate ${
                    currentMenu === 'omnichannel' ? 'text-slate-300' : 'text-slate-400'
                  }`}>
                    Atendimento, Churn & Saúde
                  </p>
                </div>
              )}
            </button>

            {/* Atendimentos */}
            <button
              type="button"
              onClick={() => handleNavClick('atendimentos')}
              title="Atendimentos (Chamados e Fila em Tempo Real)"
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer text-left group
                ${currentMenu === 'atendimentos'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                currentMenu === 'atendimentos' 
                  ? 'bg-white/15 text-white' 
                  : 'bg-slate-100 text-slate-600 group-hover:text-slate-900 group-hover:bg-slate-200/60'
              }`}>
                <ClipboardCheck className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px]">Atendimentos</span>
                  </div>
                  <p className={`text-[10px] truncate ${
                    currentMenu === 'atendimentos' ? 'text-slate-300' : 'text-slate-400'
                  }`}>
                    Fila & Chamados RBX
                  </p>
                </div>
              )}
            </button>

            {/* Clientes */}
            <button
              type="button"
              onClick={() => handleNavClick('clientes')}
              title="Clientes (Consulta da Base e Histórico de Chamados)"
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer text-left group
                ${currentMenu === 'clientes'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                currentMenu === 'clientes' 
                  ? 'bg-white/15 text-white' 
                  : 'bg-slate-100 text-slate-600 group-hover:text-slate-900 group-hover:bg-slate-200/60'
              }`}>
                <Users className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px]">Clientes</span>
                  </div>
                  <p className={`text-[10px] truncate ${
                    currentMenu === 'clientes' ? 'text-slate-300' : 'text-slate-400'
                  }`}>
                    Consulta & Histórico
                  </p>
                </div>
              )}
            </button>

            {!isCollapsed && (
              <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Segurança & Conformidade
              </div>
            )}

            {/* Auditoria LGPD */}
            <button
              type="button"
              onClick={() => handleNavClick('audit')}
              title="Segurança & Auditoria LGPD (Trilha de Auditoria e Ações)"
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer text-left group
                ${currentMenu === 'audit'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                currentMenu === 'audit' 
                  ? 'bg-white/15 text-white' 
                  : 'bg-slate-100 text-slate-600 group-hover:text-slate-900 group-hover:bg-slate-200/60'
              }`}>
                <ShieldCheck className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px]">Auditoria LGPD</span>
                  </div>
                  <p className={`text-[10px] truncate ${
                    currentMenu === 'audit' ? 'text-slate-300' : 'text-slate-400'
                  }`}>
                    Trilha & Rastreabilidade
                  </p>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Rodapé do Menu Lateral: Status do RBX e Versão */}
        <div className="p-3 border-t border-slate-200 shrink-0">
          {!isCollapsed ? (
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-medium text-slate-500">Integração RBX</span>
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  rbxStatus === 'conectado' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${rbxStatus === 'conectado' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {rbxStatus === 'conectado' ? 'Ativa' : 'Pendente'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/80">
                <span>Versão 2.5.0</span>
                <span className="font-medium text-slate-500">EVAD Pro</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center" title={`RBX: ${rbxStatus}`}>
              <div className={`w-3 h-3 rounded-full ${rbxStatus === 'conectado' ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-amber-500 ring-2 ring-amber-100'}`} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
