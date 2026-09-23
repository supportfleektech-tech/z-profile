import type { ApiKeyRecord, ProviderConfig, ProviderFieldMapping, ProviderRequestLog, SystemUser } from '../types';
import { getSnapshot, setState } from './db';
import { apiOr } from './http';
import { auditService } from './auth.service';
import { can } from '../auth/permissions';
import { isValidUrl, maskSecret, sleep, uid } from '../lib/format';

/**
 * Provider gateway administration — connection, behaviour, commercial, contract
 * (field mapping), webhooks and alerts — plus the request log and API keys.
 */

export interface TestStage {
  label: string;
  ok: boolean;
  ms: number;
  detail: string;
}

export interface TestResult {
  ok: boolean;
  stages: TestStage[];
  totalMs: number;
  httpCode: number;
  schemaValid: boolean;
  message: string;
}

export const providerService = {
  list(): ProviderConfig[] {
    return getSnapshot().providerConfigs;
  },

  get(id: string): ProviderConfig | undefined {
    return getSnapshot().providerConfigs.find((p) => p.id === id);
  },

  async update(actor: SystemUser | null, id: string, patch: Partial<ProviderConfig>): Promise<{ ok: boolean; message?: string }> {
    const local = async () => {
      await sleep(320);
      if (!actor || !can(actor, 'providers.configure')) return { ok: false, message: 'You do not have permission to configure provider gateways.' };
      const current = providerService.get(id);
      if (!current) return { ok: false, message: 'Provider not found.' };
      if (patch.baseUrl !== undefined && patch.baseUrl !== '' && !isValidUrl(patch.baseUrl)) {
        return { ok: false, message: 'Base URL must be a valid http(s) URL.' };
      }
      if (patch.webhookUrl && !isValidUrl(patch.webhookUrl)) {
        return { ok: false, message: 'Webhook URL must be a valid http(s) URL.' };
      }
      if (patch.timeoutMs !== undefined && (patch.timeoutMs < 500 || patch.timeoutMs > 120000)) {
        return { ok: false, message: 'Timeout must be between 500 and 120,000 ms.' };
      }
      if (patch.rateLimitPerMin !== undefined && patch.rateLimitPerMin < 1) {
        return { ok: false, message: 'Rate limit must be at least 1 request per minute.' };
      }
      if (patch.fieldMappings) {
        const bad = patch.fieldMappings.find((m) => !m.platformField.trim() || !m.providerField.trim());
        if (bad) return { ok: false, message: 'Every field mapping needs both a platform field and a provider field.' };
        const dupes = patch.fieldMappings.filter((m, i, arr) => arr.findIndex((x) => x.platformField === m.platformField) !== i);
        if (dupes.length) return { ok: false, message: `Duplicate platform field in mapping: ${dupes[0].platformField}` };
      }

      const changes = Object.keys(patch).filter((k) => JSON.stringify((patch as Record<string, unknown>)[k]) !== JSON.stringify((current as unknown as Record<string, unknown>)[k]));
      setState((prev) => ({
        providerConfigs: prev.providerConfigs.map((p) => (p.id === id ? { ...p, ...patch, id: p.id } : p)),
      }));
      auditService.append({
        actorId: actor.id,
        actorName: actor.name,
        actorTier: actor.tier,
        action: 'provider.config.updated',
        entity: 'ProviderConfig',
        entityId: id,
        severity: changes.includes('consumerSecret') || changes.includes('consumerKey') ? 'critical' : 'info',
        ip: actor.lastLoginIp ?? '0.0.0.0',
        detail: `${current.name}: ${changes.length ? changes.join(', ') : 'no effective change'}`,
      });
      return { ok: true, message: `${current.name} configuration saved.` };
    };
    return apiOr(`/api/providers/${id}`, { method: 'PATCH', body: patch }, local, { syncLocal: true }).then((r) => r.data);
  },

  async toggleEnabled(actor: SystemUser | null, id: string): Promise<{ ok: boolean; message?: string }> {
    const current = providerService.get(id);
    if (!current) return { ok: false, message: 'Provider not found.' };
    return providerService.update(actor, id, {
      enabled: !current.enabled,
      status: !current.enabled ? 'Active' : 'Disabled',
    });
  },

  /** Multi-stage connection test modelled on a real gateway handshake. */
  async test(actor: SystemUser | null, id: string): Promise<TestResult> {
    const local = async (): Promise<TestResult> => {
      if (!actor || !can(actor, 'providers.test')) {
        return { ok: false, stages: [], totalMs: 0, httpCode: 0, schemaValid: false, message: 'You do not have permission to test provider connections.' };
      }
      const cfg = providerService.get(id);
      if (!cfg) return { ok: false, stages: [], totalMs: 0, httpCode: 0, schemaValid: false, message: 'Provider not found.' };
      const stages: TestStage[] = [];
      const step = async (label: string, ok: boolean, detail: string, ms: number) => {
        await sleep(ms);
        stages.push({ label, ok, ms, detail });
      };

      await step('DNS resolution', true, `${new URL(cfg.baseUrl).hostname} resolved to 52.49.118.7`, 240 + Math.random() * 180);
      await step('TLS handshake', cfg.environment === 'live' || !!cfg.certificateRef || cfg.authType !== 'mtls', cfg.authType === 'mtls' ? `mTLS via ${cfg.certificateRef || 'certificate store'}` : 'TLS 1.3 negotiated', 180 + Math.random() * 220);

      const hasCredentials = Boolean(cfg.consumerKey) && (cfg.authType === 'none' || Boolean(cfg.consumerSecret));
      await step('Authentication', hasCredentials, hasCredentials ? `${cfg.authType.toUpperCase()} credentials accepted` : 'Missing consumer key or secret', 260 + Math.random() * 300);

      const reachable = cfg.enabled && cfg.status !== 'Offline';
      await step(`Request ${cfg.method} ${cfg.endpointPath}`, reachable, reachable ? `HTTP 200 OK in ${cfg.latencyMs}ms` : `Gateway is ${cfg.status.toLowerCase()}`, 400 + Math.random() * 500);

      let schemaValid = false;
      try {
        const sample = JSON.parse(cfg.responseSample || '{}') as Record<string, unknown>;
        const required = cfg.fieldMappings.filter((m) => m.required);
        const missing = required.filter((m) => !(m.providerField.replace('[]', '') in sample));
        schemaValid = missing.length === 0;
        await step(
          'Response schema validation',
          schemaValid,
          schemaValid
            ? `${required.length} required field(s) present in the sample response`
            : `Missing required field(s): ${missing.map((m) => m.providerField).join(', ')}`,
          160 + Math.random() * 160
        );
      } catch {
        await step('Response schema validation', false, 'Response sample is not valid JSON', 120);
      }

      await step('Rate-limit budget', cfg.rateLimitPerMin > 0, `${cfg.rateLimitPerMin} req/min configured, ${cfg.concurrency} concurrent`, 90);

      const ok = stages.every((s) => s.ok);
      const totalMs = stages.reduce((a, s) => a + s.ms, 0);
      setState((prev) => ({
        providerConfigs: prev.providerConfigs.map((p) =>
          p.id === id
            ? {
                ...p,
                lastTestAt: new Date().toISOString(),
                lastTestResult: ok ? 'pass' : 'fail',
                latencyMs: ok ? Math.round(totalMs / stages.length) : p.latencyMs,
                lastSync: 'Just now',
                status: ok ? 'Active' : p.status === 'Disabled' ? 'Disabled' : 'Degraded',
              }
            : p
        ),
      }));
      auditService.append({
        actorId: actor.id,
        actorName: actor.name,
        actorTier: actor.tier,
        action: 'provider.tested',
        entity: 'ProviderConfig',
        entityId: id,
        severity: ok ? 'success' : 'warning',
        ip: actor.lastLoginIp ?? '0.0.0.0',
        detail: `Connection test ${ok ? 'passed' : 'failed'} in ${Math.round(totalMs)}ms (${stages.filter((s) => s.ok).length}/${stages.length} stages)`,
      });
      return {
        ok,
        stages,
        totalMs: Math.round(totalMs),
        httpCode: reachable ? 200 : 503,
        schemaValid,
        message: ok ? 'All stages passed — the gateway is reachable and the contract validates.' : `${stages.filter((s) => !s.ok).length} stage(s) failed.`,
      };
    };
    return apiOr<TestResult>(`/api/providers/${id}/test`, { method: 'POST' }, local, { syncLocal: true }).then((r) => r.data);
  },

  async ping(actor: SystemUser | null, id: string): Promise<void> {
    const cfg = providerService.get(id);
    if (!cfg) return;
    await sleep(900);
    setState((prev) => ({
      providerConfigs: prev.providerConfigs.map((p) =>
        p.id === id ? { ...p, lastSync: 'Just now', latencyMs: Math.floor(60 + Math.random() * 200), status: p.enabled ? 'Active' : 'Disabled' } : p
      ),
    }));
    providerService.logRequest({
      providerId: id,
      providerName: cfg.name,
      endpoint: `${cfg.method} ${cfg.endpointPath}`,
      actorId: actor?.id ?? 'system',
      actorName: actor?.name ?? 'System',
      subjectRef: 'health-check',
      status: 'success',
      httpCode: 200,
      latencyMs: Math.floor(60 + Math.random() * 200),
      costKes: 0,
      fieldsRequested: 0,
      ip: actor?.lastLoginIp ?? '127.0.0.1',
    });
  },

  logRequest(entry: Omit<ProviderRequestLog, 'id' | 'at'>): ProviderRequestLog {
    const log: ProviderRequestLog = { ...entry, id: uid('pl'), at: new Date().toISOString() };
    setState((prev) => ({
      providerLogs: [log, ...prev.providerLogs].slice(0, 1000),
      providerConfigs: prev.providerConfigs.map((p) => (p.id === entry.providerId ? { ...p, lastSync: 'Just now', latencyMs: entry.latencyMs } : p)),
    }));
    return log;
  },

  logs(filter: { providerId?: string; status?: string; actorId?: string; limit?: number } = {}): ProviderRequestLog[] {
    const s = getSnapshot();
    return s.providerLogs
      .filter((l) => (!filter.providerId || l.providerId === filter.providerId) && (!filter.status || l.status === filter.status) && (!filter.actorId || l.actorId === filter.actorId))
      .slice(0, filter.limit ?? 500);
  },

  addFieldMapping(providerId: string, mapping: Omit<ProviderFieldMapping, 'id'>): ProviderFieldMapping {
    const created: ProviderFieldMapping = { ...mapping, id: uid('fm') };
    setState((prev) => ({
      providerConfigs: prev.providerConfigs.map((p) => (p.id === providerId ? { ...p, fieldMappings: [...p.fieldMappings, created] } : p)),
    }));
    return created;
  },

  removeFieldMapping(providerId: string, mappingId: string): void {
    setState((prev) => ({
      providerConfigs: prev.providerConfigs.map((p) =>
        p.id === providerId ? { ...p, fieldMappings: p.fieldMappings.filter((m) => m.id !== mappingId) } : p
      ),
    }));
  },

  /* --------------------------------- API keys --------------------------------- */

  apiKeys(filter: { providerId?: string; ownerId?: string; status?: string } = {}): ApiKeyRecord[] {
    const s = getSnapshot();
    return s.apiKeys.filter(
      (k) => (!filter.providerId || k.providerId === filter.providerId) && (!filter.ownerId || k.ownerId === filter.ownerId) && (!filter.status || k.status === filter.status)
    );
  },

  createApiKey(actor: SystemUser | null, input: { label: string; scopes: string[]; providerId?: string; environment: 'sandbox' | 'live' }): { ok: boolean; key?: ApiKeyRecord; secret?: string; message?: string } {
    if (!actor || !can(actor, 'apikeys.manage')) return { ok: false, message: 'You do not have permission to manage API keys.' };
    if (!input.label.trim()) return { ok: false, message: 'A label is required.' };
    if (input.scopes.length === 0) return { ok: false, message: 'Select at least one scope.' };
    if (input.environment === 'live' && actor.tier === 'user') return { ok: false, message: 'Only an Admin or Super Admin can issue live keys.' };

    const secret = `iprs_${input.environment}_${Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]).join('')}`;
    const key: ApiKeyRecord = {
      id: uid('ak'),
      label: input.label.trim(),
      prefix: secret.slice(0, 16),
      secretMasked: maskSecret(secret, 4),
      scopes: input.scopes,
      providerId: input.providerId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 86400_000).toISOString(),
      status: 'active',
      ownerId: actor.id,
      environment: input.environment,
    };
    setState((prev) => ({ apiKeys: [key, ...prev.apiKeys] }));
    auditService.append({
      actorId: actor.id,
      actorName: actor.name,
      actorTier: actor.tier,
      action: 'apikey.created',
      entity: 'ApiKey',
      entityId: key.id,
      severity: 'critical',
      ip: actor.lastLoginIp ?? '0.0.0.0',
      detail: `Issued ${input.environment} key "${key.label}" with scopes ${input.scopes.join(', ')}`,
    });
    return { ok: true, key, secret };
  },

  revokeApiKey(actor: SystemUser | null, id: string): { ok: boolean; message?: string } {
    if (!actor || !can(actor, 'apikeys.manage')) return { ok: false, message: 'Not permitted.' };
    const key = getSnapshot().apiKeys.find((k) => k.id === id);
    if (!key) return { ok: false, message: 'API key not found.' };
    setState((prev) => ({ apiKeys: prev.apiKeys.map((k) => (k.id === id ? { ...k, status: 'revoked' } : k)) }));
    auditService.append({
      actorId: actor.id,
      actorName: actor.name,
      actorTier: actor.tier,
      action: 'apikey.revoked',
      entity: 'ApiKey',
      entityId: id,
      severity: 'critical',
      ip: actor.lastLoginIp ?? '0.0.0.0',
      detail: `Revoked API key "${key.label}"`,
    });
    return { ok: true };
  },

  /** Aggregate usage/cost per provider for the Usage tab. */
  usage(): { providerId: string; name: string; calls: number; successes: number; errors: number; costKes: number; avgLatencyMs: number; successRatePct: number; quotaUsed: number; quotaTotal: number }[] {
    const s = getSnapshot();
    return s.providerConfigs.map((cfg) => {
      const logs = s.providerLogs.filter((l) => l.providerId === cfg.id);
      const successes = logs.filter((l) => l.status === 'success').length;
      const errors = logs.length - successes;
      return {
        providerId: cfg.id,
        name: cfg.name,
        calls: logs.length,
        successes,
        errors,
        costKes: logs.reduce((a, l) => a + l.costKes, 0),
        avgLatencyMs: logs.length ? Math.round(logs.reduce((a, l) => a + l.latencyMs, 0) / logs.length) : cfg.latencyMs,
        successRatePct: logs.length ? (successes / logs.length) * 100 : 100,
        quotaUsed: s.usage.filter((u) => u.providerId === cfg.id).length,
        quotaTotal: cfg.includedMonthlyQuota,
      };
    });
  },
};
