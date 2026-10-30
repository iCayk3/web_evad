import React from 'react';
import { 
  Building2, 
  MapPin, 
  Radio, 
  Sparkles,
  ArrowRight,
  Server,
  Settings
} from 'lucide-react';

interface CompanyDashboardProps {
  onNavigateToRecuperados?: () => void;
  rbxStatus?: string;
}

export const CompanyDashboard: React.FC<CompanyDashboardProps> = ({
  onNavigateToRecuperados,
  rbxStatus = 'conectado',
}) => {
  const operacoesCidades = [
    { nome: 'São João de Pirabas', tipo: 'Matriz / Polo', status: 'Ativo' },
    { nome: 'Quatipuru', tipo: 'Polo Regional', status: 'Ativo' },
    { nome: 'Boa Vista', tipo: 'Distrito Integrado (Quatipuru)', status: 'Ativo' },
    { nome: 'Magalhães Barata', tipo: 'Praça de Operação', status: 'Ativo' },
    { nome: 'Primavera', tipo: 'Praça de Operação', status: 'Ativo' },
    { nome: 'Maracanã', tipo: 'Praça de Operação', status: 'Ativo' },
    { nome: 'Santarém Novo', tipo: 'Praça de Operação', status: 'Ativo' },
    { nome: 'Salinópolis', tipo: 'Praça de Operação', status: 'Ativo' },
    { nome: 'Marapanim', tipo: 'Praça de Operação', status: 'Ativo' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header do Módulo Minha Empresa */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Minha Empresa
              </h1>
              <span className="text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200/70 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-600" />
                Novo Módulo Corporativo
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Painel de visão corporativa, filiais, cadastro do provedor e inteligência operacional
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700">
            <div className={`w-2.5 h-2.5 rounded-full ${rbxStatus === 'conectado' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span>RBX Telecom: {rbxStatus === 'conectado' ? 'Integrado' : 'Aguardando Conexão'}</span>
          </div>
        </div>
      </div>

      {/* 2. Banner de Acolhimento e Orientação */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 sm:p-7 shadow-md">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-bold text-blue-300">
            <Radio className="w-3.5 h-3.5 text-blue-400" />
            Estrutura Inicial Criada com Sucesso
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Tela Corporativa Pronta para Configuração
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Este é o novo espaço central da sua empresa. A partir deste ponto, me diga exatamente quais recursos, campos, gráficos ou configurações você gostaria de implementar aqui.
          </p>
          {onNavigateToRecuperados && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onNavigateToRecuperados}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition cursor-pointer backdrop-blur-xs"
              >
                <span>Acessar Módulo Clientes Recuperados</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        {/* Decorative background element */}
        <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 opacity-10 pointer-events-none">
          <Building2 className="w-64 h-64 text-white" />
        </div>
      </div>

      {/* 3. Cards Corporativos Estruturais de Exemplo / Preparação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Perfil do Provedor */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
              <Server className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
              Perfil ISP
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Dados do Provedor</h3>
            <p className="text-xs text-slate-500 mt-0.5">Informações cadastrais e licenças de telecomunicação</p>
          </div>
          <div className="pt-2 space-y-2 text-xs border-t border-slate-100">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Sistema Core:</span>
              <span className="font-bold text-slate-800">RBX ISP Master</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Praças Mapeadas:</span>
              <span className="font-bold text-slate-800">9 Cidades / Distritos</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Auditoria Patrimonial:</span>
              <span className="font-bold text-emerald-600">Ativa</span>
            </div>
          </div>
        </div>

        {/* Card 2: Praças & Cobertura */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              Cobertura
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Praças de Operação</h3>
            <p className="text-xs text-slate-500 mt-0.5">Polos regionais, cidades e distritos operacionais</p>
          </div>
          <div className="pt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1 text-xs border-t border-slate-100">
            {operacoesCidades.slice(0, 4).map((c, idx) => (
              <div key={idx} className="flex items-center justify-between py-1 text-slate-700">
                <span className="font-medium truncate">{c.nome}</span>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                  {c.tipo}
                </span>
              </div>
            ))}
            <div className="text-[11px] text-blue-600 font-semibold pt-1">
              + 5 praças cadastradas na rede
            </div>
          </div>
        </div>

        {/* Card 3: Parâmetros & Políticas */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
              Políticas
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Regras de Negócio</h3>
            <p className="text-xs text-slate-500 mt-0.5">Ciclos de faturamento, réguas de corte e comodato</p>
          </div>
          <div className="pt-2 space-y-2 text-xs border-t border-slate-100">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Hardware Unitário:</span>
              <span className="font-bold text-slate-800">R$ 220,00</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Ciclos de Faturamento:</span>
              <span className="font-bold text-slate-800">10, 20 e 30</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Recuperação Automática:</span>
              <span className="font-bold text-emerald-600">Integrada RBX</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
