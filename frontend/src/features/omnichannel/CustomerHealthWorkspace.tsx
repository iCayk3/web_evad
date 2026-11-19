import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowUpRight, ChevronLeft, ChevronRight, Download, RefreshCw, Search, ShieldAlert, X } from 'lucide-react';
import { apiFetch, ApiError } from '../../lib/api.ts';
import { CustomerHealth, HealthClient, Priority } from './types/customer-health.types.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { RbxTicketHistory } from './components/RbxTicketHistory.tsx';
type View = 'thermometer' | 'clients' | 'causes' | 'quality' | 'operations';
const priorities: Record<Priority, {
    label: string;
    style: string;
}> = {
    critical: { label: 'Crítico', style: 'bg-red-50 text-red-700 border-red-200' },
    high: { label: 'Alto', style: 'bg-orange-50 text-orange-800 border-orange-200' },
    attention: { label: 'Atenção', style: 'bg-amber-50 text-amber-800 border-amber-200' },
    insufficient: { label: 'Dados insuficientes', style: 'bg-slate-100 text-slate-600 border-slate-200' },
};
const date = (value: string | null) => value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não informado';
const today = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - days * 86400000 - 3 * 3600000).toISOString().slice(0, 10);
const control = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600';
const card = 'rounded-2xl border border-slate-200 bg-white p-5';
function PriorityBadge({ value }: {
    value: Priority;
}) {
    return <span className={`inline-flex whitespace-nowrap items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${priorities[value].style}`}><span aria-hidden="true">{value === 'insufficient' ? '?' : '!'}</span>{priorities[value].label}</span>;
}
function ClientHistory({ client, onClose }: {
    client: HealthClient;
    onClose: () => void;
}) {
    const close = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement;
        close.current?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                onClose();
            if (event.key === 'Tab') {
                const elements = close.current?.closest('[role="dialog"]')?.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex="0"]');
                if (!elements?.length)
                    return;
                const first = elements[0], last = elements[elements.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                }
                else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
    }, [onClose]);
    const events = [...client.contacts.map(c => ({ key: `c-${c.id}`, at: c.startedAt, content: <><time className="text-xs text-slate-500">{date(c.startedAt)}</time><h4 className="mt-1 font-semibold">Omnichannel · {c.conversationId}</h4><p className="mt-1 text-sm text-slate-600">{c.department} · {c.status} · {c.causes.join(', ') || 'Sem classificação'}</p></> })),
        ...client.tickets.map(t => ({ key: `t-${t.id}`, at: t.openedAt, content: <RbxTicketHistory ticket={t}/> }))].sort((a, b) => b.at.localeCompare(a.at));
    return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onMouseDown={event => { if (event.target === event.currentTarget)
        onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="health-client-title" className="h-full w-full max-w-2xl overflow-y-auto bg-slate-50 p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-blue-700">HISTÓRICO DO CLIENTE · RBX {client.id}</p><h2 id="health-client-title" className="mt-2 text-xl font-bold">{client.name}</h2></div><button ref={close} onClick={onClose} className={control} aria-label="Fechar histórico"><X size={20}/></button></div>
      <div className={`${card} mt-6 space-y-3`}><PriorityBadge value={client.priority}/><p className="text-sm text-slate-600">Avaliação parcial · Sentimento: {client.sentiment}</p>{(client.reasons || []).map(reason => <p key={reason} className="text-sm font-medium">• {reason}</p>)}<p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{client.recommendation}</p></div>
      <dl className={`${card} mt-4 grid grid-cols-2 gap-4 text-sm`}><div><dt className="text-slate-500">Cadastro de origem</dt><dd>{date(client.registeredAt)}</dd></div><div><dt className="text-slate-500">Login(s) PPPoE</dt><dd className="font-mono text-blue-700 font-semibold">{client.pppoeLogin || 'Não informado'}</dd></div><div><dt className="text-slate-500">Relacionamento antigo</dt><dd>{client.isOld === null ? 'Não avaliável' : client.isOld ? 'Sim, por data cadastral' : 'Não'}</dd></div><div><dt className="text-slate-500">Cidade / plano</dt><dd>{client.city || 'Não informado'} / {client.plan || 'Não informado'}</dd></div><div className="col-span-2"><dt className="text-slate-500">Estabilidade da conexão</dt><dd>Extrato real pendente de validação</dd></div></dl>
      <h3 className="mb-2 mt-6 font-bold">Linha do tempo</h3><p className="mb-4 text-xs text-slate-500">Conversas no recorte e protocolos retornados pelo RBX. Proximidade temporal e mesma classificação indicam associação por cliente; não confirmam vínculo entre protocolos ou acessos. Status RBX é o estado informado na consulta atual.</p>
      <ol className="space-y-3">{events.map(event => <li key={event.key} className={card}>{event.content}</li>)}</ol>
    </section>
  </div>;
}
export function CustomerHealthWorkspace({ operations }: {
    operations: React.ReactNode;
}) {
    const { user } = useAuth();
    const initial = new URLSearchParams(window.location.search);
    const [view, setView] = useState<View>((['thermometer', 'clients', 'causes', 'quality', 'operations'].includes(initial.get('healthView') || '') ? initial.get('healthView') : 'thermometer') as View);
    const [start, setStart] = useState(initial.get('healthStart') || daysAgo(29));
    const [end, setEnd] = useState(initial.get('healthEnd') || today());
    const [department, setDepartment] = useState(initial.get('healthDepartment') || '');
    const [channel, setChannel] = useState(initial.get('healthChannel') || '');
    const [city, setCity] = useState(initial.get('healthCity') || '');
    const [plan, setPlan] = useState(initial.get('healthPlan') || '');
    const readNumber = (key: string, fallback: number, min: number, max: number) => {
        const value = Number(initial.get(key));
        return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
    };
    const [threshold, setThreshold] = useState(() => readNumber('healthThreshold', 2, 2, 20));
    const [oldMonths, setOldMonths] = useState(() => readNumber('healthOldMonths', 6, 1, 120));
    const [data, setData] = useState<CustomerHealth | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refresh, setRefresh] = useState(0);
    const [search, setSearch] = useState('');
    const [priority, setPriority] = useState(initial.get('healthPriority') || '');
    const [segment, setSegment] = useState(initial.get('healthSegment') || '');
    const [cause, setCause] = useState(initial.get('healthCause') || '');
    const [page, setPage] = useState(0);
    const [selected, setSelected] = useState<HealthClient | null>(null);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');
    const queryRef = useRef('');
    useEffect(() => {
        const url = new URL(window.location.href);
        Object.entries({ healthView: view, healthStart: start, healthEnd: end, healthDepartment: department, healthChannel: channel, healthCity: city, healthPlan: plan, healthPriority: priority, healthSegment: segment, healthCause: cause, healthThreshold: String(threshold), healthOldMonths: String(oldMonths) }).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
        window.history.replaceState(null, '', url);
    }, [view, start, end, department, channel, city, plan, priority, segment, cause, threshold, oldMonths]);
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        setSelected(null);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) {
            setData(null);
            setError('Informe datas válidas para a análise.');
            setLoading(false);
            return;
        }
        const startAt = new Date(`${start}T00:00:00-03:00`).toISOString();
        const endAt = new Date(Math.min(Date.parse(`${end}T23:59:59.999-03:00`), Date.now())).toISOString();
        const query = new URLSearchParams({ start: startAt, end: endAt, threshold: String(threshold), oldMonths: String(oldMonths) });
        Object.entries({ department, channel, city, plan }).forEach(([key, value]) => { if (value)
            query.set(key, value); });
        queryRef.current = query.toString();
        apiFetch<{
            health: CustomerHealth;
        }>(`/api/omnichannel/customer-health?${query}`).then(result => { if (active)
            setData(result.health); }).catch((error: unknown) => { if (active) {
            setData(null);
            setError(error instanceof ApiError ? error.message : 'Não foi possível conectar à API de análise. Verifique o servidor e tente novamente.');
        } }).finally(() => { if (active)
            setLoading(false); });
        return () => { active = false; };
    }, [start, end, department, channel, city, plan, threshold, oldMonths, refresh]);
    useEffect(() => setPage(0), [search, priority, segment, cause, data]);
    const clients = (data?.clients || []).filter(client => (!search || `${client.name} ${client.id} ${client.pppoeLogin || ''} ${client.contacts.map(c => c.conversationId).join(' ')} ${client.tickets.map(t => t.protocol).join(' ')}`.toLowerCase().includes(search.toLowerCase())) &&
        (!priority || client.priority === priority || (priority === 'urgent' && ['critical', 'high'].includes(client.priority))) &&
        (!segment || (segment === 'recurrent' && client.recurrent) || (segment === 'old' && client.isOld) || (segment === 'return' && client.returnAfterConclusion)) &&
        (!cause || client.contacts.some(c => (c.causes.length ? c.causes : ['Não classificado']).includes(cause))));
    const goClients = (nextSegment = '', nextPriority = '', nextCause = '') => { setView('clients'); setSegment(nextSegment); setPriority(nextPriority); setCause(nextCause); setSearch(''); };
    const reset = () => { setSearch(''); setSegment(''); setPriority(''); setCause(''); };
    const exportCsv = async () => {
        setExporting(true);
        setExportError('');
        try {
            await apiFetch(`/api/omnichannel/customer-health?${queryRef.current}&export=true`);
            const cell = (value: unknown) => `"${String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
            const rows = [['RBX', 'Cliente', 'Login PPPoE', 'Prioridade', 'Conversas 7d', 'Protocolos 7d', 'Motivos', 'Recomendação', 'Início', 'Fim', 'Regra', 'Avaliação'], ...clients.map(c => [c.id, c.name, c.pppoeLogin || '', priorities[c.priority].label, c.recentContacts, c.recentTickets, (c.reasons || []).join('; '), c.recommendation, data?.options.start, data?.options.end, data?.ruleVersion, 'Parcial'])];
            const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `saude-clientes-${end}.csv`;
            link.click();
            URL.revokeObjectURL(url);
        }
        catch {
            setExportError('Exportação indisponível ou não autorizada. Tente novamente.');
        }
        finally {
            setExporting(false);
        }
    };
    const clientTable = <section className={`${card} overflow-hidden`}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Clientes que merecem atenção</h2><p className="text-xs text-slate-500">{clients.length} clientes · prioridade explicável · avaliação parcial</p></div>{['admin', 'gestor'].includes(user?.role || '') && <button onClick={exportCsv} className={control} disabled={loading || !data || exporting}><Download className="mr-2 inline" size={15}/>{exporting ? 'Preparando…' : 'Exportar lista'}</button>}</div>
    {exportError && <p role="alert" className="mb-3 text-sm text-red-700">{exportError}</p>}
    <div className="mb-4 flex flex-wrap gap-2"><label className="flex items-center gap-2"><Search size={16}/><input aria-label="Buscar cliente, código, login PPPoE ou protocolo" placeholder="Buscar cliente, código, login PPPoE ou protocolo" value={search} onChange={e => setSearch(e.target.value)} className={control}/></label><select aria-label="Prioridade" value={priority} onChange={e => setPriority(e.target.value)} className={control}><option value="">Todas as prioridades</option><option value="urgent">Crítico e alto</option>{Object.entries(priorities).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select><select aria-label="Segmento" value={segment} onChange={e => setSegment(e.target.value)} className={control}><option value="">Todos os segmentos</option><option value="recurrent">Recorrentes 7 dias</option><option value="old">Antigos com ocorrência no recorte</option><option value="return">Retorno após conclusão</option></select><button onClick={reset} className={control}>Limpar lista{cause ? ` · ${cause}` : ''}</button></div>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500"><tr>{['Cliente', 'Prioridade', 'Evidências', 'Eventos / 7d', 'Última ocorrência', 'Histórico'].map(label => <th key={label} scope="col" className="px-3 py-3">{label}</th>)}</tr></thead><tbody>{clients.slice(page * 15, (page + 1) * 15).map(client => <tr key={client.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="px-3 py-4"><p className="font-semibold">{client.name}</p><div className="flex flex-wrap items-center gap-1.5 mt-0.5"><span className="text-xs text-slate-500 font-mono">RBX #{client.id}</span>{client.pppoeLogin && (<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-blue-700 text-[11px] font-mono font-medium" title={`Login(s) PPPoE: ${client.pppoeLogin}`}><span className="text-[10px] text-blue-500 font-sans font-semibold">PPPoE:</span>{client.pppoeLogin}</span>)}{client.city && <span className="text-xs text-slate-400">· {client.city}</span>}</div></td><td className="px-3 py-4"><PriorityBadge value={client.priority}/></td><td className="max-w-xs px-3 py-4 text-xs text-slate-600">{(client.reasons || []).join(' · ') || 'Histórico incompleto; sem sinal comprovado nas regras disponíveis.'}</td><td className="px-3 py-4 font-semibold tabular-nums">{client.recentContacts} chat / {client.recentTickets} RBX</td><td className="whitespace-nowrap px-3 py-4 text-xs">{date(client.lastContactAt)}</td><td className="px-3 py-4"><button aria-label={`Ver histórico de ${client.name}`} onClick={() => setSelected(client)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><ArrowUpRight size={19}/></button></td></tr>)}</tbody></table></div>
    {!clients.length && <p role="status" className="p-8 text-center text-sm text-slate-500">Nenhum cliente confirmado neste recorte. Confira os filtros e os vínculos em Dados e qualidade.</p>}
    <div className="mt-4 flex items-center justify-end gap-3 text-xs text-slate-500"><button aria-label="Página anterior" disabled={page === 0} onClick={() => setPage(page - 1)} className={`${control} disabled:opacity-40`}><ChevronLeft size={15}/></button><span>Página {page + 1} de {Math.max(1, Math.ceil(clients.length / 15))}</span><button aria-label="Próxima página" disabled={(page + 1) * 15 >= clients.length} onClick={() => setPage(page + 1)} className={`${control} disabled:opacity-40`}><ChevronRight size={15}/></button></div>
  </section>;
    return <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8 text-slate-900">
    <header className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="rounded-2xl bg-blue-700 p-3 text-white"><Activity size={23}/></span><div><h1 className="text-2xl font-bold tracking-tight">Análises de Atendimento</h1><p className="text-sm text-slate-500">Saúde dos clientes, recorrências e sinais de atenção</p></div></div><button onClick={() => setRefresh(refresh + 1)} className={control}><RefreshCw size={15} className="mr-2 inline"/>Atualizar análise</button></header>
    <nav aria-label="Visões de análise" className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1.5">{([['thermometer', 'Termômetro'], ['clients', 'Clientes'], ['causes', 'Causas e tendências'], ['quality', 'Dados e qualidade'], ['operations', 'Diagnóstico operacional']] as [
        View,
        string
    ][]).map(([key, label]) => <button key={key} onClick={() => setView(key)} aria-current={view === key ? 'page' : undefined} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${view === key ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}</nav>
    {view === 'operations' ? operations : <>
      <div className={`${card} flex flex-wrap items-end gap-3`}><label className="space-y-1 text-xs font-medium">De<input type="date" required value={start} max={end} onChange={e => { if (e.target.value)
            setStart(e.target.value); }} className={`${control} block`}/></label><label className="space-y-1 text-xs font-medium">Até<input type="date" required value={end} min={start} max={today()} onChange={e => { if (e.target.value)
            setEnd(e.target.value); }} className={`${control} block`}/></label>{[7, 30, 90].map(days => <button key={days} onClick={() => { setStart(daysAgo(days - 1)); setEnd(today()); }} className={control}>{days} dias</button>)}
        {([['Departamento', department, setDepartment, data?.filters.departments], ['Canal', channel, setChannel, data?.filters.channels], ['Cidade', city, setCity, data?.filters.cities], ['Plano', plan, setPlan, data?.filters.plans]] as const).map(([label, value, setter, values]) => <label key={label} className="space-y-1 text-xs font-medium">{label}<select value={value} onChange={e => setter(e.target.value)} className={`${control} block max-w-[200px]`}><option value="">Todos</option>{values?.map(item => <option key={item}>{item}</option>)}</select></label>)}
      </div>
      {loading && <p role="status" className={card}>Consultando os registros e calculando os sinais…</p>}
      {error && <div role="alert" className={`${card} text-red-700`}>{error} <button onClick={() => setRefresh(refresh + 1)} className={control}>Tentar novamente</button></div>}
      {!loading && data && <>
        {(!data.quality?.clientsAvailable || !data.quality?.ticketsAvailable) && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Consulta RBX incompleta.</strong> {!data.quality?.clientsAvailable && 'O cadastro de clientes não pôde ser consultado. '}{!data.quality?.ticketsAvailable && 'Os protocolos não puderam ser consultados. '}Os indicadores disponíveis são parciais; falha de consulta não significa ausência de atendimentos.</div>}
        {data.summary.contacts === 0 && <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Nenhuma conversa Omnichannel neste recorte.</p><p className="mt-1">{data.quality?.contactPeriod ? `${data.quality?.importedContacts.toLocaleString('pt-BR')} conversas importadas disponíveis entre ${date(data.quality?.contactPeriod.start)} e ${date(data.quality?.contactPeriod.end)}.` : 'Não há conversas em lotes concluídos nesta base.'} Protocolos RBX são analisados independentemente das importações.</p>{data.quality?.contactPeriod && <button className={`${control} mt-3`} onClick={() => { const period = data.quality?.contactPeriod!; setStart(new Date(Date.parse(period.start) - 3 * 3600000).toISOString().slice(0, 10)); setEnd(new Date(Math.min(Date.parse(period.end), Date.now()) - 3 * 3600000).toISOString().slice(0, 10)); setDepartment(''); setChannel(''); setCity(''); setPlan(''); reset(); }}>Analisar período das importações</button>}</section>}
        <p className="text-sm text-slate-600"><strong>{data.summary.observedClients.toLocaleString('pt-BR')}</strong> clientes observados · <strong>{data.summary.contacts.toLocaleString('pt-BR')}</strong> conversas Omnichannel · <strong>{data.summary.tickets.toLocaleString('pt-BR')}</strong> protocolos RBX no recorte</p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><p>{data.quality?.mock ? 'DEMONSTRAÇÃO · ' : ''}Atualizado: {date(data.generatedAt)} · Regra {data.ruleVersion} · {data.summary.observedClients} clientes observados</p><button onClick={() => setView('quality')} className="font-semibold text-amber-800"><ShieldAlert size={14} className="mr-1 inline"/>Avaliação parcial · ver cobertura</button></div>
        {view === 'thermometer' && <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[
                        { label: 'Prioridade crítica / alta', value: data.summary.highPriority, detail: 'Clientes com sinais comprovados', click: () => goClients('', 'urgent'), dark: true },
                        { label: 'Recorrentes em 7 dias', value: data.summary.recurrent, detail: `${threshold}+ conversas ou protocolos, sem somar as fontes`, click: () => goClients('recurrent') },
                        { label: 'Antigos com ocorrência', value: data.summary.oldClients, detail: `${oldMonths}+ meses por data cadastral`, click: () => goClients('old') },
                        { label: 'Retorno após conclusão', value: data.summary.returns, detail: 'Mesma classificação · associação por cliente', click: () => goClients('return') },
                    ].map(item => <button key={item.label} onClick={item.click} className={`rounded-2xl border p-5 text-left transition hover:shadow-md ${item.dark ? 'border-[#0A1938] bg-[#0A1938] text-white' : 'border-slate-200 bg-white'}`}><p className="text-sm font-medium">{item.label}</p><p className="my-3 text-4xl font-bold tabular-nums">{item.value}</p><p className={`text-xs ${item.dark ? 'text-slate-300' : 'text-slate-500'}`}>{item.detail}</p></button>)}</section>
          <div className="grid gap-4 lg:grid-cols-2"><section className={card}><h2 className="font-bold">Distribuição por prioridade</h2><p className="mb-5 mt-1 text-xs text-slate-500">Carteira observada, sem inferir satisfação dos clientes sem contato.</p>{Object.entries(priorities).map(([key, value]) => { const count = data.clients.filter(c => c.priority === key).length; return <button key={key} onClick={() => goClients('', key)} className="mb-3 block w-full text-left"><div className="mb-1 flex justify-between text-xs"><span>{value.label}</span><span className="tabular-nums">{count} · {data.clients.length ? Math.round(count / data.clients.length * 100) : 0}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${key === 'critical' ? 'bg-red-500' : key === 'high' ? 'bg-orange-500' : key === 'attention' ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${data.clients.length ? count / data.clients.length * 100 : 0}%` }}/></div></button>; })}</section>
          <section className={card}><h2 className="font-bold">Volume de conversas por dia</h2><p className="mb-4 mt-1 text-xs text-slate-500">{data.summary.contacts} conversas únicas no recorte. Dias sem registros não comprovam ausência de demanda.</p><div className="flex h-32 items-end gap-1 overflow-x-auto" role="img" aria-label="Volume diário de conversas; valores disponíveis na tabela abaixo">{(data.daily || []).map(item => <div key={item.day} title={`${item.day}: ${item.contacts} conversas`} className="min-w-2 flex-1 rounded-t bg-blue-600" style={{ height: `${Math.max(3, item.contacts / Math.max(...(data.daily || []).map(d => d.contacts), 1) * 100)}%` }}/>)}</div><details className="mt-4 text-xs text-slate-500"><summary className="cursor-pointer">Consultar valores diários</summary><ul className="mt-2 max-h-40 overflow-auto">{(data.daily || []).map(d => <li key={d.day}>{d.day}: {d.contacts} conversas</li>)}</ul></details></section></div>
          {clientTable}
          <section className={card}><h2 className="font-bold">Estabilidade da conexão</h2><p className="mt-2 text-sm text-slate-600">O extrato real de autenticação está pendente de validação. Reconexões, sessões curtas e possíveis interrupções serão apresentados por acesso quando houver evidência confiável.</p></section>
        </>}
        {view === 'clients' && clientTable}
        {view === 'causes' && <section className={card}><h2 className="font-bold">Classificações e clientes afetados</h2><p className="mb-5 mt-1 text-sm text-slate-500">Origem: ISPCHAT. Uma conversa pode ter várias classificações. Comparação observada com período anterior de igual duração; cobertura histórica não comprovada.</p><div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{['Classificação', 'Clientes no recorte', 'Conversas', 'Clientes anteriores', 'Variação observada'].map(label => <th scope="col" className="border-b p-3" key={label}>{label}</th>)}</tr></thead><tbody>{(data.causes || []).map(item => <tr key={item.name} className="border-b border-slate-100"><td className="p-3"><button className="text-left font-semibold text-blue-700 hover:underline" onClick={() => goClients('', '', item.name)}>{item.name}</button></td><td className="p-3 tabular-nums">{item.clients}</td><td className="p-3 tabular-nums">{item.contacts}</td><td className="p-3 tabular-nums">{item.previousClients}</td><td className="p-3">{item.change === null ? item.clients ? 'Primeiro registro observado' : '—' : `${item.change > 0 ? '+' : ''}${item.change}%`}</td></tr>)}</tbody></table></div>{!(data.causes || []).length && <p className="py-6 text-sm text-slate-500">Sem classificações de clientes confirmados no período.</p>}</section>}
        {view === 'quality' && <div className="space-y-4"><section className={card}><h2 className="font-bold">Qualidade e alcance da análise</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{[['Última importação', date(data.quality?.lastImportAt ?? null)], ['Vínculos não confirmados no recorte', data.summary.unconfirmedContacts], ['Iniciador não informado', data.summary.unknownInitiator], ['Cópias entre lotes desconsideradas', (data.quality?.duplicateRows ?? 0)], ['Datas inválidas desconsideradas', (data.quality?.invalidDates ?? 0)], ['Clientes / protocolos RBX', `${data.quality?.clientsAvailable ? 'Recebidos' : 'Indisponíveis'} / ${data.quality?.ticketsAvailable ? 'Recebidos' : 'Indisponíveis'}`]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl><ul className="mt-5 space-y-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{(data.quality?.warnings || []).map(warning => <li key={warning}>• {warning}</li>)}</ul></section>
          <section className={card}><h2 className="font-bold">Parâmetros desta análise</h2><p className="mt-1 text-xs text-slate-500">Configuração da consulta; não altera parâmetros de outros gestores.</p><div className="mt-4 flex flex-wrap gap-4"><label className="text-sm">Eventos por fonte em 7 dias<input type="number" min={2} max={20} value={threshold} onChange={e => { const n = Number(e.target.value); if (n >= 2 && n <= 20)
                    setThreshold(n); }} className={`${control} ml-3 w-20`}/></label><label className="text-sm">Cliente antigo (meses)<input type="number" min={1} max={120} value={oldMonths} onChange={e => { const n = Number(e.target.value); if (n >= 1 && n <= 120)
                    setOldMonths(n); }} className={`${control} ml-3 w-20`}/></label></div><button onClick={() => setView('operations')} className={`${control} mt-5`}>Abrir importações e revisão de vínculos <ArrowUpRight size={15} className="ml-2 inline"/></button></section></div>}
      </>}
    </>}
    {selected && <ClientHistory client={selected} onClose={() => setSelected(null)}/>}
  </div>;
}
