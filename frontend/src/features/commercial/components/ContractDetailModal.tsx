import React, { useEffect, useState } from 'react';
import {
  X,
  FileText,
  User,
  MapPin,
  Calendar,
  DollarSign,
  Phone,
  Mail,
  Layers,
  Clock,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Hash,
  Send,
  Wifi,
} from 'lucide-react';
import { apiFetch } from '../../../lib/api.ts';

export interface ContractDetailsData {
  number: string;
  clientId: number;
  clientName: string;
  clientCpfCnpj: string;
  clientPhone: string;
  clientEmail: string;
  clientGroup: string;
  personType: string;
  statusCode: 'A' | 'B' | 'S' | 'C' | 'T' | 'E';
  statusDescription: string;
  planCode: string;
  planDescription: string;
  planType: string;
  packageName: string;
  packageId: string;
  isGrouped: boolean;
  isSigned: boolean;
  signDate: string;
  startDate: string;
  expirationDate: string;
  lastOperationDate: string;
  lastOperationUser: string;
  seller: string;
  salesChannel: string;
  monthlyValue: number;
  grossValue: number;
  fixedDiscount: number;
  promoDiscount: number;
  adhesionValue: number;
  billingCycleBaseDay: string;
  billingCycleDueDay: string;
  technology: string;
  installationAddress: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    latitude: string;
    longitude: string;
  };
  billingAddress: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  raw?: any;
}

interface ContractDetailModalProps {
  contractNumber: string | null;
  onClose: () => void;
}

export const ContractDetailModal: React.FC<ContractDetailModalProps> = ({
  contractNumber,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [contract, setContract] = useState<ContractDetailsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!contractNumber) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const cleanNum = contractNumber.replace(/^#/, '').trim();

    apiFetch<ContractDetailsData>(`sales/contracts/${cleanNum}`)
      .then((data) => {
        if (isMounted) {
          setContract(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Não foi possível carregar os detalhes do contrato no RBXSoft.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [contractNumber]);

  // Fechar com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!contractNumber) return null;

  const handleCopySummary = () => {
    if (!contract) return;
    const summary = `Ficha do Contrato #${contract.number}
Cliente: ${contract.clientName} (Cód. ${contract.clientId})
CPF/CNPJ: ${contract.clientCpfCnpj || 'Não informado'}
Plano: ${contract.planDescription}
Mensalidade: R$ ${contract.monthlyValue.toFixed(2)} | Adesão: R$ ${contract.adhesionValue.toFixed(2)}
Situação: ${contract.statusDescription} (${contract.statusCode})
Vendedor: ${contract.seller || 'Não atribuído'}
Assinatura: ${contract.signDate ? contract.signDate.slice(0, 10).split('-').reverse().join('/') : '-'}
Cidade: ${contract.installationAddress.city}/${contract.installationAddress.state} - Bairro: ${contract.installationAddress.neighborhood}
Endereço: ${contract.installationAddress.street}, ${contract.installationAddress.number}${contract.installationAddress.complement ? ` - ${contract.installationAddress.complement}` : ''}`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (code: string, desc: string) => {
    switch (code) {
      case 'A':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {desc || 'Ativo'}
          </span>
        );
      case 'E':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {desc || 'Aguardando Instalação'}
          </span>
        );
      case 'C':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            {desc || 'Cancelado'}
          </span>
        );
      case 'T':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            {desc || 'Transferido'}
          </span>
        );
      case 'B':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {desc || 'Bloqueado'}
          </span>
        );
      case 'S':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs font-bold border border-orange-200">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            {desc || 'Suspenso'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
            {desc || code}
          </span>
        );
    }
  };

  const cleanPhone = contract?.clientPhone ? contract.clientPhone.replace(/\D/g, '') : '';
  const whatsappUrl = cleanPhone ? `https://wa.me/55${cleanPhone}` : null;
  const mapsUrl =
    contract?.installationAddress.latitude && contract?.installationAddress.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${contract.installationAddress.latitude},${contract.installationAddress.longitude}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-bold text-base text-slate-900 font-mono">
                  Contrato #{contractNumber.replace(/^#/, '')}
                </h3>
                {contract && getStatusBadge(contract.statusCode, contract.statusDescription)}
              </div>
              <p className="text-xs text-slate-500">
                Ficha cadastral consolidada via API oficial do RBXSoft
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {contract && (
              <button
                type="button"
                onClick={handleCopySummary}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition cursor-pointer"
                title="Copiar resumo do contrato"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corpo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                Consultando dados do contrato #{contractNumber} na API do RBXSoft...
              </p>
            </div>
          ) : error ? (
            <div className="p-6 text-center space-y-3 bg-rose-50/50 rounded-xl border border-rose-100">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-sm font-semibold text-rose-800">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50 transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          ) : contract ? (
            <>
              {/* Banner de KPIs do Contrato */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200/70">
                <div>
                  <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    Valor Mensal (MRR)
                  </span>
                  <div className="font-mono text-base font-bold text-slate-900 mt-0.5">
                    R$ {contract.monthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {contract.fixedDiscount > 0 && (
                    <span className="text-[10px] text-rose-600 font-medium">
                      Desc. Fixo: R$ {contract.fixedDiscount.toFixed(2)}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                    Taxa de Adesão
                  </span>
                  <div className="font-mono text-base font-bold text-slate-900 mt-0.5">
                    R$ {contract.adhesionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {contract.adhesionValue > 0 ? 'Taxa cadastrada' : 'Isenta / R$ 0'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-brand-primary" />
                    Atendente / Vendedor
                  </span>
                  <div className="font-semibold text-slate-900 truncate mt-0.5">
                    {contract.seller || 'Não atribuído'}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Canal: {contract.salesChannel || 'Direto'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    Data Assinatura
                  </span>
                  <div className="font-mono text-slate-900 font-semibold mt-0.5">
                    {contract.signDate ? contract.signDate.slice(0, 10).split('-').reverse().join('/') : '-'}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Início: {contract.startDate ? contract.startDate.slice(0, 10).split('-').reverse().join('/') : '-'}
                  </span>
                </div>
              </div>

              {/* Grid 2x2 com Seções */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Dados do Assinante */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 font-bold text-slate-900 text-xs">
                    <User className="w-4 h-4 text-brand-primary" />
                    <span>Dados do Assinante</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] text-slate-400">Nome Completo:</span>
                      <p className="font-semibold text-slate-900">{contract.clientName}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400">Cód. Cliente RBX:</span>
                        <p className="font-mono font-medium text-slate-800">#{contract.clientId}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Pessoa:</span>
                        <p className="font-medium text-slate-800">{contract.personType}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400">CPF / CNPJ:</span>
                        <p className="font-mono font-medium text-slate-800">
                          {contract.clientCpfCnpj || 'Não informado'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Grupo RBX:</span>
                        <p className="font-medium text-slate-800 truncate" title={contract.clientGroup}>
                          {contract.clientGroup || 'Geral'}
                        </p>
                      </div>
                    </div>

                    {/* Contato & WhatsApp */}
                    <div>
                      <span className="text-[11px] text-slate-400">Telefone / Contato:</span>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="font-mono text-slate-800 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {contract.clientPhone || 'Não informado'}
                        </span>
                        {whatsappUrl && (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-[10px] transition"
                          >
                            <Send className="w-3 h-3 text-emerald-600" />
                            WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Plano & Condições Comerciais */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 font-bold text-slate-900 text-xs">
                    <Wifi className="w-4 h-4 text-emerald-600" />
                    <span>Plano & Condições Contratuais</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] text-slate-400">Plano Contratado:</span>
                      <p className="font-bold text-slate-900">{contract.planDescription}</p>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Cód. Plano: {contract.planCode || '-'} • Tipo: {contract.planType}
                      </span>
                    </div>

                    {contract.packageName && (
                      <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-100">
                        <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider block">
                          Pacote / Combo Vinculado
                        </span>
                        <p className="font-semibold text-blue-900 text-xs">{contract.packageName}</p>
                        {contract.packageId && (
                          <span className="text-[10px] text-blue-600 font-mono">ID: {contract.packageId}</span>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400">Valor Bruto:</span>
                        <p className="font-mono text-slate-700">R$ {contract.grossValue.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Tecnologia:</span>
                        <p className="font-medium text-slate-800 truncate" title={contract.technology}>
                          {contract.technology || 'Fibra Óptica'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400">Ciclo Faturamento:</span>
                        <p className="font-mono text-slate-800">
                          Base: {contract.billingCycleBaseDay || '-'} • Venc: Dia {contract.billingCycleDueDay || '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Agrupamento:</span>
                        <p className="font-medium text-slate-800">{contract.isGrouped ? 'Sim' : 'Não'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Endereço de Instalação */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 font-bold text-slate-900 text-xs">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-rose-500" />
                      <span>Endereço de Instalação</span>
                    </span>
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver no Maps
                      </a>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] text-slate-400">Logradouro:</span>
                      <p className="font-medium text-slate-900">
                        {contract.installationAddress.street || 'Não informado'}, {contract.installationAddress.number}
                        {contract.installationAddress.complement ? ` (${contract.installationAddress.complement})` : ''}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400">Bairro:</span>
                        <p className="font-medium text-slate-800">
                          {contract.installationAddress.neighborhood || 'Centro'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Cidade / UF:</span>
                        <p className="font-medium text-slate-800">
                          {contract.installationAddress.city} / {contract.installationAddress.state}
                        </p>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400">CEP:</span>
                      <p className="font-mono text-slate-700">
                        {contract.installationAddress.zipCode || 'Não informado'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Auditoria & Rastreabilidade do RBXSoft */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 font-bold text-slate-900 text-xs">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span>Auditoria & Metadados do ERP</span>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400">Data de Assinatura:</span>
                        <p className="font-mono font-medium text-slate-800">
                          {contract.signDate ? contract.signDate.slice(0, 10).split('-').reverse().join('/') : '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Data de Início:</span>
                        <p className="font-mono font-medium text-slate-800">
                          {contract.startDate ? contract.startDate.slice(0, 10).split('-').reverse().join('/') : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400">Última Operação:</span>
                        <p className="font-mono font-medium text-slate-800">
                          {contract.lastOperationDate
                            ? contract.lastOperationDate.slice(0, 10).split('-').reverse().join('/')
                            : 'Nenhuma alteração'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Usuário da Última Op:</span>
                        <p className="font-mono font-medium text-slate-800">
                          {contract.lastOperationUser || 'Sistema'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400">Assinado Eletronicamente:</span>
                        <p className="font-medium text-slate-800">{contract.isSigned ? 'Sim' : 'Não'}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Validade Contratual:</span>
                        <p className="font-mono text-slate-700">
                          {contract.expirationDate
                            ? contract.expirationDate.slice(0, 10).split('-').reverse().join('/')
                            : 'Indeterminada'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Rodapé do Modal */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {contract && (
              <button
                type="button"
                onClick={handleCopySummary}
                className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Resumo Copiado!' : 'Copiar Resumo'}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
