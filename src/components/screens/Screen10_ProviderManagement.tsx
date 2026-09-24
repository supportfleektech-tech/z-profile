import React, { useMemo, useState } from 'react';
import {
  Server, Activity, KeyRound, ScrollText, Gauge, Link2, PlugZap, Save, Power, Terminal,
  CheckCircle2, XCircle, Loader2, Plus, Trash2, Eye, EyeOff, RefreshCw, AlertTriangle, Clock,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import {
  Badge, Button, Callout, EmptyState, Field, Modal, Panel, ProgressBar, ResponsiveTable, SearchInput,
  Select, Tabs, TextArea, TextInput, Toggle, type Column,
} from '../ui';
import { KraLogo, MpesaLogo, CrbLogo, EmployerLogo, KplcLogo } from '../common/ProviderLogos';
import { KES, formatDate, maskSecret, timeAgo, toCsv, downloadText } from '../../lib/format';
import type { ApiKeyRecord, ProviderConfig, ProviderFieldMapping, ProviderRequestLog } from '../../types';
import { SPIN_MODULES } from '../../data/spinModules';

const TABS = ['Gateways', 'Configuration', 'Field Mapping', 'API Keys', 'Request Logs', 'Usage & Cost'] as const;
type Tab = (typeof TABS)[number];

const Logo: React.FC<{ code: string; size?: number }> = ({ code, size = 20 }) => {
  if (code.includes('KRA')) return <KraLogo size={size} />;
  if (code.includes('M-PESA') || code.includes('MPESA')) return <MpesaLogo size={size} />;
  if (code.includes('CRB')) return <CrbLogo size={size} />;
  if (code.includes('Employer')) return <EmployerLogo size={size} />;
  if (code.includes('KPLC')) return <KplcLogo size={size} />;
  return <Server size={size} className="text-cyan-400" />;
};

const statusTone = (s: ProviderConfig['status']): 'success' | 'warning' | 'danger' | 'neutral' =>
  s === 'Active' ? 'success' : s === 'Degraded' ? 'warning' : s === 'Offline' ? 'danger' : 'neutral';

/**
 * Provider Management.
 *
 * Every gateway exposes its full configuration surface — connection, authentication,
 * resilience, commercial terms, request/response contract, field mapping, webhooks and
 * alerting — plus a staged connection test, live request logs and cost/usage rollups.
 */
export const Screen10_ProviderManagement: React.FC = () => {
  const {
    providers, providerLogs, apiKeys, can, pingProvider, syncingProviderId, updateProviderConfig,
    testProvider, testingProviderId, createApiKey, revokeApiKey, providerUsage, pushToast,
  } = useAppData();

  const [tab, setTab] = useState<Tab>('Gateways');
  const [selectedId, setSelectedId] = useState<string>(providers[0]?.id ?? '');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<ProviderConfig | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const [testOut, setTestOut] = useState<Awaited<ReturnType<typeof testProvider>> | null>(null);
  const [keyModal, setKeyModal] = useState(false);
  const [issuedKey, setIssuedKey] = useState<{ key: ApiKeyRecord; secret: string } | null>(null);
  const [mappingModal, setMappingModal] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | ProviderRequestLog['status']>('all');

  const selected = useMemo(() => providers.find((p) => p.id === selectedId) ?? providers[0], [providers, selectedId]);

  // Keep the edit draft in sync with the store whenever the selection changes.
  React.useEffect(() => {
    if (selected) setDraft({ ...selected });
    setTestOut(null);
  }, [selected?.id, providers.length]);

  const canConfigure = can('providers.configure');
  const dirty = Boolean(draft && selected && JSON.stringify(draft) !== JSON.stringify(selected));

  const openConfig = (p: ProviderConfig) => {
    setSelectedId(p.id);
    setDraft({ ...p });
    setTab('Configuration');
  };

  const save = async () => {
    if (!draft || !selected) return;
    const { id: _id, status: _s, lastSync: _ls, latencyMs: _l, uptime: _u, ...patch } = draft;
    void _id; void _s; void _ls; void _l; void _u;
    const res = await updateProviderConfig(selected.id, patch);
    if (res.ok) pushToast({ title: 'Gateway configuration saved', description: selected.name, type: 'success' });
  };

  const filteredLogs = useMemo(() => {
    const rows = selected ? providerLogs.filter((l) => l.providerId === selected.id) : providerLogs;
    return logFilter === 'all' ? rows : rows.filter((l) => l.status === logFilter);
  }, [providerLogs, selected, logFilter]);

  const logCols: Column<ProviderRequestLog>[] = [
    { key: 'at', header: 'When', render: (l) => <span className="font-mono text-[10px] text-slate-400">{formatDate(l.at, true)}</span>, mobilePrimary: true, sortValue: (l) => l.at },
    { key: 'endpoint', header: 'Endpoint', render: (l) => <span className="font-mono text-[10px] text-cyan-300 break-all">{l.endpoint}</span>, sortValue: (l) => l.endpoint },
    { key: 'actor', header: 'Actor', render: (l) => <span className="text-[10px] text-slate-400">{l.actorName}</span>, className: 'hidden lg:table-cell', sortValue: (l) => l.actorName },
    { key: 'subject', header: 'Subject ref', render: (l) => <span className="font-mono text-[10px] text-slate-500">{l.subjectRef}</span>, className: 'hidden xl:table-cell' },
    { key: 'code', header: 'HTTP', render: (l) => <Badge tone={l.httpCode < 300 ? 'success' : l.httpCode < 500 ? 'warning' : 'danger'}>{l.httpCode}</Badge>, align: 'center', sortValue: (l) => l.httpCode },
    {
      key: 'status',
      header: 'Status',
      render: (l) => (
        <span className="flex items-center gap-1.5">
          {l.status === 'success' ? <CheckCircle2 size={11} className="text-emerald-400" /> : <XCircle size={11} className="text-rose-400" />}
          <span className="text-[10px]">{l.status}</span>
        </span>
      ),
      sortValue: (l) => l.status,
    },
    { key: 'latency', header: 'ms', render: (l) => <span className="font-mono text-[10px]">{l.latencyMs}</span>, align: 'right', sortValue: (l) => l.latencyMs },
    { key: 'fields', header: 'Fields', render: (l) => <span className="font-mono text-[10px]">{l.fieldsRequested}</span>, align: 'right', className: 'hidden sm:table-cell', sortValue: (l) => l.fieldsRequested },
    { key: 'cost', header: 'Cost', render: (l) => <span className="font-mono text-[10px]">{KES(l.costKes)}</span>, align: 'right', sortValue: (l) => l.costKes },
    { key: 'ip', header: 'IP', render: (l) => <span className="font-mono text-[10px] text-slate-600">{l.ip}</span>, className: 'hidden xl:table-cell' },
    {
      key: 'err',
      header: 'Error',
      render: (l) => (l.errorMessage ? <span className="text-[10px] text-rose-300 line-clamp-1" title={l.errorMessage}>{l.errorMessage}</span> : <span className="text-slate-700">—</span>),
      renderMobile: (l) => (l.errorMessage ? <span className="text-[10px] text-rose-300">{l.errorMessage}</span> : null),
      className: 'hidden lg:table-cell',
    },
  ];

  const keyCols: Column<ApiKeyRecord>[] = [
    {
      key: 'label',
      header: 'Key',
      mobilePrimary: true,
      render: (k) => (
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-white truncate">{k.label}</div>
          <div className="font-mono text-[10px] text-cyan-400/80 truncate">{k.prefix}…{k.secretMasked}</div>
        </div>
      ),
      sortValue: (k) => k.label,
    },
    { key: 'env', header: 'Environment', render: (k) => <Badge tone={k.environment === 'live' ? 'danger' : 'info'}>{k.environment}</Badge>, sortValue: (k) => k.environment },
    { key: 'scopes', header: 'Scopes', render: (k) => <div className="flex flex-wrap gap-1">{k.scopes.map((s) => <span key={s} className="px-1.5 py-0.5 rounded bg-sky-950/70 border border-sky-900/60 text-[9px] font-mono text-slate-300">{s}</span>)}</div> },
    { key: 'provider', header: 'Provider', render: (k) => <span className="text-[10px] text-slate-400">{providers.find((p) => p.id === k.providerId)?.name ?? 'Platform-wide'}</span>, className: 'hidden lg:table-cell' },
    { key: 'created', header: 'Created', render: (k) => <span className="text-[10px] text-slate-500">{formatDate(k.createdAt)}</span>, className: 'hidden sm:table-cell', sortValue: (k) => k.createdAt },
    { key: 'last', header: 'Last used', render: (k) => <span className="text-[10px] text-slate-500">{k.lastUsedAt ? timeAgo(k.lastUsedAt) : 'Never'}</span>, className: 'hidden xl:table-cell', sortValue: (k) => k.lastUsedAt ?? '' },
    { key: 'expires', header: 'Expires', render: (k) => <span className="text-[10px] text-slate-500">{k.expiresAt ? formatDate(k.expiresAt) : 'No expiry'}</span>, className: 'hidden xl:table-cell' },
    { key: 'status', header: 'Status', render: (k) => <Badge tone={k.status === 'active' ? 'success' : 'neutral'} dot>{k.status}</Badge>, sortValue: (k) => k.status },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (k) => (
        <Button size="xs" variant="danger" disabled={!can('apikeys.manage') || k.status !== 'active'} onClick={() => revokeApiKey(k.id)} icon={<Trash2 size={11} />}>
          <span className="hidden sm:inline">Revoke</span>
        </Button>
      ),
      renderMobile: (k) => (
        <Button size="xs" variant="danger" disabled={!can('apikeys.manage') || k.status !== 'active'} onClick={() => revokeApiKey(k.id)} icon={<Trash2 size={11} />}>
          Revoke key
        </Button>
      ),
    },
  ];

  const [newKey, setNewKey] = useState({ label: '', scopes: [] as string[], environment: 'sandbox' as 'sandbox' | 'live' });
  const [newMapping, setNewMapping] = useState<Omit<ProviderFieldMapping, 'id'>>({
    platformField: '',
    providerField: '',
    type: 'string',
    required: false,
    transform: 'none',
    defaultValue: '',
    notes: '',
  });

  const usage = providerUsage;

  return (
    <div className="w-full text-xs text-slate-200">
      <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-[#08172b] to-[#071120] border-b border-sky-900/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Server size={16} className="text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white">Provider gateways</h2>
            <p className="text-[10px] text-slate-500 truncate">
              {providers.filter((p) => p.status === 'Active').length}/{providers.length} active ·{' '}
              {providers.filter((p) => p.environment === 'live').length} on live credentials
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected && (
            <Button size="sm" variant="secondary" icon={<RefreshCw size={12} />} loading={syncingProviderId === selected.id} onClick={() => pingProvider(selected.id)} disabled={!can('providers.view')}>
              Sync
            </Button>
          )}
          {selected && (
            <Button size="sm" variant="primary" icon={<PlugZap size={12} />} loading={testingProviderId === selected.id} disabled={!can('providers.test')} onClick={async () => { const r = await testProvider(selected.id); setTestOut(r); setTab('Configuration'); }}>
              Test connection
            </Button>
          )}
        </div>
      </div>

      <div className="px-2 sm:px-4 pt-3">
        <Tabs tabs={TABS} active={tab} onChange={(t) => setTab(t as Tab)} badges={{ 'API Keys': apiKeys.filter((k) => k.status === 'active').length, 'Request Logs': providerLogs.length }} />
      </div>

      <div className="p-2 sm:p-4 space-y-4">
        {/* ============================== GATEWAYS ============================== */}
        {tab === 'Gateways' && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={q} onChange={setQ} placeholder="Filter gateways…" className="w-full sm:w-64" />
              <span className="text-[10px] text-slate-500 ml-auto">
                Configure permission: {canConfigure ? <span className="text-emerald-400">granted</span> : <span className="text-amber-400">read-only for your role</span>}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {providers
                .filter((p) => !q.trim() || `${p.name} ${p.code} ${p.category}`.toLowerCase().includes(q.toLowerCase()))
                .map((p) => (
                  <div key={p.id} className="rounded-xl border border-sky-900/50 bg-[#061020] p-3 flex flex-col gap-2 hover:border-cyan-800/60 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <span className="shrink-0 mt-0.5"><Logo code={p.name} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-white truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{p.category} · <span className="font-mono">{p.code}</span></div>
                      </div>
                      <Badge tone={statusTone(p.status)} dot>{p.status}</Badge>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge tone={p.environment === 'live' ? 'danger' : 'info'}>{p.environment}</Badge>
                      <Badge tone={p.enabled ? 'success' : 'neutral'}>{p.enabled ? 'Enabled' : 'Disabled'}</Badge>
                      <Badge tone="neutral">{p.authType}</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      {[
                        ['Latency', `${p.latencyMs}ms`],
                        ['Uptime', p.uptime],
                        ['Cost/call', KES(p.costPerCallKes, { decimals: false })],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-[#050b14] border border-sky-950/70 py-1.5">
                          <div className="text-[8px] uppercase tracking-wider text-slate-600 font-bold">{k}</div>
                          <div className="text-[10px] font-mono font-bold text-slate-200">{v}</div>
                        </div>
                      ))}
                    </div>

                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock size={10} /> Last sync {timeAgo(p.lastSync)}
                      {p.lastTestAt && <span className="ml-auto">{p.lastTestResult === 'pass' ? <CheckCircle2 size={11} className="text-emerald-400 inline" /> : <XCircle size={11} className="text-rose-400 inline" />} tested {timeAgo(p.lastTestAt)}</span>}
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-sky-950/60">
                      <Button size="xs" variant="secondary" onClick={() => openConfig(p)} icon={<Activity size={11} />}>Configure</Button>
                      <Button size="xs" variant="ghost" disabled={!can('providers.test')} loading={testingProviderId === p.id} onClick={async () => { const r = await testProvider(p.id); setTestOut(r); setSelectedId(p.id); }} icon={<PlugZap size={11} />}>Test</Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={!canConfigure}
                        onClick={async () => {
                          const res = await updateProviderConfig(p.id, { enabled: !p.enabled });
                          if (res.ok) pushToast({ title: p.enabled ? 'Gateway disabled' : 'Gateway enabled', description: p.name, type: 'info' });
                        }}
                        icon={<Power size={11} />}
                      >
                        {p.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                ))}
            </div>

            {providers.filter((p) => !q.trim() || `${p.name} ${p.code} ${p.category}`.toLowerCase().includes(q.toLowerCase())).length === 0 && (
              <EmptyState title="No gateways match" description="Clear the filter to see all providers." />
            )}
          </>
        )}

        {/* ============================ CONFIGURATION ============================ */}
        {tab === 'Configuration' && selected && draft && (
          <>
            <Panel
              title={
                <span className="flex items-center gap-2 min-w-0">
                  <Logo code={selected.name} size={16} />
                  <span className="truncate">{selected.name}</span>
                  <Badge tone={statusTone(selected.status)} dot>{selected.status}</Badge>
                </span>
              }
              subtitle={<span className="font-mono text-[10px]">{selected.method} {selected.baseUrl}{selected.endpointPath}</span>}
              icon={<Activity size={14} className="text-cyan-400" />}
              actions={
                <div className="flex flex-wrap items-center gap-1.5">
                  <Select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    options={providers.map((p) => ({ value: p.id, label: p.name }))}
                    className="w-40"
                  />
                  <Button size="xs" variant="ghost" icon={showSecrets ? <EyeOff size={11} /> : <Eye size={11} />} onClick={() => setShowSecrets((v) => !v)}>
                    {showSecrets ? 'Hide' : 'Show'} secrets
                  </Button>
                  {canConfigure && (
                    <>
                      <Button size="xs" variant="ghost" disabled={!dirty} onClick={() => setDraft({ ...selected })} icon={<RefreshCw size={11} />}>Discard</Button>
                      <Button size="xs" variant="primary" disabled={!dirty} onClick={save} icon={<Save size={11} />}>Save changes</Button>
                    </>
                  )}
                </div>
              }
            >
              {!canConfigure && (
                <Callout tone="warning" title="Read-only access">
                  Your role includes <code className="font-mono">providers.view</code> but not{' '}
                  <code className="font-mono">providers.configure</code>. Ask an Admin or the Super Admin to change gateway settings.
                </Callout>
              )}

              {/* --- connection --- */}
              <Group label="Connection">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Field label="Base URL"><TextInput value={draft.baseUrl} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} /></Field>
                  <Field label="Endpoint path"><TextInput value={draft.endpointPath} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, endpointPath: e.target.value })} /></Field>
                  <Field label="HTTP method">
                    <Select value={draft.method} disabled={!canConfigure} onChange={(e) => setDraft({ ...draft, method: e.target.value as ProviderConfig['method'] })} options={[{ value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' }]} />
                  </Field>
                  <Field label="Environment">
                    <Select value={draft.environment} disabled={!canConfigure} onChange={(e) => setDraft({ ...draft, environment: e.target.value as 'sandbox' | 'live' })} options={[{ value: 'sandbox', label: 'Sandbox' }, { value: 'live', label: 'Live' }]} />
                  </Field>
                  <Field label="Certificate reference" hint="mTLS client certificate stored in the vault"><TextInput value={draft.certificateRef} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, certificateRef: e.target.value })} /></Field>
                  <Field label="Maintenance window"><TextInput value={draft.maintenanceWindow} disabled={!canConfigure} placeholder="Sun 02:00–03:00 EAT" onChange={(e) => setDraft({ ...draft, maintenanceWindow: e.target.value })} /></Field>
                  <Field label="IP allowlist (comma separated)" className="sm:col-span-2 xl:col-span-3">
                    <TextInput value={draft.ipAllowlist.join(', ')} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, ipAllowlist: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
                  </Field>
                </div>
              </Group>

              {/* --- authentication --- */}
              <Group label="Authentication">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Field label="Auth type">
                    <Select
                      value={draft.authType}
                      disabled={!canConfigure}
                      onChange={(e) => setDraft({ ...draft, authType: e.target.value as ProviderConfig['authType'] })}
                      options={[
                        { value: 'api_key', label: 'API key header' },
                        { value: 'bearer', label: 'Bearer token' },
                        { value: 'oauth2', label: 'OAuth2 client credentials' },
                        { value: 'mtls', label: 'Mutual TLS' },
                        { value: 'basic', label: 'HTTP basic' },
                        { value: 'none', label: 'None' },
                      ]}
                    />
                  </Field>
                  <Field label="Consumer key"><TextInput value={showSecrets ? draft.consumerKey : maskSecret(draft.consumerKey, 4)} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, consumerKey: e.target.value })} /></Field>
                  <Field label="Consumer secret"><TextInput type={showSecrets ? 'text' : 'password'} value={draft.consumerSecret} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, consumerSecret: e.target.value })} /></Field>
                  <Field label="Token URL" className="sm:col-span-2 xl:col-span-3"><TextInput value={draft.tokenUrl} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, tokenUrl: e.target.value })} /></Field>
                </div>
              </Group>

              {/* --- behaviour & resilience --- */}
              <Group label="Behaviour & resilience">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Field label="Timeout (ms)"><TextInput type="number" value={draft.timeoutMs} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, timeoutMs: Number(e.target.value) })} /></Field>
                  <Field label="Retries"><TextInput type="number" value={draft.retries} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, retries: Number(e.target.value) })} /></Field>
                  <Field label="Backoff strategy">
                    <Select value={draft.backoff} disabled={!canConfigure} onChange={(e) => setDraft({ ...draft, backoff: e.target.value as ProviderConfig['backoff'] })} options={[{ value: 'fixed', label: 'Fixed' }, { value: 'linear', label: 'Linear' }, { value: 'exponential', label: 'Exponential' }]} />
                  </Field>
                  <Field label="Rate limit / min"><TextInput type="number" value={draft.rateLimitPerMin} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, rateLimitPerMin: Number(e.target.value) })} /></Field>
                  <Field label="Concurrency"><TextInput type="number" value={draft.concurrency} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, concurrency: Number(e.target.value) })} /></Field>
                  <Field label="Cache TTL (sec)"><TextInput type="number" value={draft.cacheTtlSec} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, cacheTtlSec: Number(e.target.value) })} /></Field>
                  <Field label="Circuit breaker after (failures)"><TextInput type="number" value={draft.circuitBreakerFailures} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, circuitBreakerFailures: Number(e.target.value) })} /></Field>
                  <Field label="Queue priority">
                    <Select value={draft.queuePriority} disabled={!canConfigure} onChange={(e) => setDraft({ ...draft, queuePriority: e.target.value as ProviderConfig['queuePriority'] })} options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }]} />
                  </Field>
                </div>
              </Group>

              {/* --- commercial --- */}
              <Group label="Commercial terms">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Field label="Cost per call (KES)"><TextInput type="number" value={draft.costPerCallKes} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, costPerCallKes: Number(e.target.value) })} /></Field>
                  <Field label="Cost per success (KES)"><TextInput type="number" value={draft.costPerSuccessKes} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, costPerSuccessKes: Number(e.target.value) })} /></Field>
                  <Field label="Included monthly quota"><TextInput type="number" value={draft.includedMonthlyQuota} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, includedMonthlyQuota: Number(e.target.value) })} /></Field>
                  <Field label="Overage rate (KES)"><TextInput type="number" value={draft.overageRateKes} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, overageRateKes: Number(e.target.value) })} /></Field>
                  <Field label="Billing mode">
                    <Select value={draft.billingMode} disabled={!canConfigure} onChange={(e) => setDraft({ ...draft, billingMode: e.target.value as 'wallet' | 'invoice' })} options={[{ value: 'wallet', label: 'Wallet debit' }, { value: 'invoice', label: 'Monthly invoice' }]} />
                  </Field>
                  <Field label="SLA target (%)"><TextInput type="number" value={draft.slaTargetPct} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, slaTargetPct: Number(e.target.value) })} /></Field>
                </div>
              </Group>

              {/* --- contract --- */}
              <Group label="Request / response contract">
                <div className="grid gap-3 lg:grid-cols-2">
                  <Field label="Request template (JSON)" hint="Placeholders: {{idNumber}}, {{fullName}}, {{phone}}">
                    <TextArea rows={7} value={draft.requestTemplate} disabled={!canConfigure} className="font-mono text-[10px]" onChange={(e) => setDraft({ ...draft, requestTemplate: e.target.value })} />
                  </Field>
                  <Field label="Sample response (JSON)">
                    <TextArea rows={7} value={draft.responseSample} disabled={!canConfigure} className="font-mono text-[10px]" onChange={(e) => setDraft({ ...draft, responseSample: e.target.value })} />
                  </Field>
                </div>
              </Group>

              {/* --- webhooks --- */}
              <Group label="Webhooks">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Field label="Callback URL" className="sm:col-span-2"><TextInput value={draft.webhookUrl} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, webhookUrl: e.target.value })} /></Field>
                  <Field label="Signing secret"><TextInput type={showSecrets ? 'text' : 'password'} value={draft.webhookSecret} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, webhookSecret: e.target.value })} /></Field>
                  <Field label="Delivery retries"><TextInput type="number" value={draft.webhookRetries} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, webhookRetries: Number(e.target.value) })} /></Field>
                  <Field label="Subscribed events (comma separated)" className="sm:col-span-2 xl:col-span-4">
                    <TextInput value={draft.webhookEvents.join(', ')} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, webhookEvents: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
                  </Field>
                </div>
              </Group>

              {/* --- alerts --- */}
              <Group label="Alerting">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Field label="Alert when latency exceeds (ms)"><TextInput type="number" value={draft.alertLatencyMs} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, alertLatencyMs: Number(e.target.value) })} /></Field>
                  <Field label="Alert when error rate exceeds (%)"><TextInput type="number" value={draft.alertErrorRatePct} disabled={!canConfigure} className="font-mono" onChange={(e) => setDraft({ ...draft, alertErrorRatePct: Number(e.target.value) })} /></Field>
                  <Field label="Alert contacts (comma separated)"><TextInput value={draft.alertContacts.join(', ')} disabled={!canConfigure} onChange={(e) => setDraft({ ...draft, alertContacts: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
                  <Field label="Internal notes" className="sm:col-span-2 xl:col-span-3"><TextArea rows={2} value={draft.notes ?? ''} disabled={!canConfigure} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
                </div>
              </Group>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Toggle checked={draft.enabled} disabled={!canConfigure} onChange={(v) => setDraft({ ...draft, enabled: v })} label="Gateway enabled" description="Disabled gateways are skipped during a search and their checks report `insufficient`" />
                {dirty && canConfigure && <Badge tone="warning">Unsaved changes</Badge>}
              </div>
            </Panel>

            {/* --- connection test result --- */}
            {testOut && (
              <Panel
                title={<span className="flex items-center gap-2"><Terminal size={14} className="text-cyan-400" /> Connection test — {testOut.ok ? 'passed' : 'failed'}</span>}
                subtitle={`${testOut.totalMs} ms total · HTTP ${testOut.httpCode} · schema ${testOut.schemaValid ? 'valid' : 'invalid'}`}
              >
                <Callout tone={testOut.ok ? 'success' : 'danger'} title={testOut.message}>
                  <div className="space-y-1.5 mt-1">
                    {testOut.stages.map((s) => (
                      <div key={s.label} className="flex items-center gap-2 text-[11px]">
                        {s.ok ? <CheckCircle2 size={12} className="text-emerald-400 shrink-0" /> : <XCircle size={12} className="text-rose-400 shrink-0" />}
                        <span className="text-slate-300 flex-1 truncate">{s.label}</span>
                        <span className="font-mono text-[10px] text-slate-500 shrink-0">{s.ms} ms</span>
                      </div>
                    ))}
                  </div>
                </Callout>
              </Panel>
            )}
          </>
        )}

        {/* ============================ FIELD MAPPING ============================ */}
        {tab === 'Field Mapping' && selected && (
          <Panel
            title={`Field mapping — ${selected.name}`}
            subtitle="Maps canonical platform fields onto this provider's response paths"
            icon={<Link2 size={14} className="text-cyan-400" />}
            actions={
              <div className="flex items-center gap-1.5">
                <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} options={providers.map((p) => ({ value: p.id, label: p.name }))} className="w-40" />
                <Button size="xs" variant="primary" disabled={!canConfigure} icon={<Plus size={11} />} onClick={() => setMappingModal(true)}>Add mapping</Button>
              </div>
            }
          >
            {selected.fieldMappings.length === 0 ? (
              <EmptyState title="No mappings defined" description="Add a mapping to translate this gateway's response into platform fields." />
            ) : (
              <ResponsiveTable
                dense
                rowKey={(m) => m.id}
                rows={selected.fieldMappings}
                columns={[
                  { key: 'platform', header: 'Platform field', render: (m) => <span className="font-mono text-[10px] text-cyan-300">{m.platformField}</span>, mobilePrimary: true, sortValue: (m) => m.platformField },
                  { key: 'provider', header: 'Provider path', render: (m) => <span className="font-mono text-[10px] text-emerald-300 break-all">{m.providerField}</span>, sortValue: (m) => m.providerField },
                  { key: 'type', header: 'Type', render: (m) => <Badge tone="neutral">{m.type}</Badge>, sortValue: (m) => m.type },
                  { key: 'transform', header: 'Transform', render: (m) => <span className="font-mono text-[10px] text-slate-400">{m.transform}</span>, sortValue: (m) => m.transform },
                  { key: 'required', header: 'Required', render: (m) => (m.required ? <Badge tone="warning">Required</Badge> : <Badge tone="neutral">Optional</Badge>), align: 'center', sortValue: (m) => (m.required ? 1 : 0) },
                  { key: 'default', header: 'Default', render: (m) => <span className="text-[10px] text-slate-500">{m.defaultValue ?? '—'}</span>, className: 'hidden lg:table-cell' },
                  { key: 'notes', header: 'Notes', render: (m) => <span className="text-[10px] text-slate-500 line-clamp-1">{m.notes ?? '—'}</span>, className: 'hidden xl:table-cell' },
                  {
                    key: 'actions',
                    header: '',
                    align: 'right',
                    render: (m) => (
                      <Button
                        size="xs"
                        variant="danger"
                        disabled={!canConfigure}
                        icon={<Trash2 size={11} />}
                        onClick={async () => {
                          await updateProviderConfig(selected.id, { fieldMappings: selected.fieldMappings.filter((x) => x.id !== m.id) });
                          pushToast({ title: 'Mapping removed', description: m.platformField, type: 'info' });
                        }}
                      />
                    ),
                    renderMobile: (m) => (
                      <Button size="xs" variant="danger" disabled={!canConfigure} icon={<Trash2 size={11} />} onClick={async () => { await updateProviderConfig(selected.id, { fieldMappings: selected.fieldMappings.filter((x) => x.id !== m.id) }); }}>
                        Remove
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </Panel>
        )}

        {/* ============================== API KEYS ============================== */}
        {tab === 'API Keys' && (
          <Panel
            title="API keys"
            subtitle={`${apiKeys.filter((k) => k.status === 'active').length} active of ${apiKeys.length} issued`}
            icon={<KeyRound size={14} className="text-cyan-400" />}
            actions={<Button size="xs" variant="primary" disabled={!can('apikeys.manage')} icon={<Plus size={11} />} onClick={() => setKeyModal(true)}>Issue key</Button>}
          >
            {!can('apikeys.manage') && (
              <Callout tone="warning" title="Restricted">Only Admins and the Super Admin can issue or revoke API keys.</Callout>
            )}
            <ResponsiveTable columns={keyCols} rows={apiKeys} rowKey={(k) => k.id} dense emptyTitle="No API keys" initialSort={{ key: 'created', dir: 'desc' }} />
          </Panel>
        )}

        {/* ============================ REQUEST LOGS ============================ */}
        {tab === 'Request Logs' && (
          <Panel
            title="Gateway request logs"
            subtitle={`${filteredLogs.length} record(s)${selected ? ` for ${selected.name}` : ''}`}
            icon={<ScrollText size={14} className="text-cyan-400" />}
            actions={
              <div className="flex flex-wrap items-center gap-1.5">
                <Select
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value as typeof logFilter)}
                  options={[
                    { value: 'all', label: 'All statuses' },
                    { value: 'success', label: 'Success' },
                    { value: 'error', label: 'Error' },
                    { value: 'timeout', label: 'Timeout' },
                    { value: 'rejected', label: 'Rejected' },
                  ]}
                  className="w-32"
                />
                <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} options={[{ value: '', label: 'All gateways' }, ...providers.map((p) => ({ value: p.id, label: p.name }))]} className="w-40" />
                <Button size="xs" variant="secondary" icon={<Gauge size={11} />} onClick={() => { downloadText(toCsv(filteredLogs.map((l) => ({ ...l })) as unknown as Record<string, unknown>[]), 'provider_request_logs.csv', 'text/csv;charset=utf-8'); pushToast({ title: 'Logs exported', type: 'success' }); }}>CSV</Button>
              </div>
            }
          >
            <ResponsiveTable columns={logCols} rows={filteredLogs.slice(0, 200)} rowKey={(l) => l.id} dense initialSort={{ key: 'at', dir: 'desc' }} maxHeight="520px" emptyTitle="No requests logged" />
          </Panel>
        )}

        {/* ============================ USAGE & COST ============================ */}
        {tab === 'Usage & Cost' && (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Total calls', value: usage.reduce((a, u) => a + u.calls, 0).toLocaleString('en-KE') },
                { label: 'Success rate', value: `${(usage.reduce((a, u) => a + u.successes, 0) / Math.max(1, usage.reduce((a, u) => a + u.calls, 0)) * 100).toFixed(1)}%` },
                { label: 'Provider spend', value: KES(usage.reduce((a, u) => a + u.costKes, 0), { decimals: false }) },
                { label: 'Errors', value: usage.reduce((a, u) => a + u.errors, 0).toLocaleString('en-KE') },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-sky-900/50 bg-[#061020] p-3">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{k.label}</div>
                  <div className="text-lg font-black text-white font-mono mt-0.5">{k.value}</div>
                </div>
              ))}
            </div>

            <Panel title="Usage & cost per gateway" subtitle="Quota consumption, success rate and spend" icon={<Gauge size={14} className="text-cyan-400" />}>
              <ResponsiveTable
                dense
                rowKey={(u) => u.providerId}
                rows={usage}
                initialSort={{ key: 'cost', dir: 'desc' }}
                columns={[
                  {
                    key: 'name',
                    header: 'Gateway',
                    mobilePrimary: true,
                    render: (u) => (
                      <span className="flex items-center gap-2 min-w-0">
                        <Logo code={u.name} size={16} />
                        <span className="text-[11px] font-semibold text-white truncate">{u.name}</span>
                      </span>
                    ),
                    sortValue: (u) => u.name,
                  },
                  { key: 'calls', header: 'Calls', render: (u) => <span className="font-mono">{u.calls}</span>, align: 'right', sortValue: (u) => u.calls },
                  { key: 'success', header: 'Success', render: (u) => <span className="font-mono text-emerald-300">{u.successes}</span>, align: 'right', className: 'hidden sm:table-cell', sortValue: (u) => u.successes },
                  { key: 'errors', header: 'Errors', render: (u) => <span className={`font-mono ${u.errors > 0 ? 'text-rose-300' : 'text-slate-600'}`}>{u.errors}</span>, align: 'right', sortValue: (u) => u.errors },
                  {
                    key: 'rate',
                    header: 'Success rate',
                    render: (u) => (
                      <span className="flex items-center gap-2 min-w-[110px]">
                        <ProgressBar value={u.successRatePct} max={100} height={5} className="flex-1" warning={95} />
                        <span className="text-[10px] font-mono text-slate-400 w-10 text-right">{u.successRatePct.toFixed(1)}%</span>
                      </span>
                    ),
                    sortValue: (u) => u.successRatePct,
                  },
                  { key: 'latency', header: 'Avg latency', render: (u) => <span className="font-mono">{u.avgLatencyMs} ms</span>, align: 'right', className: 'hidden lg:table-cell', sortValue: (u) => u.avgLatencyMs },
                  {
                    key: 'quota',
                    header: 'Quota',
                    render: (u) => (
                      <span className="flex items-center gap-2 min-w-[110px]">
                        <ProgressBar value={u.quotaUsed} max={Math.max(1, u.quotaTotal)} height={5} className="flex-1" warning={0.75} danger={0.9} />
                        <span className="text-[9px] font-mono text-slate-500 w-16 text-right">{u.quotaUsed}/{u.quotaTotal}</span>
                      </span>
                    ),
                    className: 'hidden sm:table-cell',
                    sortValue: (u) => u.quotaTotal ? u.quotaUsed / u.quotaTotal : 0,
                  },
                  { key: 'cost', header: 'Spend', render: (u) => <span className="font-mono text-emerald-300">{KES(u.costKes, { decimals: false })}</span>, align: 'right', sortValue: (u) => u.costKes },
                ]}
              />
            </Panel>

            {usage.some((u) => u.quotaTotal > 0 && u.quotaUsed / u.quotaTotal > 0.8) && (
              <Callout tone="warning" title="Quota threshold approaching">
                One or more gateways are past 80% of their included monthly quota. Overage rates will apply — see the commercial
                terms in the Configuration tab.
              </Callout>
            )}
          </>
        )}
      </div>

      {/* --------------------------- issue key modal --------------------------- */}
      <Modal
        open={keyModal}
        onClose={() => setKeyModal(false)}
        title={<span className="flex items-center gap-2"><KeyRound size={15} className="text-cyan-400" /> Issue API key</span>}
        subtitle="Live keys can only be issued by an Admin or Super Admin"
        footer={
          <>
            <Button variant="ghost" onClick={() => setKeyModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={<Plus size={13} />}
              onClick={() => {
                if (!newKey.label.trim()) {
                  pushToast({ title: 'Label required', description: 'Give the key a recognisable name', type: 'error' });
                  return;
                }
                const res = createApiKey({ label: newKey.label.trim(), scopes: newKey.scopes, providerId: selectedId || undefined, environment: newKey.environment });
                if (res.ok && res.key && res.secret) {
                  setIssuedKey({ key: res.key, secret: res.secret });
                  setKeyModal(false);
                  setNewKey({ label: '', scopes: [], environment: 'sandbox' });
                } else if (res.message) {
                  pushToast({ title: 'Rejected', description: res.message, type: 'error' });
                }
              }}
            >
              Issue key
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Label" required><TextInput value={newKey.label} onChange={(e) => setNewKey({ ...newKey, label: e.target.value })} placeholder="Production backend — KYC" /></Field>
          <Field label="Environment">
            <Select
              value={newKey.environment}
              onChange={(e) => setNewKey({ ...newKey, environment: e.target.value as 'sandbox' | 'live' })}
              options={[{ value: 'sandbox', label: 'Sandbox' }, { value: 'live', label: 'Live (admin+ only)' }]}
            />
          </Field>
          <Field label="Scope to gateway" hint="Leave on all gateways for a platform-wide key">
            <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} options={[{ value: '', label: 'All gateways' }, ...providers.map((p) => ({ value: p.id, label: p.name }))]} />
          </Field>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Scopes</div>
            <div className="flex flex-wrap gap-1.5">
              {['verify:read', 'verify:write', 'wallet:read', 'wallet:write', 'providers:read', 'admin:read'].map((s) => {
                const on = newKey.scopes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewKey({ ...newKey, scopes: on ? newKey.scopes.filter((x) => x !== s) : [...newKey.scopes, s] })}
                    className={`px-2 py-1 rounded-lg border font-mono text-[10px] transition-colors ${on ? 'border-cyan-600/70 bg-cyan-950/40 text-cyan-200' : 'border-sky-900/60 bg-[#061020] text-slate-500 hover:text-white'}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          {newKey.environment === 'live' && (
            <Callout tone="danger" title="Live credential">
              A live key can move money and return unmasked PII. It is recorded in the audit log with your identity.
            </Callout>
          )}
        </div>
      </Modal>

      {/* --------------------------- issued key modal --------------------------- */}
      <Modal
        open={Boolean(issuedKey)}
        onClose={() => setIssuedKey(null)}
        title={<span className="flex items-center gap-2"><KeyRound size={15} className="text-emerald-400" /> Key issued</span>}
        size="sm"
        footer={<Button variant="primary" onClick={() => setIssuedKey(null)}>Done</Button>}
      >
        {issuedKey && (
          <div className="space-y-2">
            <Callout tone="warning" title="Copy this now">
              The secret is shown once. Everywhere else it appears as {issuedKey.key.secretMasked}.
            </Callout>
            <div className="rounded-lg bg-[#050b14] border border-emerald-900/50 px-3 py-2 font-mono text-[11px] text-emerald-300 select-all break-all">
              {issuedKey.secret}
            </div>
            <div className="text-[10px] text-slate-500">
              Prefix <span className="font-mono text-slate-300">{issuedKey.key.prefix}</span> · {issuedKey.key.environment} ·{' '}
              {issuedKey.key.scopes.join(', ')}
            </div>
          </div>
        )}
      </Modal>

      {/* --------------------------- add mapping modal --------------------------- */}
      <Modal
        open={mappingModal}
        onClose={() => setMappingModal(false)}
        title={<span className="flex items-center gap-2"><Link2 size={15} className="text-cyan-400" /> Add field mapping</span>}
        subtitle={selected?.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMappingModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={<Plus size={13} />}
              onClick={async () => {
                if (!selected) return;
                if (!newMapping.platformField.trim() || !newMapping.providerField.trim()) {
                  pushToast({ title: 'Both fields required', type: 'error' });
                  return;
                }
                await updateProviderConfig(selected.id, { fieldMappings: [...selected.fieldMappings, { ...newMapping, id: `fm-${Date.now().toString(36)}` }] });
                setMappingModal(false);
                setNewMapping({ platformField: '', providerField: '', type: 'string', required: false, transform: 'none', defaultValue: '', notes: '' });
              }}
            >
              Add mapping
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Platform field" required hint="e.g. subject.fullName"><TextInput value={newMapping.platformField} onChange={(e) => setNewMapping({ ...newMapping, platformField: e.target.value })} className="font-mono" /></Field>
          <Field label="Provider path" required hint="e.g. data.citizen.first_name"><TextInput value={newMapping.providerField} onChange={(e) => setNewMapping({ ...newMapping, providerField: e.target.value })} className="font-mono" /></Field>
          <Field label="Type">
            <Select value={newMapping.type} onChange={(e) => setNewMapping({ ...newMapping, type: e.target.value as ProviderFieldMapping['type'] })} options={['string', 'number', 'boolean', 'date', 'enum'].map((t) => ({ value: t, label: t }))} />
          </Field>
          <Field label="Transform">
            <Select value={newMapping.transform} onChange={(e) => setNewMapping({ ...newMapping, transform: e.target.value as ProviderFieldMapping['transform'] })} options={['none', 'uppercase', 'titlecase', 'mask', 'date-iso', 'phone-e164', 'to-kes'].map((t) => ({ value: t, label: t }))} />
          </Field>
          <Field label="Default value"><TextInput value={newMapping.defaultValue ?? ''} onChange={(e) => setNewMapping({ ...newMapping, defaultValue: e.target.value })} /></Field>
          <Field label="Notes"><TextInput value={newMapping.notes ?? ''} onChange={(e) => setNewMapping({ ...newMapping, notes: e.target.value })} /></Field>
          <div className="sm:col-span-2">
            <Toggle checked={newMapping.required} onChange={(v) => setNewMapping({ ...newMapping, required: v })} label="Required field" description="A missing required field marks the section as `partial`" />
          </div>
        </div>
      </Modal>

      {testingProviderId && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-[#071120] border border-cyan-800/60 px-3 py-2 shadow-xl text-[11px] text-cyan-200">
          <Loader2 size={13} className="animate-spin" /> Testing {providers.find((p) => p.id === testingProviderId)?.name}…
        </div>
      )}
      {can('providers.view') && (
        <div className="px-2 sm:px-4 pb-4">
          <SpinModuleCatalogue />
        </div>
      )}
      {!can('providers.view') && (
        <div className="p-4">
          <Callout tone="danger" title="Access denied" icon={<AlertTriangle size={14} />}>
            Your role does not include provider visibility.
          </Callout>
        </div>
      )}
    </div>
  );
};

const Group: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mt-4 first:mt-0">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-400/80">{label}</span>
      <span className="flex-1 h-px bg-sky-900/50" />
    </div>
    {children}
  </div>
);

/**
 * Spin Mobile (Kenya) module catalogue — transcribed from docs.spinmobile.co.
 * Shown in Provider Management so operators can see exactly which SuperCrunch
 * search_type, endpoint and payload shape each verification maps to.
 */
const SpinModuleCatalogue: React.FC = () => (
  <Panel
    title="Spin Mobile Kenya — SuperCrunch module catalogue"
    subtitle="Transcribed from docs.spinmobile.co · auth: POST /analytics/auth/ (consumer key + secret → ~10 min bearer token)"
    icon={<Server size={14} className="text-cyan-400" />}
  >
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-[10px] min-w-[720px]">
        <thead>
          <tr className="text-left text-slate-500 border-b border-sky-900/60">
            <th className="py-1.5 pr-2 font-semibold">Module</th>
            <th className="py-1.5 pr-2 font-semibold">search_type</th>
            <th className="py-1.5 pr-2 font-semibold">Endpoint</th>
            <th className="py-1.5 pr-2 font-semibold">Identifier</th>
            <th className="py-1.5 pr-2 font-semibold">Returns</th>
            <th className="py-1.5 font-semibold">Priced as</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sky-950/60">
          {SPIN_MODULES.map((m) => (
            <tr key={m.id} className="align-top">
              <td className="py-1.5 pr-2">
                <span className="block font-semibold text-slate-200">{m.name}</span>
                <span className="block text-slate-600">{m.section}</span>
              </td>
              <td className="py-1.5 pr-2 font-mono text-cyan-300">{m.searchType}</td>
              <td className="py-1.5 pr-2 font-mono text-slate-400">{m.endpoint ?? <span className="text-slate-600 italic">per onboarding</span>}</td>
              <td className="py-1.5 pr-2 text-slate-400">{m.identifierLabel}</td>
              <td className="py-1.5 pr-2 text-slate-500 max-w-[240px]">
                {m.responseFields.length ? m.responseFields.slice(0, 3).map((f) => f.name).join(' · ') + (m.responseFields.length > 3 ? ' …' : '') : <span className="italic">see docs</span>}
                {m.fidelity === 'section-only' && <span className="block text-amber-500/80 mt-0.5">section-only fidelity</span>}
              </td>
              <td className="py-1.5 font-mono text-slate-500">{m.pricedItemId ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p className="mt-3 text-[10px] text-slate-600 leading-relaxed">
      Every search shares one body shape: <code className="font-mono text-slate-400">{`{ search_type, identifier, consent, consent_collected_by }`}</code> (M-PESA KYC adds
      <code className="font-mono text-slate-400"> phone_number</code>; Metropol Full uses <code className="font-mono text-slate-400">identity_number</code> + identifier-as-type).
      Responses arrive in one of two envelopes: <code className="font-mono text-slate-400">{`{ code: "200.001", data }`}</code> (analytics) or{' '}
      <code className="font-mono text-slate-400">{`{ response_code: "200", success, message, data }`}</code> (verification). Sandbox and production share one base URL — only the
      keys differ. The live adapter engages when <code className="font-mono text-slate-400">SPIN_CONSUMER_KEY/SECRET</code> are set; health reports the mode.
    </p>
  </Panel>
);

export default Screen10_ProviderManagement;