import React, { useState } from 'react';
import { X, CheckCircle, Award, Sparkles, Loader2, Link2, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../../lib/api.ts';
import { LeadDto } from '../types.ts';

interface CreateContractModalProps {
  lead: LeadDto;
  onClose: () => void;
  onSuccess: (contractNumber: string) => void;
}

export const CreateContractModal: React.FC<CreateContractModalProps> = ({
  lead,
  onClose,
  onSuccess,
}) => {
  const [customerId, setCustomerId] = useState<number>(101);
  const [customerName, setCustomerName] = useState<string>(lead.name);
  const [planCode, setPlanCode] = useState<string>('PL-FIBRA-600');
  const [planDescription, setPlanDescription] = useState<string>('Fibra Residencial 600MB');
  const [sellerName, setSellerName] = useState<string>(lead.owner || 'Carlos Vendas');
  const [monthlyValue, setMonthlyValue] = useState<number>(lead.estimatedValue || 129.90);
  const [adhesionValue, setAdhesionValue] = useState<number>(0);
  const [technology, setTechnology] = useState<string>('Fibra Óptica GPON');
  const [salesChannel, setSalesChannel] = useState<string>(lead.source || 'Direto');
  const [contractNumber, setContractNumber] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createdContractNumber, setCreatedContractNumber] = useState<string | null>(null);

  const plansCatalog = [
    { code: 'PL-FIBRA-400', name: 'Fibra Residencial 400MB', value: 99.90 },
    { code: 'PL-FIBRA-600', name: 'Fibra Residencial 600MB', value: 129.90 },
    { code: 'PL-GAMER-1G', name: 'Fibra Gamer 1Gbps', value: 199.90 },
    { code: 'PL-EMP-800', name: 'Empresarial Pro 800MB', value: 349.90 },
    { code: 'PL-DED-1000', name: 'Link Dedicado 1Gbps BGP', value: 1850.00 },
  ];

  const handlePlanChange = (code: string) => {
    const selected = plansCatalog.find((p) => p.code === code);
    if (selected) {
      setPlanCode(selected.code);
      setPlanDescription(selected.name);
      setMonthlyValue(selected.value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<{ contractNumber: string }>('sales/contracts', {
        method: 'POST',
        body: JSON.stringify({
          originProspectId: lead.id,
          contractNumber: contractNumber.trim() || undefined,
          customerId,
          customerName,
          planCode,
          planDescription,
          sellerName,
          monthlyValue,
          adhesionValue,
          city: lead.city,
          state: lead.state,
          technology,
          salesChannel,
        }),
      });

      setCreatedContractNumber(res.contractNumber);
      onSuccess(res.contractNumber);
    } catch (err: any) {
      setError(err.message || 'Erro ao emitir contrato no RBXSoft.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Cabeçalho */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-blue-900/5 to-amber-500/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary text-white flex items-center justify-center shadow-md">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">Fechar Venda & Criar Contrato</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  <Sparkles className="w-3 h-3 text-emerald-600" /> Rastreável
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Emissão assistida via RBXSoft v2 com gravação oficial de vínculo de conversão
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal de Sucesso */}
        {createdContractNumber ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold text-slate-900">Venda Concluída com Sucesso!</h4>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              O contrato <span className="font-mono font-bold text-brand-primary">{createdContractNumber}</span> foi emitido no RBXSoft e vinculado com a chave de origem do lead #{lead.id}. O lead avançou para a etapa <strong className="text-emerald-700">Ganho</strong>.
            </p>
            <div className="pt-4">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-[#002f9f] transition shadow-md"
              >
                Concluir e Voltar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Informação do Lead Vinculado */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-brand-primary" />
                <div>
                  <span className="font-semibold text-slate-900">Lead de Origem: </span>
                  <span className="text-slate-700 font-medium">{lead.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] bg-white px-2 py-1 rounded border border-slate-200 text-slate-600">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                ID: #{lead.id}
              </div>
            </div>

            {/* Dados do Cliente e Plano */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Nome Oficial do Cliente</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                  placeholder="Nome completo ou Razão Social"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Código do Cliente RBXSoft</label>
                <input
                  type="number"
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary font-mono"
                  placeholder="Ex: 101"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="font-semibold text-slate-700">Plano de Acesso</label>
                <select
                  value={planCode}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary bg-white"
                >
                  {plansCatalog.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name} — R$ {p.value.toFixed(2)}/mês
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Mensalidade (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={monthlyValue}
                  onChange={(e) => setMonthlyValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Taxa de Adesão (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={adhesionValue}
                  onChange={(e) => setAdhesionValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Vendedor Responsável</label>
                <input
                  type="text"
                  required
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                  placeholder="Nome do vendedor"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Tecnologia de Acesso</label>
                <select
                  value={technology}
                  onChange={(e) => setTechnology(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary bg-white"
                >
                  <option value="Fibra Óptica GPON">Fibra Óptica GPON</option>
                  <option value="Rádio 5.8GHz">Rádio 5.8GHz</option>
                  <option value="Cabo UTP Metálico">Cabo UTP Metálico</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center justify-between">
                  <span>Número do Contrato no RBXSoft (Opcional)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Ex: CTR-88108</span>
                </label>
                <input
                  type="text"
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary font-mono"
                  placeholder="Deixe em branco para emissão automática ou informe o número do contrato"
                />
              </div>
            </div>

            {/* Rodapé com Botões */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-brand-primary hover:bg-[#002f9f] disabled:opacity-50 flex items-center gap-2 shadow-md transition"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Confirmar Emissão & Fechar Venda
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
