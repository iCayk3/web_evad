import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, Radio, RefreshCw, KeyRound, ExternalLink, Clock } from 'lucide-react';
import { API_BASE } from '../config/api';

interface RbxConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const RbxConfigModal: React.FC<RbxConfigModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [tokenMasked, setTokenMasked] = useState('');
  const [hasSavedToken, setHasSavedToken] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [version, setVersion] = useState('v2');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const [nextSyncAt, setNextSyncAt] = useState('');
  const [statusConexao, setStatusConexao] = useState('desconectado');
  const [ultimoErro, setUltimoErro] = useState('');

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load config on open
  useEffect(() => {
    if (!isOpen) return;
    setLoadingConfig(true);
    setTestResult(null);
    setSaveSuccess(false);

    fetch(`${API_BASE}/api/config/rbx`)
      .then((res) => res.json())
      .then((data) => {
        setUrl(data.url || '');
        setTokenMasked(data.tokenMasked || '');
        setHasSavedToken(data.hasToken || false);
        setVersion(data.version || 'v2');
        setLastSyncAt(data.lastSyncAt || '');
        setNextSyncAt(data.nextSyncAt || '');
        setStatusConexao(data.statusConexao || 'desconectado');
        setUltimoErro(data.ultimoErro || '');
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingConfig(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/config/rbx/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token, version }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        setStatusConexao('conectado');
      } else {
        setStatusConexao('erro');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Falha ao comunicar com o servidor EVAD.',
      });
      setStatusConexao('erro');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch(`${API_BASE}/api/config/rbx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          token,
          version,
          autoSync: true,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        if (token) {
          setHasSavedToken(true);
          setTokenMasked('••••••••' + token.slice(-4));
          setToken('');
        }
        onSaved();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/api/sync/rbx`, { method: 'POST' });
      const data = await res.json();
      if (data.lastSyncAt) {
        setLastSyncAt(data.lastSyncAt);
        setStatusConexao('conectado');
      }
      onSaved();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 font-sans">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Integração Direta com RBX ISP
            </h3>
            <p className="text-xs text-slate-500">
              Configure a URL e a Chave de Acesso para sincronizar clientes e bloqueios
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div className="mt-3 py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${
                statusConexao === 'conectado'
                  ? 'bg-emerald-600'
                  : statusConexao === 'erro'
                  ? 'bg-rose-600'
                  : 'bg-slate-400'
              }`}
            />
            <span className="font-medium text-slate-700">
              Status:{' '}
              {statusConexao === 'conectado'
                ? 'Conectado e Autenticado'
                : statusConexao === 'erro'
                ? 'Falha na Conexão'
                : 'Não Conectado'}
            </span>
          </div>

          {lastSyncAt && (
            <span className="text-[11px] text-slate-400">
              Último sync: {lastSyncAt}
            </span>
          )}
        </div>

        {loadingConfig ? (
          <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Carregando parâmetros...</span>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Field 1: RBX URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                URL do Servidor RBX ISP
              </label>
              <input
                type="text"
                placeholder="https://provedor.rbxsoft.com ou https://ip:porta/api/v2"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono text-slate-800"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Endereço da instância do seu RBX ISP com SSL/HTTPS habilitado.
              </p>
            </div>

            {/* Field 2: Authentication Key */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chave de Acesso / Token API (<code className="text-slate-600">authentication_key</code>)
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  placeholder={
                    hasSavedToken
                      ? `Chave salva: ${tokenMasked} (preencha apenas para alterar)`
                      : 'Cole aqui a chave gerada no RBX...'
                  }
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Gerada no RBX em: <em>Empresa &gt; Parâmetros &gt; Web Services</em>.
              </p>
            </div>

            {/* Field 3: Version Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Versão da API do RBX
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setVersion('v2')}
                  className={`p-2.5 rounded-md border text-left transition ${
                    version === 'v2'
                      ? 'border-slate-900 bg-slate-50 text-slate-900 font-semibold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-medium">API v2.0 REST</div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">RBX 7.0+ (Recomendado)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setVersion('v1')}
                  className={`p-2.5 rounded-md border text-left transition ${
                    version === 'v1'
                      ? 'border-slate-900 bg-slate-50 text-slate-900 font-semibold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-medium">WebServices v1.0</div>
                  <div className="text-[10px] text-slate-500 font-normal mt-0.5">Consultas em Lote / Coortes</div>
                </button>
              </div>
            </div>

            {/* Automatic Sync Schedule Info */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs space-y-1.5">
              <div className="flex items-center justify-between text-blue-900 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  <span>Rotina Automática Diária: 03:30 e 12:30</span>
                </span>
                <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded font-medium">
                  Estratégia Delta
                </span>
              </div>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Executa automaticamente de madrugada (03:30) e no almoço (12:30), consultando apenas contratos pendentes (bloqueados e suspensos) para economizar até 90% de requisições ao RBX.
              </p>
              {nextSyncAt && (
                <div className="text-[11px] text-blue-900 pt-1 border-t border-blue-200/60 flex items-center justify-between font-medium">
                  <span>Próxima execução agendada:</span>
                  <span className="font-bold">{nextSyncAt}</span>
                </div>
              )}
            </div>

            {/* Test result message */}
            {testResult && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-start space-x-2 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                )}
                <div>
                  <span className="font-semibold block">
                    {testResult.success ? 'Conexão bem sucedida' : 'Falha na conexão com RBX'}
                  </span>
                  <span className="text-[11px] leading-tight block mt-0.5">
                    {testResult.message}
                  </span>
                </div>
              </div>
            )}

            {ultimoErro && !testResult && statusConexao === 'erro' && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Último erro registrado: {ultimoErro}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700 flex items-center space-x-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Credenciais salvas com sucesso no banco de dados!</span>
              </div>
            )}

            {/* Docs link */}
            <div className="pt-1 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100">
              <a
                href="https://developers.rbxsoft.com/v2/#introducao"
                target="_blank"
                rel="noreferrer"
                className="text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 underline"
              >
                <span>Documentação Oficial RBX v2.0</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <span className="text-slate-400">Header: authentication_key</span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
              <button
                type="button"
                disabled={testing || (!url && !hasSavedToken)}
                onClick={handleTestConnection}
                className="w-full sm:w-auto px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Testando Conexão...</span>
                  </>
                ) : (
                  <>
                    <Radio className="h-3.5 w-3.5" />
                    <span>Testar Conexão</span>
                  </>
                )}
              </button>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                {statusConexao === 'conectado' && (
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={handleManualSync}
                    className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium transition flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>Sincronizar</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={saving || (!url && !token && !hasSavedToken)}
                  onClick={handleSave}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium transition shadow-xs disabled:opacity-50"
                >
                  {saving ? 'Gravando...' : 'Salvar Configuração'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
