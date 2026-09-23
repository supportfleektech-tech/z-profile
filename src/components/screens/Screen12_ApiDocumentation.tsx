import React, { useMemo, useState } from 'react';
import { Code2, Copy, Check, Key, Terminal, Server, ShieldCheck, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { Badge, Button, Callout, EmptyState, Modal, Panel, ResponsiveTable, TextInput, Field, type Column } from '../ui';
import { formatDate, timeAgo } from '../../lib/format';
import { TIER_META } from '../../auth/permissions';
import type { ApiKeyRecord } from '../../types';

type Tab = 'Overview' | 'Authentication' | 'Endpoints' | 'Keys' | 'Examples';

const SCOPES = ['verify:read', 'report:read', 'wallet:debit', 'providers:read', 'admin:users'];

/**
 * The endpoints the REAL scaffold backend serves (`server/index.mjs`).
 *
 * The previous version of this screen documented a fictional `api.iprs.co.ke/v1`
 * surface and rendered identical markup for every tab. This lists what actually
 * exists, so the docs and the running service cannot drift apart.
 */
const ENDPOINTS: { group: string; method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; desc: string; guard?: string }[] = [
  { group: 'Platform', method: 'GET', path: '/api/health', desc: 'Liveness, node version, storage engine, row counts' },
  { group: 'Platform', method: 'GET', path: '/api', desc: 'Machine-readable endpoint index' },

  { group: 'Auth', method: 'POST', path: '/api/auth/login', desc: 'Credential check, lockout policy, session creation', guard: 'public' },
  { group: 'Auth', method: 'POST', path: '/api/auth/logout', desc: 'Close the current session', guard: 'actor' },
  { group: 'Auth', method: 'GET', path: '/api/auth/me', desc: 'Resolve the acting account', guard: 'actor' },

  { group: 'Users', method: 'GET', path: '/api/users', desc: 'All accounts (credentials redacted)', guard: 'actor' },
  { group: 'Users', method: 'POST', path: '/api/users', desc: 'Create an account — super_admin is refused, admin needs super_admin', guard: 'tier' },
  { group: 'Users', method: 'PATCH', path: '/api/users/:id', desc: 'Update account, tier, overrides', guard: 'tier' },
  { group: 'Users', method: 'DELETE', path: '/api/users/:id', desc: 'Remove an account — seeded system accounts are immutable', guard: 'tier' },
  { group: 'Users', method: 'POST', path: '/api/users/:id/reset-password', desc: 'Issue a one-time temporary password', guard: 'actor' },

  { group: 'Wallet', method: 'GET', path: '/api/wallet', desc: 'One wallet by ?userId=, or all wallets', guard: 'actor' },
  { group: 'Wallet', method: 'GET', path: '/api/wallet/transactions', desc: 'Ledger, newest first', guard: 'actor' },
  { group: 'Wallet', method: 'PATCH', path: '/api/wallet/:id', desc: 'Auto top-up, alert threshold, overdraft', guard: 'actor' },

  { group: 'M-PESA', method: 'POST', path: '/api/wallet/topup/mpesa/stk', desc: 'Daraja STK Push dispatch → CheckoutRequestID', guard: 'actor' },
  { group: 'M-PESA', method: 'GET', path: '/api/wallet/topup/mpesa/stk/:id', desc: 'Poll the handset outcome (pending | settled)' },
  { group: 'M-PESA', method: 'POST', path: '/api/wallet/topup/mpesa/confirm', desc: 'Settle a dispatched STK into the wallet' },
  { group: 'M-PESA', method: 'POST', path: '/api/wallet/topup/mpesa/cancel', desc: 'Customer pressed cancel on the handset' },
  { group: 'M-PESA', method: 'POST', path: '/api/wallet/topup/mpesa/callback', desc: 'Daraja webhook shape (stkCallback)', guard: 'webhook' },

  { group: 'Card', method: 'POST', path: '/api/wallet/topup/card', desc: 'Create a payment intent (Luhn + expiry validated)' },
  { group: 'Card', method: 'POST', path: '/api/wallet/topup/card/confirm', desc: '3-D Secure confirm; OTP 000000 always declines' },

  { group: 'Payments', method: 'GET', path: '/api/payments', desc: 'Filter by userId, status, channel, from, to', guard: 'actor' },
  { group: 'Payments', method: 'GET', path: '/api/payments/stats', desc: 'Gross, net, fees, float, channel split', guard: 'actor' },
  { group: 'Payments', method: 'POST', path: '/api/payments/:id/refund', desc: 'Refund + wallet reversal; 409 if already refunded', guard: 'actor' },
  { group: 'Payments', method: 'POST', path: '/api/payments/:id/retry', desc: 'Retry a failed capture', guard: 'actor' },

  { group: 'Providers', method: 'GET', path: '/api/providers', desc: 'Registry with connection + commercial config', guard: 'actor' },
  { group: 'Providers', method: 'PATCH', path: '/api/providers/:id', desc: 'Update credentials, timeouts, retries, mappings', guard: 'actor' },
  { group: 'Providers', method: 'POST', path: '/api/providers/:id/test', desc: '5-stage handshake: DNS → TLS → OAuth → schema → rate limit', guard: 'actor' },
  { group: 'Providers', method: 'GET', path: '/api/providers/:id/logs', desc: 'Request/response traffic for one gateway', guard: 'actor' },

  { group: 'Settings', method: 'GET', path: '/api/settings', desc: 'All nine configuration groups', guard: 'actor' },
  { group: 'Settings', method: 'PATCH', path: '/api/settings/:group', desc: 'Patch one group; 404 on unknown group', guard: 'tier' },
  { group: 'Settings', method: 'POST', path: '/api/settings/maintenance', desc: 'Maintenance switch — super_admin only', guard: 'super_admin' },
  { group: 'Settings', method: 'POST', path: '/api/settings/import', desc: 'Bulk import a configuration snapshot', guard: 'super_admin' },

  { group: 'Governance', method: 'GET', path: '/api/audit', desc: 'Append-only trail; filter severity/tier/action/q', guard: 'actor' },
  { group: 'Governance', method: 'GET', path: '/api/sessions', desc: 'Live sessions across the platform', guard: 'actor' },
  { group: 'Governance', method: 'DELETE', path: '/api/sessions/:id', desc: 'Revoke a session', guard: 'actor' },
  { group: 'Governance', method: 'GET', path: '/api/pricing', desc: 'Batch 0–500 catalogue', guard: 'actor' },
  { group: 'Governance', method: 'PATCH', path: '/api/pricing', desc: 'Adjust rates / confirmation flag', guard: 'actor' },
];

const methodTone = (m: string): 'success' | 'info' | 'warning' | 'danger' =>
  m === 'GET' ? 'info' : m === 'POST' ? 'success' : m === 'PATCH' ? 'warning' : 'danger';

export const Screen12_ApiDocumentation: React.FC = () => {
  const { pushToast, apiMode, apiKeys, createApiKey, revokeApiKey, can, currentUser, settings } = useAppData();
  const [tab, setTab] = useState<Tab>('Overview');
  const [copied, setCopied] = useState<string | null>(null);
  const [group, setGroup] = useState('All');
  const [showIssue, setShowIssue] = useState(false);
  const [issuedSecret, setIssuedSecret] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', environment: 'sandbox' as 'sandbox' | 'live', scopes: ['verify:read'] as string[] });

  /** `apiRateLimitPerMin` is per-tier; show the acting account's own ceiling. */
  const rateLimitLabel = useMemo(() => {
    const mine = settings.platform.apiRateLimitPerMin.find((r) => r.tier === currentUser?.tier);
    return `${mine?.limit ?? settings.platform.apiRateLimitPerMin[0]?.limit ?? 120}/min`;
  }, [settings.platform.apiRateLimitPerMin, currentUser?.tier]);

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const baseUrl = apiMode === 'api' ? `${origin}/api` : 'https://api.iprs.co.ke/v1';

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      /* clipboard unavailable — the toast still shows the value */
    }
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
    pushToast({ title: 'Copied to clipboard', description: text.slice(0, 64), type: 'success' });
  };

  const groups = useMemo(() => ['All', ...[...new Set(ENDPOINTS.map((e) => e.group))]], []);
  const shown = group === 'All' ? ENDPOINTS : ENDPOINTS.filter((e) => e.group === group);

  const keyCols: Column<ApiKeyRecord>[] = [
    {
      key: 'label',
      header: 'Key',
      mobilePrimary: true,
      render: (k) => (
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-white truncate">{k.label}</div>
          <div className="text-[10px] text-slate-500 font-mono truncate">{k.prefix}… {k.secretMasked}</div>
        </div>
      ),
      sortValue: (k) => k.label,
    },
    { key: 'env', header: 'Env', render: (k) => <Badge tone={k.environment === 'live' ? 'danger' : 'info'}>{k.environment}</Badge>, sortValue: (k) => k.environment },
    {
      key: 'scopes',
      header: 'Scopes',
      render: (k) => (
        <div className="flex flex-wrap gap-1">
          {k.scopes.map((s) => (
            <span key={s} className="px-1.5 py-0.5 rounded border border-sky-900/60 bg-sky-950/40 text-[9px] font-mono text-cyan-300">{s}</span>
          ))}
        </div>
      ),
      className: 'hidden lg:table-cell',
    },
    { key: 'status', header: 'Status', render: (k) => <Badge tone={k.status === 'active' ? 'success' : 'neutral'} dot>{k.status}</Badge>, sortValue: (k) => k.status },
    { key: 'last', header: 'Last used', render: (k) => <span className="text-[10px] text-slate-500">{k.lastUsedAt ? timeAgo(k.lastUsedAt) : 'never'}</span>, className: 'hidden sm:table-cell', sortValue: (k) => k.lastUsedAt ?? '' },
    { key: 'expires', header: 'Expires', render: (k) => <span className="text-[10px] text-slate-500">{k.expiresAt ? formatDate(k.expiresAt) : '—'}</span>, className: 'hidden xl:table-cell', sortValue: (k) => k.expiresAt ?? '' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (k) => (
        <Button
          size="xs"
          variant="danger"
          disabled={k.status === 'revoked' || !can('apikeys.manage')}
          icon={<Trash2 size={11} />}
          onClick={() => {
            const r = revokeApiKey(k.id);
            pushToast({ title: r.ok ? 'Key revoked' : 'Cannot revoke', description: r.message ?? k.label, type: r.ok ? 'success' : 'error' });
          }}
        >
          <span className="hidden sm:inline">Revoke</span>
        </Button>
      ),
    },
  ];

  const issue = () => {
    const r = createApiKey({ label: form.label, scopes: form.scopes, environment: form.environment });
    if (!r.ok) {
      pushToast({ title: 'Cannot issue key', description: r.message ?? 'Rejected', type: 'error' });
      return;
    }
    setIssuedSecret(r.secret ?? null);
    setShowIssue(false);
    setForm({ label: '', environment: 'sandbox', scopes: ['verify:read'] });
    pushToast({ title: 'API key issued', description: r.key?.label, type: 'success' });
  };

  const curl = `curl -X POST ${baseUrl}/wallet/topup/mpesa/stk \\
  -H "Authorization: Bearer iprs_live_••••••••" \\
  -H "x-user-id: ${currentUser?.id ?? 'u-analyst'}" \\
  -H "Content-Type: application/json" \\
  -d '{"userId":"${currentUser?.id ?? 'u-analyst'}","phone":"0712345678","amount":5000}'`;

  return (
    <div className="w-full text-xs text-slate-200 space-y-4">
      <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-[#08172b] to-[#071120] border border-sky-900/40 rounded-xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Code2 size={16} className="text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white">API documentation</h2>
            <p className="text-[10px] text-slate-500 truncate">
              {ENDPOINTS.length} endpoints · {apiKeys.filter((k) => k.status === 'active').length} active keys · rate limit{' '}
              {rateLimitLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={apiMode === 'api' ? 'success' : 'warning'} dot>
            {apiMode === 'api' ? 'Backend live' : 'Local adapter'}
          </Badge>
          <span className="text-[10px] text-cyan-400 font-mono bg-sky-950/60 px-2 py-0.5 rounded border border-sky-900/60">v1.4.2 REST</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(['Overview', 'Authentication', 'Endpoints', 'Keys', 'Examples'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap border ${
              tab === t
                ? 'bg-sky-600 text-white font-semibold border-sky-500'
                : 'text-slate-400 hover:text-slate-200 hover:bg-sky-950/40 border-sky-900/50'
            }`}
          >
            {t}
            {t === 'Keys' && <span className="ml-1.5 font-mono text-[9px] opacity-70">{apiKeys.length}</span>}
          </button>
        ))}
      </div>

      {/* -------------------------------- OVERVIEW ------------------------------- */}
      {tab === 'Overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Base URL" icon={<Server size={14} className="text-cyan-400" />} className="lg:col-span-2">
            <div className="flex items-center justify-between gap-2 bg-[#050b14] px-3 py-2.5 rounded-lg border border-sky-900/60 font-mono text-[11px] text-cyan-300">
              <span className="truncate">{baseUrl}</span>
              <Button size="xs" variant="ghost" icon={copied === 'base' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />} onClick={() => copy(baseUrl, 'base')}>
                {copied === 'base' ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="mt-3 space-y-2 text-[11px] text-slate-400 leading-relaxed">
              <p>
                The demo ships two interchangeable adapters behind one typed contract. With{' '}
                <code className="font-mono text-cyan-300">npm run server</code> running, the Vite dev server proxies{' '}
                <code className="font-mono text-cyan-300">/api</code> to an Express + <code className="font-mono text-cyan-300">node:sqlite</code>{' '}
                backend on port 8787 and the header chip reads <strong className="text-emerald-300">API</strong>.
              </p>
              <p>
                Stop the backend and the same service signatures are served by an in-browser mock adapter — the chip reads{' '}
                <strong className="text-amber-300">LOCAL</strong> and nothing in the UI breaks. A 4xx is treated as a business
                answer and never downgrades the session; only a network error or 5xx does.
              </p>
            </div>
          </Panel>

          <Panel title="Conventions" icon={<ShieldCheck size={14} className="text-emerald-400" />}>
            <ul className="space-y-1.5 text-[11px] text-slate-400">
              {[
                ['JSON everywhere', 'Requests and responses are application/json.'],
                ['Actor header', 'x-user-id identifies the acting account on guarded routes.'],
                ['Redaction', 'No response ever includes a password; secrets are masked.'],
                ['Business 4xx', '403 policy, 404 missing, 409 conflict — with a message.'],
                ['Audit side-effect', 'Every mutation appends to /api/audit.'],
                ['Idempotent reads', 'GETs are cache-safe and never mutate.'],
              ].map(([k, v]) => (
                <li key={k} className="flex gap-2">
                  <span className="text-cyan-500 shrink-0">▸</span>
                  <span><strong className="text-slate-200">{k}.</strong> {v}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="By the numbers" icon={<Terminal size={14} className="text-violet-400" />} className="lg:col-span-3">
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
              {[
                ['Endpoints', String(ENDPOINTS.length)],
                ['GET routes', String(ENDPOINTS.filter((e) => e.method === 'GET').length)],
                ['Mutations', String(ENDPOINTS.filter((e) => e.method !== 'GET').length)],
                ['Guarded', String(ENDPOINTS.filter((e) => e.guard).length)],
                ['Active keys', String(apiKeys.filter((k) => k.status === 'active').length)],
                ['Rate limit', rateLimitLabel],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-sky-900/50 bg-[#061020] px-2.5 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{k}</div>
                  <div className="text-base font-black text-white font-mono">{v}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* ------------------------------ AUTHENTICATION ----------------------------- */}
      {tab === 'Authentication' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Bearer token" icon={<Key size={14} className="text-amber-400" />}>
            <div className="bg-[#050b14] p-3 rounded-lg border border-sky-900/60 font-mono text-[10px] sm:text-[11px] text-slate-300 overflow-x-auto">
              <div className="text-slate-500">// Every request carries two headers:</div>
              <div className="text-cyan-300 font-semibold break-all mt-1">Authorization: Bearer <span className="text-amber-400">iprs_live_••••••••••••9c41</span></div>
              <div className="text-cyan-300 font-semibold break-all mt-1">x-user-id: <span className="text-emerald-400">{currentUser?.id ?? 'u-analyst'}</span></div>
            </div>
            <Callout tone="info" title="Two-layer identity" icon={<ShieldCheck size={13} />} className="mt-3">
              The bearer key authorises the <em>application</em>; <code className="font-mono">x-user-id</code> identifies the{' '}
              <em>acting account</em> so role rules (who may create an Admin, who may toggle maintenance) are enforced
              server-side, not just in the UI.
            </Callout>
          </Panel>

          <Panel title="Sign-in policy" icon={<ShieldCheck size={14} className="text-emerald-400" />}>
            <div className="space-y-2">
              {[
                ['Password policy', `${settings.security.passwordPolicy.minLength}+ chars, ${settings.security.passwordPolicy.requireUppercase ? 'upper' : ''}${settings.security.passwordPolicy.requireNumber ? '+number' : ''}${settings.security.passwordPolicy.requireSymbol ? '+symbol' : ''}`],
                ['Max failed attempts', String(settings.security.lockoutThreshold)],
                ['Lockout window', `${settings.security.lockoutDurationMin} minutes`],
                ['MFA required for', settings.security.mfaRequiredFor.map((t2) => TIER_META[t2].label).join(', ') || 'nobody'],
                ['Session timeout', `${settings.security.sessionTimeoutMin} min idle ${settings.security.idleTimeoutMin}`],
                ['IP allowlisting', settings.security.ipAllowlist.length ? `${settings.security.ipAllowlist.length} CIDR(s)` : 'disabled'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 border-b border-sky-950/60 pb-1.5 last:border-0">
                  <span className="text-[11px] text-slate-500">{k}</span>
                  <span className="text-[11px] text-slate-200 font-mono text-right">{v}</span>
                </div>
              ))}
            </div>
            <Callout tone="warning" title="Demo credential handling" icon={<AlertTriangle size={13} />} className="mt-3">
              Seeded accounts store a shared demo password so the login screen can offer one-click personas. A production
              deployment hashes credentials server-side and never returns them — this backend already strips{' '}
              <code className="font-mono">password</code> from every response.
            </Callout>
          </Panel>
        </div>
      )}

      {/* -------------------------------- ENDPOINTS ------------------------------- */}
      {tab === 'Endpoints' && (
        <Panel
          title="Endpoint reference"
          subtitle={`${shown.length} of ${ENDPOINTS.length} routes`}
          icon={<Terminal size={14} className="text-cyan-400" />}
          actions={
            <div className="flex flex-wrap gap-1.5">
              {groups.map((g) => (
                <button
                  key={g}
                  onClick={() => setGroup(g)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                    group === g ? 'bg-sky-600 text-white border-sky-500' : 'text-slate-400 border-sky-900/50 hover:text-slate-200'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          }
        >
          <div className="space-y-1.5">
            {shown.map((e) => (
              <div key={`${e.method}-${e.path}`} className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-lg border border-sky-950 bg-[#050b14] px-2.5 py-2 hover:border-sky-800 transition-colors">
                <Badge tone={methodTone(e.method)}>{e.method}</Badge>
                <button onClick={() => copy(`${e.method} ${baseUrl.replace(/\/api$/, '')}${e.path}`, e.path)} className="font-mono text-[10px] sm:text-[11px] text-cyan-300 hover:underline truncate text-left min-w-0 flex-1">
                  {e.path}
                </button>
                {e.guard && (
                  <Badge tone={e.guard === 'super_admin' ? 'warning' : e.guard === 'tier' ? 'accent' : e.guard === 'public' ? 'success' : 'neutral'}>
                    {e.guard}
                  </Badge>
                )}
                <span className="text-[10px] text-slate-500 w-full sm:w-auto sm:max-w-[46%] sm:text-right truncate">{e.desc}</span>
                <Button size="xs" variant="ghost" icon={copied === e.path ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />} onClick={() => copy(`${e.method} ${baseUrl.replace(/\/api$/, '')}${e.path}`, e.path)} />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ---------------------------------- KEYS ---------------------------------- */}
      {tab === 'Keys' && (
        <Panel
          title="API keys"
          subtitle="Issued credentials, scopes and rotation"
          icon={<Key size={14} className="text-amber-400" />}
          actions={
            <Button size="sm" variant="primary" icon={<Plus size={12} />} disabled={!can('apikeys.manage')} onClick={() => setShowIssue(true)}>
              Issue key
            </Button>
          }
        >
          {issuedSecret && (
            <Callout tone="success" title="Secret shown once" icon={<Key size={13} />} className="mb-3">
              <div className="font-mono text-[11px] break-all text-emerald-300">{issuedSecret}</div>
              <div className="mt-1.5 flex gap-2">
                <Button size="xs" variant="secondary" icon={<Copy size={11} />} onClick={() => copy(issuedSecret, 'secret')}>Copy secret</Button>
                <Button size="xs" variant="ghost" onClick={() => setIssuedSecret(null)}>Dismiss</Button>
              </div>
            </Callout>
          )}
          {apiKeys.length === 0 ? (
            <EmptyState title="No API keys issued" description="Issue a key to authenticate an external integration." />
          ) : (
            <ResponsiveTable columns={keyCols} rows={apiKeys} rowKey={(k) => k.id} dense initialSort={{ key: 'label', dir: 'asc' }} />
          )}
        </Panel>
      )}

      {/* --------------------------------- EXAMPLES -------------------------------- */}
      {tab === 'Examples' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="cURL — M-PESA STK Push" icon={<Terminal size={14} className="text-cyan-400" />}>
            <pre className="bg-[#050b14] p-3 rounded-lg border border-sky-900/60 text-[10px] text-slate-300 overflow-x-auto font-mono leading-relaxed whitespace-pre">{curl}</pre>
            <Button size="xs" variant="secondary" className="mt-2" icon={<Copy size={11} />} onClick={() => copy(curl, 'curl')}>
              {copied === 'curl' ? 'Copied' : 'Copy cURL'}
            </Button>
          </Panel>

          <Panel title="Response — 200 OK" icon={<Code2 size={14} className="text-emerald-400" />}>
            <pre className="bg-[#050b14] p-3 rounded-lg border border-sky-900/60 text-[10px] text-slate-300 overflow-x-auto font-mono leading-relaxed whitespace-pre">{`{
  "ok": true,
  "checkoutRequestID": "ws_CO_20260923035151_8626",
  "merchantRequestID": "29115-4821903-7",
  "phone": "254712345678",
  "amount": 5000
}`}</pre>
            <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">
              Poll <code className="font-mono text-cyan-300">GET /api/wallet/topup/mpesa/stk/:id</code> until it returns{' '}
              <code className="font-mono">settled</code>, then POST <code className="font-mono text-cyan-300">/confirm</code> to
              credit the wallet. In production Daraja posts the same shape to{' '}
              <code className="font-mono text-cyan-300">/callback</code>.
            </p>
          </Panel>

          <Panel title="Error contract" icon={<AlertTriangle size={14} className="text-rose-400" />} className="lg:col-span-2">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['400', 'Validation', '"Enter a valid Safaricom number, e.g. 0712 345 678."'],
                ['401', 'Unauthenticated', '"Not authenticated." — missing or unknown x-user-id'],
                ['403', 'Policy', '"Only a Super Admin can create Admin accounts."'],
                ['409', 'Conflict', '"That payment has already been refunded."'],
              ].map(([code, kind, msg]) => (
                <div key={code} className="rounded-lg border border-sky-900/50 bg-[#061020] p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-rose-300">{code}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{kind}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500 font-mono leading-snug break-words">{msg}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* ------------------------------ issue-key modal ---------------------------- */}
      <Modal open={showIssue} onClose={() => setShowIssue(false)} title="Issue an API key" icon={<Key size={15} className="text-amber-400" />}>
        <div className="space-y-3">
          <Field label="Label" hint="What integration is this for?">
            <TextInput value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Mobile app — production" autoFocus />
          </Field>
          <Field label="Environment">
            <div className="flex gap-2">
              {(['sandbox', 'live'] as const).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setForm({ ...form, environment: env })}
                  className={`flex-1 px-3 py-2 rounded-lg border text-[11px] font-semibold transition-colors ${
                    form.environment === env ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200' : 'border-sky-900/60 bg-[#050b14] text-slate-400'
                  }`}
                >
                  {env}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Scopes" hint="Least privilege — grant only what the integration calls.">
            <div className="flex flex-wrap gap-1.5">
              {SCOPES.map((s) => {
                const on = form.scopes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm({ ...form, scopes: on ? form.scopes.filter((x) => x !== s) : [...form.scopes, s] })}
                    className={`px-2 py-1 rounded-md border font-mono text-[10px] transition-colors ${
                      on ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300' : 'border-sky-900/60 bg-[#050b14] text-slate-500'
                    }`}
                  >
                    {on ? '✓ ' : ''}{s}
                  </button>
                );
              })}
            </div>
          </Field>
          {form.environment === 'live' && currentUser?.tier === 'user' && (
            <Callout tone="warning" title="Live keys need an Admin" icon={<AlertTriangle size={13} />}>
              Only an Admin or Super Admin can issue live-environment keys.
            </Callout>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShowIssue(false)}>Cancel</Button>
          <Button variant="primary" icon={<Key size={12} />} disabled={!form.label.trim() || form.scopes.length === 0} onClick={issue}>
            Issue key
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Screen12_ApiDocumentation;
