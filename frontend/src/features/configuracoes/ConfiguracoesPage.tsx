import React, { useState, useEffect } from 'react';
import {
  Settings,
  Server,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCw,
  ExternalLink,
  Shield,
  Save,
  HelpCircle,
  Eye,
  EyeOff,
  Users,
  UserPlus,
  Unlock,
  Lock,
  X,
  Pencil,
  Trash2,
  KeyRound,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { Badge } from '../../components/common/Badge.tsx';
import { PillButton } from '../../components/common/PillButton.tsx';

interface SettingsState {
  rbx_url: string;
  rbx_chave: string;
  rbx_ambiente: 'homologacao' | 'producao';
  rbx_use_mock: boolean;
  sla_risk_window: number;
  recurrence_threshold: number;
}

interface TestResult {
  success: boolean;
  httpStatus: number | null;
  message: string;
  responseTimeMs: number;
  details?: any;
}

interface SystemUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'gestor' | 'supervisor' | 'tecnico';
  lockedUntil?: string | null;
  createdAt: string;
}

const DEFAULT_USERS: SystemUser[] = [
  {
    id: 'usr_admin_01',
    username: 'admin',
    email: 'admin@rbxhub.local',
    fullName: 'Administrador do Sistema',
    role: 'admin',
    createdAt: '2026-09-01',
  },
  {
    id: 'usr_gestor_01',
    username: 'gestor',
    email: 'gestor@rbxhub.local',
    fullName: 'Gestor Operacional e Qualidade',
    role: 'gestor',
    createdAt: '2026-09-01',
  },
  {
    id: 'usr_supervisor_01',
    username: 'supervisor',
    email: 'supervisor@rbxhub.local',
    fullName: 'Supervisor de Atendimento',
    role: 'supervisor',
    createdAt: '2026-09-01',
  },
  {
    id: 'usr_tecnico_01',
    username: 'tecnico',
    email: 'tecnico@rbxhub.local',
    fullName: 'Técnico de Campo N2',
    role: 'tecnico',
    createdAt: '2026-09-01',
  },
];

export const ConfiguracoesPage: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsState>({
    rbx_url: 'https://www.developers.rbxsoft.com/',
    rbx_chave: 'YTWKBORCZ2N8VHQT1XK3ZIRM1OKI82',
    rbx_ambiente: 'homologacao',
    rbx_use_mock: false,
    sla_risk_window: 60,
    recurrence_threshold: 3,
  });

  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Usuários
  const [users, setUsers] = useState<SystemUser[]>(DEFAULT_USERS);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUserModalOpen, setNewUserModalOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    email: '',
    fullName: '',
    role: 'tecnico',
    password: '',
  });

  // Modal Edição de Usuário
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    role: 'tecnico' as SystemUser['role'],
    password: '',
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ settings: SettingsState }>('/api/settings');
      setSettings(res.settings);
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await apiFetch<{ users: SystemUser[] }>('/api/settings/users');
      if (res.users && res.users.length > 0) {
        setUsers(res.users);
      } else {
        setUsers(DEFAULT_USERS);
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
      setUsers(DEFAULT_USERS);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchUsers();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch<TestResult>('/api/settings/test-connection', {
        method: 'POST',
        body: JSON.stringify({
          url: settings.rbx_url,
          chave: settings.rbx_chave,
        }),
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        httpStatus: null,
        message: err.message || 'Falha ao testar comunicação com o servidor.',
        responseTimeMs: 0,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      setSaveSuccess(true);
      window.dispatchEvent(new CustomEvent('rbx-settings-updated', { detail: settings }));
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      alert(err.message || 'Não foi possível salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      await apiFetch('/api/settings/users', {
        method: 'POST',
        body: JSON.stringify({
          ...newUserForm,
          username: newUserForm.username.trim(),
          email: newUserForm.email.trim(),
          fullName: newUserForm.fullName.trim(),
          password: newUserForm.password.trim(),
        }),
      });
      setNewUserModalOpen(false);
      setNewUserForm({
        username: '',
        email: '',
        fullName: '',
        role: 'tecnico',
        password: '',
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Falha ao cadastrar usuário.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await apiFetch(`/api/settings/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Falha ao atualizar papel do usuário.');
    }
  };

  const handleToggleLock = async (u: SystemUser) => {
    const isLocked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
    const endpoint = isLocked ? `/api/settings/users/${u.id}/unlock` : `/api/settings/users/${u.id}/lock`;
    try {
      await apiFetch(endpoint, { method: 'POST' });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Falha ao alterar bloqueio de acesso do usuário.');
    }
  };

  const handleStartEdit = (u: SystemUser) => {
    setEditingUser(u);
    setEditForm({
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      password: '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      const payload: any = {
        fullName: editForm.fullName,
        email: editForm.email,
        role: editForm.role,
      };
      if (editForm.password && editForm.password.trim().length >= 6) {
        payload.password = editForm.password.trim();
      }

      await apiFetch(`/api/settings/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Falha ao salvar edições do usuário.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteUser = async (u: SystemUser) => {
    if (u.username === user?.username) {
      alert('Você não pode excluir sua própria conta atualmente conectada.');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja remover o usuário @${u.username} (${u.fullName})?`)) {
      return;
    }

    try {
      await apiFetch(`/api/settings/users/${u.id}`, {
        method: 'DELETE',
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Falha ao remover usuário.');
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'gestor';

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand-primary" />
              <span>Configurações do Sistema</span>
            </h1>
            <Badge variant="primary">Administração</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Integração ERP RBXSoft, parâmetros de tolerância SLA e gestão de acessos de operadores
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://www.developers.rbxsoft.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs"
          >
            <Globe className="w-3.5 h-3.5 text-brand-secondary" />
            <span>Manual RBXSoft</span>
            <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
          </a>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 bg-white border border-slate-100 rounded-2xl shadow-premium-card">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full mr-2" />
          <span className="text-xs font-semibold">Carregando parâmetros...</span>
        </div>
      ) : (
        <div className="space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Card 1: Integração com o RBXSoft */}
            <div className="bg-white border border-slate-100/90 rounded-2xl p-6 shadow-premium-card space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-brand-primary-light text-brand-primary flex items-center justify-center">
                    <Server className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-slate-900">
                      Servidor RBXSoft (Routerbox)
                    </h2>
                    <span className="text-[11px] text-slate-400">Endpoint REST e credencial de autenticação</span>
                  </div>
                </div>
                <Badge variant="primary" className="text-[11px]">
                  REST Web Services
                </Badge>
              </div>

              {/* Informação contextual */}
              <div className="p-4 bg-slate-50/80 border border-slate-100 rounded-xl text-xs text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-brand-primary" />
                  <span>Onde obter esses dados no seu RBXSoft?</span>
                </div>
                <p className="leading-relaxed text-slate-600">
                  No sistema RBXSoft da sua empresa, acesse: <strong>Empresa &gt; Parâmetros &gt; Web Services</strong>.
                  Lá você obtém a chave de 30 caracteres e valida as permissões de rede.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                {/* URL do RBXSoft */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block font-semibold text-slate-800">
                    Endereço do Servidor Web Service (URL)
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                    <input
                      type="text"
                      required
                      disabled={!isAdmin}
                      value={settings.rbx_url}
                      onChange={(e) => setSettings({ ...settings, rbx_url: e.target.value })}
                      placeholder="https://seuprovedor.rbxsoft.com.br/routerbox/ws/rbx_server_json.php"
                      className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 outline-none font-mono text-slate-800"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    Exemplo: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">https://[seu_provedor]/routerbox/ws/rbx_server_json.php</code>
                  </span>
                </div>

                {/* Chave de Integração */}
                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-800">
                    Chave de Acesso (API Key)
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                    <input
                      type={showKey ? 'text' : 'password'}
                      required
                      disabled={!isAdmin}
                      value={settings.rbx_chave}
                      onChange={(e) => setSettings({ ...settings, rbx_chave: e.target.value })}
                      placeholder="Cole a chave de 30 caracteres do RBXSoft"
                      className="w-full pl-9 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 outline-none font-mono text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Tipo de Ambiente */}
                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-800">
                    Ambiente Operacional
                  </label>
                  <select
                    disabled={!isAdmin}
                    value={settings.rbx_ambiente}
                    onChange={(e) => setSettings({ ...settings, rbx_ambiente: e.target.value as any })}
                    className="w-full py-2 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
                  >
                    <option value="homologacao">Homologação (Testes / Validação)</option>
                    <option value="producao">Produção (Base Real do Provedor)</option>
                  </select>
                </div>

                {/* Modo Simulação */}
                <div className="md:col-span-2 p-4 bg-slate-50/70 border border-slate-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-800 text-xs">
                      Modo Demonstração / Dados de Simulação
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Permite navegar no painel enquanto a rota de rede do ERP do provedor é liberada.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setSettings({ ...settings, rbx_use_mock: !settings.rbx_use_mock })}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      settings.rbx_use_mock
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {settings.rbx_use_mock ? '✓ Modo Demonstração Ativo' : 'Conexão Direta ERP'}
                  </button>
                </div>
              </div>

              {/* Teste de Conexão */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Teste a comunicação antes de salvar as alterações.
                </div>

                <PillButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testing}
                  icon={RotateCw}
                >
                  {testing ? 'Testando Conexão...' : 'Testar Comunicação'}
                </PillButton>
              </div>

              {/* Resultado do Teste Visual */}
              {testResult && (
                <div
                  className={`p-4 rounded-xl border text-xs flex items-start gap-3 animate-in fade-in duration-150 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 flex-1">
                    <div className="font-bold text-xs">
                      {testResult.success ? 'Conexão Estabelecida com Sucesso!' : 'Atenção na Conexão:'}
                    </div>
                    <p className="leading-relaxed">{testResult.message}</p>
                    {testResult.responseTimeMs > 0 && (
                      <div className="text-[11px] opacity-80 pt-0.5 font-mono">
                        Tempo de resposta: <strong>{testResult.responseTimeMs}ms</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Card 2: Regras e Alertas Operacionais */}
            <div className="bg-white border border-slate-100/90 rounded-2xl p-6 shadow-premium-card space-y-5">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-slate-900">
                    Regras de Prazos de Atendimento (SLA) & Recorrência
                  </h2>
                  <span className="text-[11px] text-slate-400">Janelas de tolerância e disparadores de risco</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-800">
                    Janela de Alerta para "Prazo em Risco" (Minutos)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={5}
                      max={240}
                      disabled={!isAdmin}
                      value={settings.sla_risk_window}
                      onChange={(e) => setSettings({ ...settings, sla_risk_window: Number(e.target.value) })}
                      className="w-32 py-2 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:ring-2 focus:ring-brand-primary/20 outline-none"
                    />
                    <span className="text-slate-500">minutos antes do vencimento</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-800">
                    Limite para Alerta de "Cliente Recorrente"
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={2}
                      max={10}
                      disabled={!isAdmin}
                      value={settings.recurrence_threshold}
                      onChange={(e) => setSettings({ ...settings, recurrence_threshold: Number(e.target.value) })}
                      className="w-32 py-2 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:ring-2 focus:ring-brand-primary/20 outline-none"
                    />
                    <span className="text-slate-500">chamados recentes</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Botão de Salvar Alterações de Integração e SLA */}
            {isAdmin && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-100/90 rounded-2xl p-5 shadow-premium-card">
                <div className="text-xs text-slate-500 font-medium">
                  {saveSuccess ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Alterações de parâmetros gravadas com sucesso!
                    </span>
                  ) : (
                    <span>As configurações são atualizadas imediatamente no runtime.</span>
                  )}
                </div>

                <PillButton
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={saving}
                  icon={Save}
                >
                  {saving ? 'Salvando...' : 'Salvar Parâmetros'}
                </PillButton>
              </div>
            )}
          </form>

          {/* Card 3: Gerenciamento de Usuários do Sistema */}
          <div className="bg-white border border-slate-100/90 rounded-2xl p-6 shadow-premium-card space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-brand-primary flex items-center justify-center">
                  <Users className="w-4 h-4" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-slate-900">
                    Gerenciamento de Usuários do Sistema
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    Controle de contas operacionais, papéis RBAC, bloqueio e edição de acessos
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <PillButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchUsers}
                  disabled={loadingUsers}
                  icon={RotateCw}
                >
                  Atualizar
                </PillButton>

                {isAdmin && (
                  <PillButton
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setNewUserModalOpen(true)}
                    icon={UserPlus}
                  >
                    Novo Usuário
                  </PillButton>
                )}
              </div>
            </div>

            {/* Tabela de Usuários */}
            {loadingUsers ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <div className="inline-block animate-spin w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full mr-2" />
                Carregando lista de operadores...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3">Operador / Nome</th>
                      <th className="py-3 px-3">E-mail Corporativo</th>
                      <th className="py-3 px-3">Papel RBAC</th>
                      <th className="py-3 px-3">Situação</th>
                      <th className="py-3 px-3 text-right">Ações de Gestão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const isLocked = Boolean(u.lockedUntil && new Date(u.lockedUntil) > new Date());
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900">{u.fullName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">@{u.username}</div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-medium">{u.email}</td>
                          <td className="py-3 px-3">
                            {isAdmin ? (
                              <select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                className="py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                              >
                                <option value="admin">Administrador</option>
                                <option value="gestor">Gestor</option>
                                <option value="supervisor">Supervisor</option>
                                <option value="tecnico">Técnico N2</option>
                              </select>
                            ) : (
                              <Badge
                                variant={
                                  u.role === 'admin'
                                    ? 'primary'
                                    : u.role === 'gestor'
                                    ? 'primary'
                                    : u.role === 'supervisor'
                                    ? 'secondary'
                                    : 'neutral'
                                }
                              >
                                {u.role.toUpperCase()}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {isLocked ? (
                              <Badge variant="overdue" pulse>
                                Bloqueado
                              </Badge>
                            ) : (
                              <Badge variant="ok">Ativo</Badge>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Botão Editar */}
                              <button
                                type="button"
                                onClick={() => handleStartEdit(u)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-2xs"
                                title="Editar dados e perfil do usuário"
                              >
                                <Pencil className="w-3 h-3 text-brand-primary" />
                                <span>Editar</span>
                              </button>

                              {/* Botão Bloquear / Desbloquear */}
                              <button
                                type="button"
                                onClick={() => handleToggleLock(u)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors shadow-2xs border ${
                                  isLocked
                                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                                }`}
                                title={isLocked ? 'Desbloquear acesso do usuário' : 'Bloquear acesso do usuário temporariamente'}
                              >
                                {isLocked ? (
                                  <>
                                    <Unlock className="w-3 h-3 text-amber-600" />
                                    <span>Desbloquear</span>
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-3 h-3 text-slate-400" />
                                    <span>Bloquear</span>
                                  </>
                                )}
                              </button>

                              {/* Botão Excluir */}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  disabled={u.username === user?.username}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200 disabled:opacity-30 disabled:pointer-events-none"
                                  title={u.username === user?.username ? 'Você não pode excluir sua própria conta' : 'Excluir usuário'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal Novo Usuário */}
          {newUserModalOpen && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-brand-primary" />
                    <h3 className="text-sm font-bold text-slate-900">Novo Usuário do Sistema</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewUserModalOpen(false)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateUser} className="p-5 space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={newUserForm.fullName}
                      onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                      placeholder="Ex: Carlos Eduardo"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Nome de Usuário</label>
                      <input
                        type="text"
                        required
                        value={newUserForm.username}
                        onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                        placeholder="carlos.eduardo"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Papel / Perfil</label>
                      <select
                        value={newUserForm.role}
                        onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                      >
                        <option value="tecnico">Técnico N2</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="gestor">Gestor</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">E-mail Corporativo</label>
                    <input
                      type="email"
                      required
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                      placeholder="operador@provedor.com.br"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Senha Inicial</label>
                    <input
                      type="password"
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                      placeholder="Padrão: Admin@123 (ou mínimo 6 caracteres)"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Se deixado em branco, a senha padrão será <strong>Admin@123</strong>.
                    </span>
                  </div>

                  <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                    <PillButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewUserModalOpen(false)}
                    >
                      Cancelar
                    </PillButton>
                    <PillButton
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={creatingUser}
                    >
                      {creatingUser ? 'Salvando...' : 'Cadastrar Usuário'}
                    </PillButton>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Edição de Usuário */}
          {editingUser && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-brand-primary" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Editar Operador</h3>
                      <div className="text-[11px] text-slate-400 font-mono">@{editingUser.username}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">E-mail Corporativo</label>
                      <input
                        type="email"
                        required
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Papel / Perfil</label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                      >
                        <option value="tecnico">Técnico N2</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="gestor">Gestor</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-brand-secondary" />
                      <span>Redefinir Senha de Acesso (Opcional)</span>
                    </label>
                    <input
                      type="password"
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      placeholder="Deixe em branco para manter a senha atual"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-primary/20"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Caso preenchido, nova senha será criptografada com scrypt.
                    </span>
                  </div>

                  <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                    <PillButton
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingUser(null)}
                    >
                      Cancelar
                    </PillButton>
                    <PillButton
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={savingEdit}
                    >
                      {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
                    </PillButton>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
