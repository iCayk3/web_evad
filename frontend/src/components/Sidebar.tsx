import React from 'react';
import { 
  Building2, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  Wifi
} from 'lucide-react';

export type MainMenuOption = 'empresa' | 'recuperados';

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
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      <aside
        className={`
          fixed lg:static top-0 bottom-0 left-0 z-50
          bg-slate-950 text-slate-300
          border-r border-slate-800/80
          flex flex-col justify-between
          transition-all duration-300 ease-in-out
          print:hidden select-none
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Topo: Logo & Branding */}
        <div>
          <div className="h-16 flex items-center px-4 border-b border-slate-800/80 justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shrink-0">
                <Wifi className="w-5 h-5 text-white" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0 transition-opacity duration-200">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-extrabold text-white text-base tracking-tight truncate">
                      EVAD
                    </span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded font-bold">
                      ISP
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium truncate">
                    Gestão Telecom & RBX
                  </p>
                </div>
              )}
            </div>

            {/* Botão de colapsar (visível em desktop) */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
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
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                currentMenu === 'empresa' ? 'bg-white/20 text-white' : 'bg-slate-800/80 text-blue-400 group-hover:text-blue-300'
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
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}>
                      Novo
                    </span>
                  </div>
                  <p className={`text-[10px] truncate ${
                    currentMenu === 'empresa' ? 'text-blue-100' : 'text-slate-400'
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
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }
                ${isCollapsed ? 'justify-center' : ''}
              `}
            >
              <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                currentMenu === 'recuperados' ? 'bg-white/20 text-white' : 'bg-slate-800/80 text-emerald-400 group-hover:text-emerald-300'
              }`}>
                <RotateCcw className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px]">Clientes Recuperados</span>
                  </div>
                  <p className={`text-[10px] truncate ${
                    currentMenu === 'recuperados' ? 'text-blue-100' : 'text-slate-400'
                  }`}>
                    Retenção, KPIs & Hardware
                  </p>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Rodapé do Menu Lateral: Status do RBX e Versão */}
        <div className="p-3 border-t border-slate-800/80">
          {!isCollapsed ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-medium text-slate-400">Integração RBX</span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  rbxStatus === 'conectado' 
                    ? 'bg-emerald-500/20 text-emerald-300' 
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${rbxStatus === 'conectado' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {rbxStatus === 'conectado' ? 'Ativa' : 'Pendente'}
                </span>
              </div>
              <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-800/60">
                <span>Versão 2.5.0</span>
                <span>EVAD Pro</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center" title={`RBX: ${rbxStatus}`}>
              <div className={`w-3 h-3 rounded-full ${rbxStatus === 'conectado' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
