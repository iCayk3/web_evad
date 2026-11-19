import React, { useState } from 'react';
import { X, UserPlus, Loader2, AlertCircle, Calendar, Phone, Mail, MapPin } from 'lucide-react';
import { apiFetch } from '../../../lib/api.ts';
import { LeadDto, LeadStage } from '../types.ts';

interface CreateLeadModalProps {
  onClose: () => void;
  onSuccess: (lead: LeadDto) => void;
}

export const CreateLeadModal: React.FC<CreateLeadModalProps> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [personType, setPersonType] = useState<'F' | 'J'>('F');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('São Paulo');
  const [state, setState] = useState('SP');
  const [stage, setStage] = useState<LeadStage>('new');
  const [source, setSource] = useState('Site / Inbound');
  const [owner, setOwner] = useState('Carlos Vendas');
  const [nextActionAt, setNextActionAt] = useState('');
  const [estimatedValue, setEstimatedValue] = useState<number>(129.90);
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('Titular');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const created = await apiFetch<LeadDto>('sales/leads', {
        method: 'POST',
        body: JSON.stringify({
          name,
          personType,
          cpfCnpj,
          phone,
          email,
          city,
          state,
          stage,
          source,
          owner,
          nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : null,
          estimatedValue: Number(estimatedValue) || 0,
          contactName: contactName || name,
          contactPhone: phone,
          contactEmail: email,
          contactRole,
        }),
      });

      onSuccess(created);
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar lead no RBXSoft.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Topo */}
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary text-white flex items-center justify-center shadow-md">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Novo Lead Comercial</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cadastro oficial de Mercado com campos de governança comercial
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-slate-700">Nome / Razão Social *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                placeholder="Ex: Amanda Silveira ou Padaria Estrela"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Tipo de Pessoa</label>
              <div className="flex gap-4 pt-1.5">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="personType"
                    checked={personType === 'F'}
                    onChange={() => setPersonType('F')}
                    className="text-brand-primary"
                  />
                  <span>Física (CPF)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="personType"
                    checked={personType === 'J'}
                    onChange={() => setPersonType('J')}
                    className="text-brand-primary"
                  />
                  <span>Jurídica (CNPJ)</span>
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">CPF / CNPJ</label>
              <input
                type="text"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary font-mono"
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" /> Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-400" /> E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                placeholder="cliente@email.com"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" /> Cidade
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Etapa Inicial</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as LeadStage)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary bg-white font-medium"
              >
                <option value="new">Novo Lead</option>
                <option value="qualified">Qualificado</option>
                <option value="proposal">Proposta Enviada</option>
                <option value="negotiation">Em Negociação</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Origem do Lead</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary bg-white"
              >
                <option value="Site / Inbound">Site / Inbound</option>
                <option value="Campanha Meta Ads">Campanha Meta Ads</option>
                <option value="Google Ads">Google Ads</option>
                <option value="Prospecção Ativa PAP">Prospecção Ativa PAP</option>
                <option value="Indicação">Indicação</option>
                <option value="WhatsApp Comercial">WhatsApp Comercial</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Responsável Comercial</label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Próximo Contato (Agendamento)
              </label>
              <input
                type="datetime-local"
                value={nextActionAt}
                onChange={(e) => setNextActionAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Valor Estimado (R$)</label>
              <input
                type="number"
                step="0.01"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary font-medium"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Cadastrar Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
