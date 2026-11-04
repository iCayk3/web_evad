import React from 'react';
import { 
  Building2, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  Wifi
} from 'lucide-react';

export type MainMenuOption = 'empresa' | 'autenticacoes' | 'recuperados';

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
          print:hidden select-none
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Topo: Logo & Branding */}
        <div>
          <div className="h-16 flex items-center px-4 border-b border-slate-200 justify-between">
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

          {/* Seção de Navegação Principal */}
          <div className="p-3 space-y-1.5">
            {!isCollapsed && (
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Módulos do Sistema
              </div>
            )}

            {/* 1º BOTÃO: Minha Empresa */}
            <button
              type="button"
              onClick={() => {
                onSelectMenu('empresa');
                if (onCloseMobile) onCloseMobile();
              }}
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
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide ${
                      currentMenu === 'empresa' 
                        ? 'bg-white/20 text-white' 
                        : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                    }`}>
                      Novo
                    </span>
                  </div>
                  <p className={`text-[10px] truncate ${
                    currentMenu === 'empresa' ? 'text-slate-300' : 'text-slate-400'
                  }`}>
                    Visão geral corporativa
                  </p>
                </div>
              )}
            </button>

            {/* 2º BOTÃO: Clientes Recuperados */}
            <button
              type="button"
              onClick={() => {
                onSelectMenu('recuperados');
                if (onCloseMobile) onCloseMobile();
              }}
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
          </div>
        </div>

        {/* Rodapé do Menu Lateral: Status do RBX e Versão */}
        <div className="p-3 border-t border-slate-200">
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
