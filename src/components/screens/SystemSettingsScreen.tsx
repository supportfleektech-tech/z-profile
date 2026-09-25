import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Settings, Building2, Palette, ShieldCheck, Scale, Gauge, CreditCard, PlugZap, Cpu, Database,
  Save, RotateCcw, Download, Upload, AlertTriangle, Lock, CheckCircle2, Power, Terminal, Info,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import {
  Badge, Button, Callout, EmptyState, Field, Modal, Panel, ResponsiveTable, SearchInput,
  SegmentedControl, Select, TextArea, TextInput, Toggle,
} from '../ui';
import { SETTINGS_GROUPS } from '../../data/settings';
import { settingsService } from '../../services/settings.service';
import { downloadText } from '../../lib/format';
import { api } from '../../services/http';
import { TIER_META } from '../../auth/permissions';
import type { IprsBackup, RoleTier, SystemSettings } from '../../types';

type GroupKey = keyof SystemSettings;

const GROUP_ICONS: Record<GroupKey, React.ReactNode> = {
  org: <Building2 size={14} className="text-cyan-400" />,
  branding: <Palette size={14} className="text-violet-400" />,
  security: <ShieldCheck size={14} className="text-emerald-400" />,
  compliance: <Scale size={14} className="text-amber-400" />,
  risk: <Gauge size={14} className="text-rose-400" />,
  billing: <CreditCard size={14} className="text-emerald-400" />,
  integrations: <PlugZap size={14} className="text-cyan-400" />,
  platform: <Cpu size={14} className="text-violet-400" />,
  backup: <Database size={14} className="text-sky-400" />,
};

type FieldDef =
  | { kind: 'text'; key: string; label: string; hint?: string; mono?: boolean; secret?: boolean }
  | { kind: 'number'; key: string; label: string; hint?: string; min?: number; max?: number }
  | { kind: 'toggle'; key: string; label: string; description?: string }
  | { kind: 'select'; key: string; label: string; options: { value: string; label: string }[]; hint?: string }
  | { kind: 'list'; key: string; label: string; hint?: string }
  | { kind: 'textarea'; key: string; label: string; rows?: number; hint?: string };

const SCHEMA: Record<GroupKey, FieldDef[]> = {
  org: [
    { kind: 'text', key: 'legalName', label: 'Legal name' },
    { kind: 'text', key: 'tradingName', label: 'Trading name' },
    { kind: 'text', key: 'kraPin', label: 'KRA PIN', mono: true },
    { kind: 'text', key: 'registrationNo', label: 'Registration number', mono: true },
    { kind: 'text', key: 'address', label: 'Registered address' },
    { kind: 'text', key: 'city', label: 'City' },
    { kind: 'text', key: 'country', label: 'Country' },
    { kind: 'text', key: 'supportEmail', label: 'Support email', mono: true },
    { kind: 'text', key: 'supportPhone', label: 'Support phone', mono: true },
    { kind: 'text', key: 'website', label: 'Website', mono: true },
    { kind: 'text', key: 'timezone', label: 'Timezone', hint: 'IANA name, e.g. Africa/Nairobi' },
    { kind: 'text', key: 'locale', label: 'Locale' },
    { kind: 'text', key: 'fiscalYearStart', label: 'Fiscal year start' },
    { kind: 'text', key: 'businessHours', label: 'Business hours' },
  ],
  branding: [
    { kind: 'text', key: 'accentColor', label: 'Accent colour', mono: true, hint: 'Hex value used in generated PDFs' },
    { kind: 'text', key: 'loginHeadline', label: 'Login headline' },
    { kind: 'textarea', key: 'loginSubtext', label: 'Login subtext', rows: 2 },
    { kind: 'text', key: 'emailSenderName', label: 'Email sender name' },
    { kind: 'text', key: 'reportFooter', label: 'Report footer' },
    { kind: 'textarea', key: 'reportDisclaimer', label: 'Report disclaimer', rows: 4 },
    { kind: 'toggle', key: 'whiteLabel', label: 'White-label reports', description: 'Replaces IPRS branding on PDF covers with the trading name' },
  ],
  security: [
    { kind: 'number', key: 'passwordPolicy.minLength', label: 'Minimum password length', min: 6, max: 64 },
    { kind: 'toggle', key: 'passwordPolicy.requireUppercase', label: 'Require an uppercase letter' },
    { kind: 'toggle', key: 'passwordPolicy.requireLowercase', label: 'Require a lowercase letter' },
    { kind: 'toggle', key: 'passwordPolicy.requireNumber', label: 'Require a number' },
    { kind: 'toggle', key: 'passwordPolicy.requireSymbol', label: 'Require a symbol' },
    { kind: 'number', key: 'passwordPolicy.expiryDays', label: 'Password expiry (days)', min: 0, max: 365 },
    { kind: 'number', key: 'passwordPolicy.historyDepth', label: 'Password history depth', min: 0, max: 24 },
    { kind: 'toggle', key: 'passwordPolicy.breachCheck', label: 'Screen against breached-password lists' },
    { kind: 'select', key: 'mfaRequiredFor', label: 'MFA required for tiers', options: [] },
    { kind: 'number', key: 'sessionTimeoutMin', label: 'Session timeout (minutes)', min: 5, max: 720 },
    { kind: 'number', key: 'idleTimeoutMin', label: 'Idle timeout (minutes)', min: 1, max: 240 },
    { kind: 'number', key: 'maxConcurrentSessions', label: 'Max concurrent sessions per user', min: 1, max: 20 },
    { kind: 'number', key: 'lockoutThreshold', label: 'Lockout after failed attempts', min: 1, max: 20 },
    { kind: 'number', key: 'lockoutDurationMin', label: 'Lockout duration (minutes)', min: 1, max: 1440 },
    { kind: 'list', key: 'ipAllowlist', label: 'IP allowlist', hint: 'CIDR or single addresses — empty means any address' },
    { kind: 'list', key: 'ipDenylist', label: 'IP denylist' },
    { kind: 'toggle', key: 'geoFencingEnabled', label: 'Geo-fencing', description: 'Reject sign-ins from outside the allowed countries' },
    { kind: 'list', key: 'allowedCountries', label: 'Allowed countries', hint: 'ISO 3166-1 alpha-2 codes' },
    { kind: 'number', key: 'trustedDeviceMemoryDays', label: 'Trust this device for (days)', min: 0, max: 90 },
    { kind: 'toggle', key: 'captchaOnLogin', label: 'CAPTCHA on sign-in' },
  ],
  compliance: [
    { kind: 'text', key: 'framework', label: 'Compliance framework' },
    { kind: 'text', key: 'dpoName', label: 'Data Protection Officer' },
    { kind: 'text', key: 'dpoEmail', label: 'DPO email', mono: true },
    { kind: 'text', key: 'dpoPhone', label: 'DPO phone', mono: true },
    {
      kind: 'select',
      key: 'consentCapture',
      label: 'Consent capture model',
      options: [
        { value: 'explicit', label: 'Explicit — signed consent per subject' },
        { value: 'per-search', label: 'Per-search — checkbox on each query' },
        { value: 'implicit', label: 'Implicit — covered by contract' },
      ],
    },
    { kind: 'text', key: 'lawfulBasisRegister', label: 'Lawful basis register reference', mono: true },
    { kind: 'toggle', key: 'erasureWorkflowEnabled', label: 'Right-to-erasure workflow', description: 'Allows a subject to request deletion of their dossier' },
    { kind: 'toggle', key: 'crossBorderTransfer', label: 'Cross-border transfer permitted' },
    { kind: 'number', key: 'auditRetentionMonths', label: 'Audit log retention (months)', min: 1, max: 120 },
    { kind: 'textarea', key: 'purposeLimitationText', label: 'Purpose limitation statement', rows: 3 },
  ],
  risk: [
    { kind: 'number', key: 'lowThreshold', label: 'Low-risk ceiling (score)', min: 0, max: 100 },
    { kind: 'number', key: 'highThreshold', label: 'High-risk floor (score)', min: 0, max: 100 },
    { kind: 'number', key: 'minConfidenceToAutoApprove', label: 'Minimum confidence to auto-approve (%)', min: 0, max: 100 },
    { kind: 'toggle', key: 'manualReviewQueue', label: 'Manual review queue', description: 'Route flagged dossiers to an analyst instead of auto-deciding' },
    { kind: 'text', key: 'modelVersion', label: 'Scoring model version', mono: true },
  ],
  billing: [
    { kind: 'number', key: 'vatRatePct', label: 'VAT rate (%)', min: 0, max: 30 },
    { kind: 'text', key: 'invoicePrefix', label: 'Invoice prefix', mono: true },
    { kind: 'number', key: 'nextInvoiceNo', label: 'Next invoice number', min: 1 },
    { kind: 'text', key: 'mpesaShortcode', label: 'M-PESA shortcode / Paybill', mono: true },
    { kind: 'text', key: 'mpesaPasskey', label: 'M-PESA passkey', mono: true, secret: true },
    { kind: 'toggle', key: 'mpesaPaybill', label: 'Use Paybill (off = Till number)' },
    {
      kind: 'select',
      key: 'cardGateway',
      label: 'Card gateway',
      options: [
        { value: 'none', label: 'Disabled' },
        { value: 'IntaSend', label: 'IntaSend' },
        { value: 'Paystack', label: 'Paystack' },
        { value: 'Flutterwave', label: 'Flutterwave' },
        { value: 'Stripe', label: 'Stripe' },
        { value: 'Pesapal', label: 'Pesapal' },
      ],
    },
    { kind: 'text', key: 'cardPublicKey', label: 'Card gateway publishable key', mono: true, secret: true },
    { kind: 'number', key: 'walletMinTopUpKes', label: 'Minimum top-up (KES)', min: 0 },
    { kind: 'number', key: 'walletMaxTopUpKes', label: 'Maximum top-up (KES)', min: 0 },
    { kind: 'toggle', key: 'autoTopUpEnabled', label: 'Allow auto top-up' },
    { kind: 'number', key: 'lowBalanceAlertKes', label: 'Default low-balance alert (KES)', min: 0 },
    { kind: 'toggle', key: 'overdraftAllowed', label: 'Allow wallet overdraft' },
    { kind: 'toggle', key: 'blockSearchOnNegativeBalance', label: 'Block searches on negative balance' },
    { kind: 'number', key: 'creditTermsDays', label: 'Credit terms (days)', min: 0, max: 180 },
    { kind: 'number', key: 'discountPct', label: 'Volume discount (%)', min: 0, max: 50 },
  ],
  integrations: [
    { kind: 'text', key: 'smtpHost', label: 'SMTP host', mono: true },
    { kind: 'number', key: 'smtpPort', label: 'SMTP port', min: 1, max: 65535 },
    { kind: 'text', key: 'smtpUser', label: 'SMTP user', mono: true },
    { kind: 'text', key: 'smtpFrom', label: 'From address', mono: true },
    {
      kind: 'select',
      key: 'smsGateway',
      label: 'SMS gateway',
      options: [
        { value: 'Africa\'s Talking', label: "Africa's Talking" },
        { value: 'Safaricom Bulk SMS', label: 'Safaricom Bulk SMS' },
        { value: 'Twilio', label: 'Twilio' },
        { value: 'none', label: 'Disabled' },
      ],
    },
    { kind: 'text', key: 'smsApiKey', label: 'SMS API key', mono: true, secret: true },
    { kind: 'text', key: 'smsSender', label: 'SMS sender ID', mono: true },
    { kind: 'toggle', key: 'ssoEnabled', label: 'Single sign-on', description: 'Federate sign-in to the organisation identity provider' },
    {
      kind: 'select',
      key: 'ssoProtocol',
      label: 'SSO protocol',
      options: [
        { value: 'saml', label: 'SAML 2.0' },
        { value: 'oidc', label: 'OpenID Connect' },
      ],
    },
    { kind: 'text', key: 'ssoMetadataUrl', label: 'SSO metadata URL', mono: true },
    { kind: 'text', key: 'objectStorageBucket', label: 'Object storage bucket', mono: true },
    { kind: 'toggle', key: 'erpExportEnabled', label: 'ERP / accounting export' },
  ],
  platform: [
    {
      kind: 'select',
      key: 'environment',
      label: 'Environment',
      options: [
        { value: 'sandbox', label: 'Sandbox' },
        { value: 'production', label: 'Production' },
      ],
    },
    { kind: 'number', key: 'globalConcurrency', label: 'Global concurrency', min: 1, max: 500 },
    { kind: 'number', key: 'cacheTtlSec', label: 'Cache TTL (seconds)', min: 0, max: 86400 },
    { kind: 'number', key: 'workers', label: 'Worker processes', min: 1, max: 64 },
    {
      kind: 'select',
      key: 'logLevel',
      label: 'Log level',
      options: [
        { value: 'error', label: 'error' },
        { value: 'warn', label: 'warn' },
        { value: 'info', label: 'info' },
        { value: 'debug', label: 'debug' },
      ],
    },
    { kind: 'toggle', key: 'telemetryConsent', label: 'Anonymous product telemetry' },
    { kind: 'toggle', key: 'maintenanceMode', label: 'Maintenance mode', description: 'Blocks all sign-ins and searches for non-exempt tiers' },
    { kind: 'textarea', key: 'maintenanceMessage', label: 'Maintenance message', rows: 2 },
    { kind: 'select', key: 'maintenanceExemptTiers', label: 'Tiers exempt from maintenance', options: [] },
  ],
  backup: [
    {
      kind: 'select',
      key: 'snapshotSchedule',
      label: 'Snapshot schedule',
      options: [
        { value: 'hourly', label: 'Hourly' },
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
      ],
    },
    { kind: 'text', key: 'lastSnapshotAt', label: 'Last snapshot', mono: true },
    { kind: 'number', key: 'retentionCount', label: 'Snapshots retained', min: 1, max: 365 },
    { kind: 'toggle', key: 'encryptionAtRest', label: 'Encryption at rest', description: 'AES-256 on all stored records and snapshots' },
    { kind: 'toggle', key: 'offsiteReplication', label: 'Offsite replication' },
  ],
};

/** Read/write a dotted path on a settings group object. */
function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), obj);
}
function setPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.');
  const clone = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
  let cur = clone;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) cur[k] = value;
    else {
      if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k] as Record<string, unknown>;
    }
  });
  return clone as T;
}

/**
 * System Settings.
 *
 * Nine groups, each gated by its own permission: an Admin can run operations
 * (organisation, branding, billing, integrations) while security, compliance and platform
 * policy are Super Admin only. Every save is audited with a field-level diff.
 */
export const SystemSettingsScreen: React.FC = () => {
  const { settings, updateSettings, canEditSettingsGroup, settingsHealth, currentUser, pushToast, apiMode } = useAppData();
  const [group, setGroup] = useState<GroupKey>('org');
  const [draft, setDraft] = useState<unknown>(settings.org);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const restoreInput = useRef<HTMLInputElement>(null);

  const meta = SETTINGS_GROUPS.find((g) => g.key === group)!;
  const editable = canEditSettingsGroup(group);

  useEffect(() => {
    setDraft(settings[group]);
  }, [group, settings]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings[group]), [draft, settings, group]);

  const schema = SCHEMA[group];
  const filteredSchema = q.trim() ? schema.filter((f) => f.label.toLowerCase().includes(q.toLowerCase()) || f.key.toLowerCase().includes(q.toLowerCase())) : schema;

  const save = async () => {
    setSaving(true);
    const res = await updateSettings(group, draft as Partial<SystemSettings[typeof group]>);
    setSaving(false);
    if (res.ok) setDraft(settings[group]);
  };

  const exportBackup = async () => {
    if (apiMode !== 'api') {
      setBackupMessage('Backup export requires the Node + SQLite backend.');
      return;
    }
    setBackupBusy(true);
    setBackupMessage('');
    try {
      const backup = await api.get<IprsBackup>('/api/admin/backup');
      downloadText(JSON.stringify(backup, null, 2), 'iprs-backup.json', 'application/json');
      setBackupMessage('Backup downloaded. Sessions, in-flight STK intents, and credentials were excluded.');
    } catch {
      setBackupMessage('Backup export failed. Verify the backend and Super Admin access.');
    } finally {
      setBackupBusy(false);
    }
  };

  const restoreBackup = async (file: File) => {
    if (apiMode !== 'api') {
      setBackupMessage('Backup restore requires the Node + SQLite backend.');
      return;
    }
    setBackupBusy(true);
    setBackupMessage('');
    try {
      const payload = JSON.parse(await file.text()) as IprsBackup;
      await api.post('/api/admin/restore', payload);
      setBackupMessage('Backup restored transactionally. Current auth and callback secrets were preserved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backup restore failed.';
      setBackupMessage(message);
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <div className="w-full text-xs text-slate-200">
      <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-[#08172b] to-[#071120] border-b border-sky-900/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Settings size={16} className="text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white">System settings</h2>
            <p className="text-[10px] text-slate-500 truncate">
              {currentUser ? `${TIER_META[currentUser.tier].label} · ${settingsHealth.filter((h) => h.ok).length}/${settingsHealth.length} checks passing` : ''} · backend {apiMode === 'api' ? 'connected' : 'local adapter'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" icon={<Download size={12} />} onClick={() => { downloadText(settingsService.exportConfig(currentUser), 'iprs_system_config.json', 'application/json'); pushToast({ title: 'Configuration exported', description: 'Credentials are redacted in the export', type: 'success' }); }}>
            Export
          </Button>
          <Button size="sm" variant="secondary" icon={<Upload size={12} />} onClick={() => setImportOpen(true)} disabled={!canEditSettingsGroup('platform')}>
            Import
          </Button>
          {settings.platform.maintenanceMode && canEditSettingsGroup('platform') && (
            <Button size="sm" variant="danger" icon={<Power size={12} />} onClick={() => settingsService.toggleMaintenance(currentUser, false).then(() => pushToast({ title: 'Maintenance mode disabled', type: 'success' }))}>
              End maintenance
            </Button>
          )}
        </div>
      </div>

      {settings.platform.maintenanceMode && (
        <div className="px-3 sm:px-4 pt-3">
          <Callout tone="danger" title="Maintenance mode is ON" icon={<Power size={14} />}>
            {settings.platform.maintenanceMessage || 'The platform is in maintenance mode.'} Exempt tiers:{' '}
            {settings.platform.maintenanceExemptTiers.map((t) => TIER_META[t].label).join(', ') || 'none'}.
          </Callout>
        </div>
      )}

      <div className="p-2 sm:p-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* ------------------------------ group rail ------------------------------ */}
        <div className="space-y-3">
          <div className="rounded-xl border border-sky-900/50 bg-[#061020] p-1.5 space-y-0.5 lg:sticky lg:top-2">
            {SETTINGS_GROUPS.map((g) => {
              const canEdit = canEditSettingsGroup(g.key);
              return (
                <button
                  key={g.key}
                  onClick={() => setGroup(g.key)}
                  className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    group === g.key ? 'bg-gradient-to-r from-cyan-600/80 to-blue-600/80 text-white' : 'text-slate-400 hover:text-white hover:bg-sky-950/60'
                  }`}
                >
                  <span className="shrink-0">{GROUP_ICONS[g.key]}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] font-semibold truncate">{g.label}</span>
                  </span>
                  {!canEdit && <Lock size={11} className={group === g.key ? 'text-white/70 shrink-0' : 'text-slate-600 shrink-0'} />}
                </button>
              );
            })}
          </div>

          <Panel title="Configuration health" icon={<CheckCircle2 size={14} className="text-emerald-400" />}>
            <div className="space-y-1.5">
              {settingsHealth.map((h) => (
                <div key={h.label} className={`rounded-lg border px-2 py-1.5 ${h.severity === 'danger' ? 'border-rose-900/50 bg-rose-950/20' : h.severity === 'warning' ? 'border-amber-900/50 bg-amber-950/20' : 'border-sky-900/50 bg-[#050b14]'}`}>
                  <div className="flex items-center gap-1.5">
                    {h.ok ? <CheckCircle2 size={11} className="text-emerald-400 shrink-0" /> : <AlertTriangle size={11} className={h.severity === 'danger' ? 'text-rose-400 shrink-0' : 'text-amber-400 shrink-0'} />}
                    <span className="text-[10px] font-semibold text-slate-200 truncate">{h.label}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 leading-snug mt-0.5">{h.detail}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* ------------------------------- group form ------------------------------- */}
        <div className="space-y-4 min-w-0">
          <Panel
            title={
              <span className="flex items-center gap-2 min-w-0">
                {GROUP_ICONS[group]}
                <span className="truncate">{meta.label}</span>
                {editable ? <Badge tone="success">Editable</Badge> : <Badge tone="warning">Read only</Badge>}
              </span>
            }
            subtitle={meta.description}
            actions={
              <div className="flex flex-wrap items-center gap-1.5">
                <SearchInput value={q} onChange={setQ} placeholder="Find a setting…" className="w-36 sm:w-48" />
                <Button size="xs" variant="ghost" icon={<RotateCcw size={11} />} disabled={!dirty || !editable} onClick={() => setDraft(settings[group])}>Discard</Button>
                <Button size="xs" variant="secondary" icon={<RotateCcw size={11} />} disabled={!editable} onClick={async () => { const r = await settingsService.resetGroup(currentUser, group); if (r.ok) pushToast({ title: 'Group reset to defaults', type: 'warning' }); else pushToast({ title: 'Reset rejected', description: r.message, type: 'error' }); }}>
                  Reset group
                </Button>
                <Button size="xs" variant="primary" icon={<Save size={11} />} disabled={!dirty || !editable} loading={saving} onClick={save}>Save</Button>
              </div>
            }
          >
            {!editable && (
              <Callout tone="warning" title={`Requires ${settingsService.groupPermission(group)}`} className="mb-3">
                Your role can view this group but not change it. Only a Super Admin holds{' '}
                <code className="font-mono">{settingsService.groupPermission(group)}</code>.
              </Callout>
            )}

            {filteredSchema.length === 0 ? (
              <EmptyState title="No settings match" description="Clear the search box to see the whole group." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredSchema.map((f) => (
                  <SettingField
                    key={f.key}
                    def={f}
                    value={getPath(draft, f.key)}
                    disabled={!editable}
                    showSecrets={showSecrets}
                    onChange={(v) => setDraft(setPath(draft, f.key, v))}
                  />
                ))}
              </div>
            )}

            {editable && schema.some((f) => f.kind === 'text' && f.secret) && (
              <div className="mt-3">
                <Button size="xs" variant="ghost" onClick={() => setShowSecrets((v) => !v)} icon={<Info size={11} />}>
                  {showSecrets ? 'Hide secrets' : 'Reveal secret values'}
                </Button>
              </div>
            )}
          </Panel>

          {/* ------------------------ group-specific sub-tables ------------------------ */}
          {group === 'compliance' && <ComplianceTables settings={settings} editable={editable} onChange={(patch) => setDraft({ ...(draft as object), ...patch })} />}
          {group === 'risk' && <RiskTables settings={settings} editable={editable} onChange={(patch) => setDraft({ ...(draft as object), ...patch })} />}
          {group === 'platform' && <PlatformTables settings={settings} editable={editable} onChange={(patch) => setDraft({ ...(draft as object), ...patch })} currentUser={currentUser} pushToast={pushToast} />}
          {group === 'integrations' && <IntegrationTables settings={settings} editable={editable} onChange={(patch) => setDraft({ ...(draft as object), ...patch })} />}
          {group === 'security' && (
            <Panel title="Where these controls apply" icon={<ShieldCheck size={14} className="text-emerald-400" />}>
              <ul className="space-y-1.5 text-[11px] text-slate-400">
                <li className="flex items-start gap-1.5"><Terminal size={11} className="text-cyan-400 mt-0.5 shrink-0" /> Password policy is validated on self-service change and administrator reset.</li>
                <li className="flex items-start gap-1.5"><Terminal size={11} className="text-cyan-400 mt-0.5 shrink-0" /> MFA enforcement is checked at sign-in — enforced tiers are prompted for a TOTP code.</li>
                <li className="flex items-start gap-1.5"><Terminal size={11} className="text-cyan-400 mt-0.5 shrink-0" /> Lockout threshold and duration are applied by the authentication service on each failed attempt.</li>
                <li className="flex items-start gap-1.5"><Terminal size={11} className="text-cyan-400 mt-0.5 shrink-0" /> The IP allowlist here is platform-wide; individual accounts can add their own ranges in Profile → Security.</li>
              </ul>
            </Panel>
          )}
          {group === 'backup' && currentUser?.tier === 'super_admin' && (
            <Panel title="Backup & Recovery" subtitle="Super Admin only · versioned, transactional server snapshots" icon={<Database size={14} className="text-sky-400" />}>
              {apiMode !== 'api' && (
                <Callout tone="warning" title="Backend required" className="mb-3">
                  Local fallback mode cannot export or restore the authoritative SQLite database. Start the Node backend to use backup operations.
                </Callout>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary" icon={<Download size={12} />} loading={backupBusy} disabled={apiMode !== 'api'} onClick={() => void exportBackup()}>Download backup</Button>
                <Button size="sm" variant="secondary" icon={<Upload size={12} />} loading={backupBusy} disabled={apiMode !== 'api'} onClick={() => restoreInput.current?.click()}>Restore backup</Button>
                <input ref={restoreInput} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void restoreBackup(file); }} />
              </div>
              {backupMessage && <p className="mt-3 text-[10px] text-slate-400" role="status">{backupMessage}</p>}
              <p className="mt-3 text-[10px] text-slate-600">Exports exclude sessions and in-flight STK intents. Restore preserves the current signing and callback secrets and rejects unsupported versions before opening a transaction.</p>
            </Panel>
          )}
        </div>
      </div>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={<span className="flex items-center gap-2"><Upload size={15} className="text-cyan-400" /> Import configuration</span>}
        subtitle="Paste an exported JSON document. Credentials are never imported."
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={<Upload size={13} />}
              onClick={async () => {
                const res = await settingsService.importConfig(currentUser, importText);
                if (res.ok) {
                  setImportOpen(false);
                  setImportText('');
                  pushToast({ title: 'Configuration imported', type: 'success' });
                } else {
                  pushToast({ title: 'Import failed', description: res.message, type: 'error' });
                }
              }}
            >
              Import
            </Button>
          </>
        }
      >
        <Field label="Configuration JSON" hint="Produced by the Export button">
          <TextArea rows={12} value={importText} onChange={(e) => setImportText(e.target.value)} className="font-mono text-[10px]" placeholder='{ "org": { … }, "billing": { … } }' />
        </Field>
      </Modal>
    </div>
  );
};

/* ------------------------------ field renderer ------------------------------ */

const SettingField: React.FC<{
  def: FieldDef;
  value: unknown;
  disabled: boolean;
  showSecrets: boolean;
  onChange: (v: unknown) => void;
}> = ({ def, value, disabled, showSecrets, onChange }) => {
  if (def.kind === 'toggle') {
    return (
      <div className="sm:col-span-2">
        <Toggle checked={Boolean(value)} disabled={disabled} onChange={onChange} label={def.label} description={def.description} />
      </div>
    );
  }

  if (def.kind === 'select') {
    // Tier multi-selects are rendered as chip toggles.
    if (def.key === 'mfaRequiredFor' || def.key === 'maintenanceExemptTiers') {
      const list = (value as RoleTier[]) ?? [];
      return (
        <div className="sm:col-span-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{def.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {(['user', 'admin', 'super_admin'] as RoleTier[]).map((t) => {
              const on = list.includes(t);
              return (
                <button
                  key={t}
                  disabled={disabled || t === 'super_admin'}
                  onClick={() => onChange(on ? list.filter((x) => x !== t) : [...list, t])}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-colors disabled:opacity-50 ${
                    on ? 'border-cyan-600/70 bg-cyan-950/40 text-cyan-200' : 'border-sky-900/60 bg-[#061020] text-slate-500 hover:text-white'
                  }`}
                  title={t === 'super_admin' ? 'Always enforced for the Super Admin tier' : undefined}
                >
                  {TIER_META[t].label} {t === 'super_admin' && on ? '(always)' : ''}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <Field label={def.label} hint={def.hint}>
        <Select value={String(value ?? '')} disabled={disabled} onChange={(e) => onChange(e.target.value)} options={def.options} />
      </Field>
    );
  }

  if (def.kind === 'list') {
    const list = (value as string[]) ?? [];
    return (
      <div className="sm:col-span-2">
        <Field label={def.label} hint={def.hint}>
          <div className="space-y-1.5">
            {list.length === 0 && <p className="text-[10px] text-slate-600 italic">Empty.</p>}
            {list.map((item, i) => (
              <div key={`${item}-${i}`} className="flex items-center gap-1.5">
                <TextInput value={item} disabled={disabled} className="font-mono flex-1" onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />
                {!disabled && (
                  <Button size="xs" variant="ghost" onClick={() => onChange(list.filter((_, j) => j !== i))} className="text-rose-400/80">Remove</Button>
                )}
              </div>
            ))}
            {!disabled && (
              <div className="flex gap-1.5">
                <TextInput id={`new-${def.key}`} placeholder="Add an entry…" className="font-mono flex-1" onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const el = e.currentTarget;
                    if (el.value.trim()) { onChange([...list, el.value.trim()]); el.value = ''; }
                  }
                }} />
                <Button size="xs" variant="secondary" onClick={(e) => {
                  const el = document.getElementById(`new-${def.key}`) as HTMLInputElement | null;
                  if (el?.value.trim()) { onChange([...list, el.value.trim()]); el.value = ''; }
                  e.preventDefault();
                }}>Add</Button>
              </div>
            )}
          </div>
        </Field>
      </div>
    );
  }

  if (def.kind === 'number') {
    return (
      <Field label={def.label} hint={def.hint}>
        <TextInput type="number" value={Number(value ?? 0)} disabled={disabled} className="font-mono" min={def.min} max={def.max} onChange={(e) => onChange(Number(e.target.value))} />
      </Field>
    );
  }

  if (def.kind === 'textarea') {
    return (
      <div className="sm:col-span-2">
        <Field label={def.label} hint={def.hint}>
          <TextArea rows={def.rows ?? 3} value={String(value ?? '')} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        </Field>
      </div>
    );
  }

  return (
    <Field label={def.label} hint={def.hint}>
      <TextInput
        value={String(value ?? '')}
        disabled={disabled}
        className={def.mono ? 'font-mono' : undefined}
        type={def.secret && !showSecrets ? 'password' : 'text'}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
};

/* ------------------------------ nested tables ------------------------------ */

const ComplianceTables: React.FC<{ settings: SystemSettings; editable: boolean; onChange: (patch: Partial<SystemSettings['compliance']>) => void }> = ({ settings, editable, onChange }) => (
  <>
    <Panel title="PII masking rules" subtitle="Applied to reports, exports and on-screen values" icon={<Scale size={14} className="text-amber-400" />}>
      <ResponsiveTable
        dense
        rowKey={(r) => r.field}
        rows={settings.compliance.piiMasking}
        columns={[
          { key: 'field', header: 'Field', mobilePrimary: true, render: (r) => <span className="font-mono text-[10px] text-cyan-300">{r.field}</span>, sortValue: (r) => r.field },
          {
            key: 'mask',
            header: 'Masking',
            render: (r) => (
              <SegmentedControl
                size="sm"
                value={r.mask}
                onChange={(v) => editable && onChange({ piiMasking: settings.compliance.piiMasking.map((x) => (x.field === r.field ? { ...x, mask: v as 'full' | 'partial' | 'none' } : x)) })}
                options={[
                  { value: 'full', label: 'Full' },
                  { value: 'partial', label: 'Partial' },
                  { value: 'none', label: 'None' },
                ]}
              />
            ),
            renderMobile: (r) => <Badge tone={r.mask === 'full' ? 'danger' : r.mask === 'partial' ? 'warning' : 'neutral'}>{r.mask}</Badge>,
          },
        ]}
      />
      {!editable && <p className="mt-2 text-[10px] text-slate-600">Read-only — requires <code className="font-mono">settings.edit.compliance</code>.</p>}
    </Panel>

    <Panel title="Retention schedule" subtitle="How long each record type is kept before erasure" icon={<Database size={14} className="text-sky-400" />}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {settings.compliance.retention.map((r) => (
          <div key={r.recordType} className="rounded-lg border border-sky-900/50 bg-[#061020] px-2.5 py-2 flex items-center gap-2">
            <span className="text-[11px] text-slate-300 flex-1 truncate">{r.recordType}</span>
            <TextInput
              type="number"
              min={1}
              value={r.months}
              disabled={!editable}
              className="w-16 text-right font-mono py-1"
              onChange={(e) => onChange({ retention: settings.compliance.retention.map((x) => (x.recordType === r.recordType ? { ...x, months: Number(e.target.value) } : x)) })}
            />
            <span className="text-[9px] text-slate-600">months</span>
          </div>
        ))}
      </div>
    </Panel>
  </>
);

const RiskTables: React.FC<{ settings: SystemSettings; editable: boolean; onChange: (patch: Partial<SystemSettings['risk']>) => void }> = ({ settings, editable, onChange }) => (
  <>
    <Panel title="Provider weights" subtitle="How much each source moves the risk score" icon={<Gauge size={14} className="text-rose-400" />}>
      <div className="space-y-2">
        {settings.risk.providerWeights.map((w) => (
          <div key={w.providerId} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 w-40 truncate font-mono">{w.providerId}</span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={w.weight}
              disabled={!editable}
              onChange={(e) => onChange({ providerWeights: settings.risk.providerWeights.map((x) => (x.providerId === w.providerId ? { ...x, weight: Number(e.target.value) } : x)) })}
              className="flex-1 accent-rose-500 h-1"
              aria-label={`Weight for ${w.providerId}`}
            />
            <span className="text-[10px] font-mono text-slate-300 w-10 text-right">{w.weight.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-2.5 py-2">
          <div className="text-[9px] uppercase tracking-wider text-emerald-500/80 font-bold">Low risk</div>
          <div className="text-[11px] text-slate-300">score ≤ {settings.risk.lowThreshold}</div>
        </div>
        <div className="rounded-lg border border-rose-900/50 bg-rose-950/20 px-2.5 py-2">
          <div className="text-[9px] uppercase tracking-wider text-rose-500/80 font-bold">High risk</div>
          <div className="text-[11px] text-slate-300">score ≥ {settings.risk.highThreshold}</div>
        </div>
      </div>
    </Panel>

    <Panel title="Auto-flag rules" icon={<AlertTriangle size={14} className="text-amber-400" />}>
      <ResponsiveTable
        dense
        rowKey={(r) => r.id}
        rows={settings.risk.autoFlagRules}
        columns={[
          { key: 'label', header: 'Rule', mobilePrimary: true, render: (r) => <span className="text-[11px] text-slate-200">{r.label}</span>, sortValue: (r) => r.label },
          { key: 'severity', header: 'Severity', render: (r) => <Badge tone={r.severity === 'danger' ? 'danger' : 'warning'}>{r.severity}</Badge>, sortValue: (r) => r.severity },
          {
            key: 'enabled',
            header: 'Enabled',
            align: 'center',
            render: (r) => (
              <Toggle
                checked={r.enabled}
                disabled={!editable}
                onChange={(v) => onChange({ autoFlagRules: settings.risk.autoFlagRules.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)) })}
              />
            ),
            renderMobile: (r) => <Badge tone={r.enabled ? 'success' : 'neutral'} dot>{r.enabled ? 'On' : 'Off'}</Badge>,
          },
        ]}
      />
    </Panel>
  </>
);

const PlatformTables: React.FC<{
  settings: SystemSettings;
  editable: boolean;
  onChange: (patch: Partial<SystemSettings['platform']>) => void;
  currentUser: ReturnType<typeof useAppData>['currentUser'];
  pushToast: ReturnType<typeof useAppData>['pushToast'];
}> = ({ settings, editable, onChange, currentUser, pushToast }) => (
  <>
    <Panel title="API rate limits per tier" icon={<Cpu size={14} className="text-violet-400" />}>
      <div className="grid gap-2 sm:grid-cols-3">
        {settings.platform.apiRateLimitPerMin.map((r) => (
          <div key={r.tier} className={`rounded-lg border p-2.5 ${TIER_META[r.tier].accent}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider">{TIER_META[r.tier].label}</div>
            <div className="mt-1.5 flex items-center gap-2">
              <TextInput
                type="number"
                min={1}
                value={r.limit}
                disabled={!editable}
                className="font-mono flex-1"
                onChange={(e) => onChange({ apiRateLimitPerMin: settings.platform.apiRateLimitPerMin.map((x) => (x.tier === r.tier ? { ...x, limit: Number(e.target.value) } : x)) })}
              />
              <span className="text-[9px] opacity-70">req/min</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>

    <Panel title="Feature flags" subtitle="Toggle capabilities without a deployment" icon={<Power size={14} className="text-emerald-400" />}>
      <div className="grid gap-2 sm:grid-cols-2">
        {settings.platform.featureFlags.map((f) => (
          <div key={f.id} className="rounded-lg border border-sky-900/50 bg-[#061020] p-2.5">
            <Toggle
              checked={f.enabled}
              disabled={!editable}
              onChange={async (v) => {
                const res = await settingsService.toggleFeatureFlag(currentUser, f.id, v);
                if (res.ok) {
                  onChange({ featureFlags: settings.platform.featureFlags.map((x) => (x.id === f.id ? { ...x, enabled: v } : x)) });
                  pushToast({ title: `${f.label} ${v ? 'enabled' : 'disabled'}`, type: v ? 'success' : 'warning' });
                } else {
                  pushToast({ title: 'Rejected', description: res.message, type: 'error' });
                }
              }}
              label={<span className="text-[11px] font-semibold text-white">{f.label}</span>}
              description={<span className="text-[10px] text-slate-500">{f.description}</span>}
            />
          </div>
        ))}
      </div>
    </Panel>

    <Panel title="Maintenance control" icon={<Power size={14} className="text-rose-400" />}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={settings.platform.maintenanceMode ? 'danger' : 'success'} dot>
            {settings.platform.maintenanceMode ? 'Maintenance mode ON' : 'Platform operational'}
          </Badge>
          <Button
            size="xs"
            variant={settings.platform.maintenanceMode ? 'success' : 'danger'}
            disabled={!editable}
            icon={<Power size={11} />}
            onClick={async () => {
              const next = !settings.platform.maintenanceMode;
              const res = await settingsService.toggleMaintenance(currentUser, next);
              if (res.ok) {
                onChange({ maintenanceMode: next });
                pushToast({ title: next ? 'Maintenance mode enabled' : 'Maintenance mode disabled', type: next ? 'warning' : 'success' });
              } else {
                pushToast({ title: 'Rejected', description: res.message, type: 'error' });
              }
            }}
          >
            {settings.platform.maintenanceMode ? 'Bring platform online' : 'Enter maintenance mode'}
          </Button>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          While enabled, sign-in and searches are blocked for every tier except{' '}
          {settings.platform.maintenanceExemptTiers.map((t) => TIER_META[t].label).join(', ') || 'none'}. The change is written to
          the audit log as a critical event.
        </p>
      </div>
    </Panel>
  </>
);

const IntegrationTables: React.FC<{ settings: SystemSettings; editable: boolean; onChange: (patch: Partial<SystemSettings['integrations']>) => void }> = ({ settings, editable, onChange }) => (
  <Panel title="Outbound webhooks" subtitle="Platform-level event delivery" icon={<PlugZap size={14} className="text-cyan-400" />}>
    {settings.integrations.webhooks.length === 0 ? (
      <EmptyState title="No webhooks configured" />
    ) : (
      <ResponsiveTable
        dense
        rowKey={(w) => w.id}
        rows={settings.integrations.webhooks}
        columns={[
          { key: 'label', header: 'Webhook', mobilePrimary: true, render: (w) => <div className="min-w-0"><div className="text-[11px] font-semibold text-white truncate">{w.label}</div><div className="text-[10px] text-slate-500 font-mono truncate">{w.url}</div></div>, sortValue: (w) => w.label },
          { key: 'events', header: 'Events', render: (w) => <div className="flex flex-wrap gap-1">{w.events.map((e) => <span key={e} className="px-1.5 py-0.5 rounded bg-sky-950/70 border border-sky-900/60 text-[9px] font-mono text-slate-300">{e}</span>)}</div> },
          { key: 'retries', header: 'Retries', align: 'right', render: (w) => <span className="font-mono text-[10px]">{w.retries}</span>, className: 'hidden sm:table-cell', sortValue: (w) => w.retries },
          {
            key: 'enabled',
            header: 'Enabled',
            align: 'center',
            render: (w) => <Toggle checked={w.enabled} disabled={!editable} onChange={(v) => onChange({ webhooks: settings.integrations.webhooks.map((x) => (x.id === w.id ? { ...x, enabled: v } : x)) })} />,
            renderMobile: (w) => <Badge tone={w.enabled ? 'success' : 'neutral'} dot>{w.enabled ? 'On' : 'Off'}</Badge>,
          },
        ]}
      />
    )}
  </Panel>
);

export default SystemSettingsScreen;
