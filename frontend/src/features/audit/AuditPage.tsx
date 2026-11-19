import React, { useState, useEffect } from 'react';
import { ShieldCheck, RotateCw, Filter, FileText, CheckCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { AccessibleTable, Column } from '../../components/common/AccessibleTable.tsx';
import { Badge } from '../../components/common/Badge.tsx';
import { PillButton } from '../../components/common/PillButton.tsx';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = '/api/audit?limit=50';
      if (moduleFilter) url += `&module=${moduleFilter}`;
      const res = await apiFetch<{ total: number; logs: any[] }>(url);
      setLogs(res.logs);
      setTotal(res.total);
    } catch (e) {
      console.error('Erro ao buscar logs de auditoria:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [moduleFilter]);

  const columns: Column<any>[] = [
    {
      key: 'timestamp',
      header: 'Data / Hora',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-slate-500 text-[11px]">{item.timestamp}</span>
      ),
    },
    {
      key: 'username',
      header: 'Usuário & Perfil',
      sortable: true,
      render: (item) => (
        <div>
          <span className="font-semibold text-slate-900 leading-tight block">{item.username}</span>
          <span className="text-[10px] text-slate-400 block uppercase font-mono mt-0.5">{item.user_role}</span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Ação Auditada',
      sortable: true,
      render: (item) => {
        if (item.action.startsWith('auth.')) return <Badge variant="primary" className="text-[10px] font-mono">{item.action}</Badge>;
        if (item.action.includes('create')) return <Badge variant="ok" className="text-[10px] font-mono">{item.action}</Badge>;
        if (item.action.includes('export')) return <Badge variant="secondary" className="text-[10px] font-mono">{item.action}</Badge>;
        return <Badge variant="neutral" className="text-[10px] font-mono">{item.action}</Badge>;
      },
    },
    {
      key: 'module',
      header: 'Módulo',
      sortable: true,
      render: (item) => (
        <span className="text-slate-700 font-medium capitalize text-xs">{item.module}</span>
      ),
    },
    {
      key: 'record_id',
      header: 'ID Registro',
      render: (item) => (
        <span className="font-mono text-slate-600 text-[11px]">
          {item.record_id || '-'}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Metadados Sanitizados',
      render: (item) => (
        <pre className="text-[10px] text-slate-500 font-mono bg-slate-50 p-1.5 rounded-lg border border-slate-100 max-w-xs truncate">
          {item.details ? JSON.stringify(item.details) : '-'}
        </pre>
      ),
    },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-primary" />
              <span>Trilha Imutável de Auditoria & Governança LGPD</span>
            </h1>
            <Badge variant="primary">Audit Trail</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Registro de autenticação, inspeções de chamados, alterações e exportações operacionais
          </p>
        </div>

        <PillButton
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          icon={RotateCw}
        >
          {loading ? 'Atualizando...' : 'Atualizar Trilha'}
        </PillButton>
      </div>

      {/* Filtro de Módulo em Pílula */}
      <div className="bg-white border border-slate-100/90 rounded-2xl p-4 shadow-premium-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700">Filtrar por Módulo:</span>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="py-1 px-3 border border-slate-200 rounded-full text-xs text-slate-700 bg-white font-medium shadow-2xs outline-none cursor-pointer"
          >
            <option value="">Todos os Módulos</option>
            <option value="auth">Autenticação (auth)</option>
            <option value="clientes">Clientes (clientes)</option>
            <option value="atendimentos">Atendimentos (atendimentos)</option>
            <option value="analytics">Analytics (analytics)</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Total de registros gravados: <strong className="font-mono text-slate-800">{total}</strong>
        </div>
      </div>

      {/* Tabela de Auditoria */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 bg-white border border-slate-100 rounded-2xl shadow-premium-card">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full mr-2" />
          <span className="text-xs font-semibold">Carregando trilha de auditoria...</span>
        </div>
      ) : (
        <AccessibleTable
          columns={columns}
          data={logs}
          caption="Trilha de auditoria das operações do sistema"
          keyExtractor={(item) => item.id}
          emptyMessage="Nenhum log de auditoria encontrado."
        />
      )}
    </div>
  );
};
