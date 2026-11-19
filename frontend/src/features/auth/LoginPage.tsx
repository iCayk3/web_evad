import React, { useState } from 'react';
import { Shield, Lock, User, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { PillButton } from '../../components/common/PillButton.tsx';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Falha ao autenticar. Verifique usuário e senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Logo e Cabeçalho */}
        <div className="text-center mb-8">
          <img
            src="/favicon.svg"
            alt="RBX Hub"
            className="inline-block w-14 h-14 rounded-2xl shadow-lg shadow-brand-primary/25 mb-3 object-contain"
          />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            RBX Hub
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Plataforma operacional e analítica de alto padrão para provedores ISP
          </p>
        </div>

        {/* Card do Formulário */}
        <div className="bg-white rounded-3xl shadow-signature border border-slate-100/90 p-7 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">Acesso Corporativo</h2>
            <p className="text-xs text-slate-500 mt-0.5">Informe suas credenciais internas para acessar</p>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="username">
                Usuário ou E-mail
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  id="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 outline-none text-slate-900 font-medium placeholder:text-slate-400"
                  placeholder="Digite seu usuário ou e-mail"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="password">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 outline-none text-slate-900 placeholder:text-slate-400"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <PillButton
              type="submit"
              variant="primary"
              size="lg"
              shape="rounded"
              disabled={loading}
              className="w-full justify-center shadow-md"
              icon={ArrowRight}
              iconPosition="right"
            >
              {loading ? 'Autenticando...' : 'Entrar no RBX Hub'}
            </PillButton>
          </form>
        </div>

        {/* Rodapé de Segurança e Governança */}
        <div className="text-center mt-6 text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span>Sessão protegida por HTTP-Only Cookies e Criptografia Scrypt</span>
        </div>
      </div>
    </div>
  );
};
