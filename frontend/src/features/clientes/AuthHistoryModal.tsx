import React from 'react';
import { X, History } from 'lucide-react';
import { PillButton } from '../../components/common/PillButton.tsx';

export interface AuthSession {
  id: string;
  connectedAt: string;
  disconnectedAt: string;
  duration: string;
  ip: string;
  mac: string;
  uploadMb: number;
  downloadMb: number;
  terminateCause: string;
}

interface AuthHistoryModalProps {
  contract: any | null;
  onClose: () => void;
}

export const AuthHistoryModal: React.FC<AuthHistoryModalProps> = ({ contract, onClose }) => {
  if (!contract) return null;

  const sessions: AuthSession[] = contract.authHistory && contract.authHistory.length > 0
    ? contract.authHistory
    : [
        {
          id: 'sess_1',
          connectedAt: '2026-09-02 08:30:12',
          disconnectedAt: '2026-09-02 22:15:08',
          duration: '13h 44m',
          ip: contract.authDetails?.ipAddress || '100.64.45.88',
          mac: contract.authDetails?.macAddress || '48:8F:5A:E3:40:12',
          uploadMb: 3840,
          downloadMb: 24500,
          terminateCause: 'Lost-Carrier',
        },
        {
          id: 'sess_2',
          connectedAt: '2026-09-01 06:12:00',
          disconnectedAt: '2026-09-02 08:29:45',
          duration: '26h 17m',
          ip: contract.authDetails?.ipAddress || '100.64.45.88',
          mac: contract.authDetails?.macAddress || '48:8F:5A:E3:40:12',
          uploadMb: 8120,
          downloadMb: 49200,
          terminateCause: 'User-Request',
        },
        {
          id: 'sess_3',
          connectedAt: '2026-08-30 14:00:22',
          disconnectedAt: '2026-09-01 06:11:15',
          duration: '39h 10m',
          ip: contract.authDetails?.ipAddress || '100.64.45.88',
          mac: contract.authDetails?.macAddress || '48:8F:5A:E3:40:12',
          uploadMb: 11400,
          downloadMb: 78900,
          terminateCause: 'NAS-Reboot',
        },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-premium-modal border border-slate-100 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-primary-light text-brand-primary flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Histórico de Autenticações RADIUS / PPPoE
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Contrato #{contract.number} • {contract.planName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Atual */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-100 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Status Atual:</span>
            {contract.isAuthenticated ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Online / Autenticado</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-rose-100 text-rose-800">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Desconectado / Sem RADIUS</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-600">
            <span>IP: <strong className="text-slate-900">{contract.authDetails?.ipAddress || '100.64.45.88'}</strong></span>
            <span>MAC: <strong className="text-slate-900">{contract.authDetails?.macAddress || '48:8F:5A:E3:40:12'}</strong></span>
          </div>
        </div>

        {/* Lista de Sessões */}
        <div className="p-5 overflow-y-auto flex-1">
          <div className="border border-slate-100 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="p-3">Conexão / Início</th>
                  <th className="p-3">Desconexão</th>
                  <th className="p-3">Duração</th>
                  <th className="p-3">IP / MAC</th>
                  <th className="p-3 text-right">Tráfego (Down / Up)</th>
                  <th className="p-3">Causa de Término</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono text-slate-800 font-medium whitespace-nowrap">
                      {sess.connectedAt}
                    </td>
                    <td className="p-3 font-mono text-slate-500 whitespace-nowrap">
                      {sess.disconnectedAt}
                    </td>
                    <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                      {sess.duration}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      <div>{sess.ip}</div>
                      <div className="text-[10px] text-slate-400">{sess.mac}</div>
                    </td>
                    <td className="p-3 text-right font-mono text-xs whitespace-nowrap">
                      <span className="text-emerald-700 font-semibold">{(sess.downloadMb / 1024).toFixed(1)} GB</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-blue-700 font-semibold">{(sess.uploadMb / 1024).toFixed(1)} GB</span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        sess.terminateCause === 'Lost-Carrier'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : sess.terminateCause === 'User-Request'
                          ? 'bg-blue-50 text-brand-primary border border-blue-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {sess.terminateCause}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <PillButton variant="secondary" size="sm" onClick={onClose}>
            Fechar Histórico
          </PillButton>
        </div>
      </div>
    </div>
  );
};
