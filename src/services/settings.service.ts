import type { AppearanceSettings, NotificationPreferences, PricingCatalog, SystemSettings, SystemUser } from '../types';
import { getSnapshot, setState } from './db';
import { apiOr } from './http';
import { auditService } from './auth.service';
import { can } from '../auth/permissions';
import { defaultSettings, SETTINGS_GROUPS } from '../data/settings';
import { pricingCatalog } from '../data/pricing';
import { sleep } from '../lib/format';

/**
 * System settings administration.
 *
 * Each group is gated by a distinct permission so an Admin can run operations without
 * being able to weaken security, compliance or platform policy — only a Super Admin can.
 */

const GROUP_PERMISSION = Object.fromEntries(SETTINGS_GROUPS.map((g) => [g.key, g.editPermission])) as Record<
  keyof SystemSettings,
  'settings.edit.operational' | 'settings.edit.security' | 'settings.edit.compliance' | 'settings.edit.platform'
>;

export const settingsService = {
  get(): SystemSettings {
    return getSnapshot().settings;
  },

  groupPermission<K extends keyof SystemSettings>(group: K) {
    return GROUP_PERMISSION[group];
  },

  canEdit(actor: SystemUser | null, group: keyof SystemSettings): boolean {
    if (!actor) return false;
    return can(actor, GROUP_PERMISSION[group]);
  },

  async update<K extends keyof SystemSettings>(
    actor: SystemUser | null,
    group: K,
    patch: Partial<SystemSettings[K]>
  ): Promise<{ ok: boolean; message?: string }> {
    const local = async () => {
      await sleep(260);
      if (!actor) return { ok: false, message: 'Not authenticated.' };
      if (!can(actor, 'settings.view')) return { ok: false, message: 'You do not have access to system settings.' };
      if (!settingsService.canEdit(actor, group)) {
        return {
          ok: false,
          message: `Editing "${SETTINGS_GROUPS.find((g) => g.key === group)?.label ?? group}" requires the ${GROUP_PERMISSION[group]} permission (Super Admin only).`,
        };
      }
      const before = getSnapshot().settings[group];
      setState((prev) => ({ settings: { ...prev.settings, [group]: { ...(prev.settings[group] as object), ...(patch as object) } } as SystemSettings }));
      const changed = Object.keys(patch).filter((k) => JSON.stringify((patch as Record<string, unknown>)[k]) !== JSON.stringify((before as unknown as Record<string, unknown>)[k]));
      auditService.append({
        actorId: actor.id,
        actorName: actor.name,
        actorTier: actor.tier,
        action: `settings.${group}.updated`,
        entity: 'SystemSettings',
        entityId: String(group),
        severity: group === 'security' || group === 'compliance' || group === 'platform' ? 'critical' : 'info',
        ip: actor.lastLoginIp ?? '0.0.0.0',
        detail: changed.length ? `${group}: ${changed.join(', ')}` : `${group}: no effective change`,
      });
      return { ok: true, message: `${SETTINGS_GROUPS.find((g) => g.key === group)?.label ?? group} saved.` };
    };
    return apiOr(`/api/settings/${String(group)}`, { method: 'PATCH', body: patch }, local, { syncLocal: true }).then((r) => r.data);
  },

  async resetGroup(actor: SystemUser | null, group: keyof SystemSettings): Promise<{ ok: boolean; message?: string }> {
    if (!settingsService.canEdit(actor, group)) return { ok: false, message: 'Not permitted.' };
    return settingsService.update(actor, group, defaultSettings[group] as Partial<SystemSettings[typeof group]>);
  },

  async toggleMaintenance(actor: SystemUser | null, enabled: boolean, message?: string): Promise<{ ok: boolean; message?: string }> {
    if (!actor || !can(actor, 'maintenance.toggle')) return { ok: false, message: 'Only a Super Admin can toggle maintenance mode.' };
    return settingsService.update(actor, 'platform', {
      maintenanceMode: enabled,
      ...(message !== undefined ? { maintenanceMessage: message } : {}),
    });
  },

  async toggleFeatureFlag(actor: SystemUser | null, flagId: string, enabled: boolean): Promise<{ ok: boolean; message?: string }> {
    if (!actor || !can(actor, 'settings.edit.platform')) return { ok: false, message: 'Only a Super Admin can change feature flags.' };
    const s = getSnapshot();
    const flags = s.settings.platform.featureFlags.map((f) => (f.id === flagId ? { ...f, enabled } : f));
    const flag = flags.find((f) => f.id === flagId);
    await settingsService.update(actor, 'platform', { featureFlags: flags });
    auditService.append({
      actorId: actor.id,
      actorName: actor.name,
      actorTier: actor.tier,
      action: enabled ? 'feature.enabled' : 'feature.disabled',
      entity: 'FeatureFlag',
      entityId: flagId,
      severity: 'warning',
      ip: actor.lastLoginIp ?? '0.0.0.0',
      detail: `${flag?.label ?? flagId} → ${enabled ? 'enabled' : 'disabled'}`,
    });
    return { ok: true };
  },

  /** Export the whole configuration as a portable JSON document. */
  exportConfig(actor: SystemUser | null): string {
    if (!actor || !can(actor, 'settings.view')) return '';
    const s = getSnapshot();
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        exportedBy: actor.email,
        platform: 'IPRS Kenya',
        version: 3,
        settings: s.settings,
        pricing: s.pricing,
        providers: s.providerConfigs.map(({ consumerSecret: _consumerSecret, webhookSecret: _webhookSecret, ...rest }) => ({
          ...rest,
          consumerSecret: '[REDACTED]',
          webhookSecret: '[REDACTED]',
        })),
      },
      null,
      2
    );
  },

  /**
   * Import a configuration document. Credentials are always refused from an import —
   * they must be re-entered through the provider form so the change is audited.
   */
  async importConfig(actor: SystemUser | null, raw: string): Promise<{ ok: boolean; message?: string }> {
    if (!actor || !can(actor, 'settings.edit.platform')) return { ok: false, message: 'Only a Super Admin can import platform configuration.' };
    let parsed: { settings?: Partial<SystemSettings>; providers?: unknown; pricing?: PricingCatalog };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      return { ok: false, message: 'That file is not valid JSON.' };
    }
    if (!parsed || typeof parsed !== 'object') return { ok: false, message: 'Unrecognised configuration document.' };
    await sleep(400);
    setState((prev) => ({
      settings: parsed.settings ? ({ ...prev.settings, ...parsed.settings } as SystemSettings) : prev.settings,
      pricing: parsed.pricing?.items?.length ? parsed.pricing : prev.pricing,
    }));
    auditService.append({
      actorId: actor.id,
      actorName: actor.name,
      actorTier: actor.tier,
      action: 'settings.imported',
      entity: 'SystemSettings',
      severity: 'critical',
      ip: actor.lastLoginIp ?? '0.0.0.0',
      detail: `Imported configuration (${Object.keys(parsed).join(', ')}). Provider credentials were not imported and must be re-entered.`,
    });
    return { ok: true, message: 'Configuration imported. Provider credentials must be re-entered manually.' };
  },

  /* ------------------------------ per-user prefs ------------------------------ */

  notificationPrefs(userId: string): NotificationPreferences {
    const s = getSnapshot();
    return s.notificationPrefs[userId] ?? defaultPrefs();
  },

  setNotificationPrefs(userId: string, prefs: NotificationPreferences, actor?: SystemUser | null): void {
    setState((prev) => ({ notificationPrefs: { ...prev.notificationPrefs, [userId]: prefs } }));
    auditService.append({
      actorId: actor?.id ?? userId,
      actorName: actor?.name ?? 'User',
      actorTier: actor?.tier ?? 'user',
      action: 'preferences.notifications.updated',
      entity: 'NotificationPreferences',
      entityId: userId,
      severity: 'info',
      ip: actor?.lastLoginIp ?? '0.0.0.0',
      detail: `Digest ${prefs.digestFrequency}; quiet hours ${prefs.quietHoursEnabled ? `${prefs.quietHoursStart}–${prefs.quietHoursEnd}` : 'off'}`,
    });
  },

  appearance(): AppearanceSettings {
    return getSnapshot().appearance;
  },

  setAppearance(patch: Partial<AppearanceSettings>): void {
    setState((prev) => ({ appearance: { ...prev.appearance, ...patch } }));
  },

  /* --------------------------------- pricing --------------------------------- */

  pricing(): PricingCatalog {
    return getSnapshot().pricing;
  },

  async updatePricing(actor: SystemUser | null, patch: Partial<PricingCatalog>): Promise<{ ok: boolean; message?: string }> {
    const local = async () => {
      if (!actor || !can(actor, 'pricing.edit')) return { ok: false, message: 'Only the Super Admin can adjust prices.' };
      if (patch.vatRatePct !== undefined && (patch.vatRatePct < 0 || patch.vatRatePct > 40)) {
        return { ok: false, message: 'VAT rate must be between 0 and 40%.' };
      }
      if (patch.items) {
        const bad = patch.items.find((i) => i.unitPriceKes < 0 || i.overageRateKes < 0 || (i.backupRateKes ?? 0) < 0 || (i.perPageKes ?? 0) < 0);
        if (bad) return { ok: false, message: `Rates for "${bad.name}" cannot be negative.` };
      }
      if (patch.bundles) {
        const badBundle = patch.bundles.find((b) => b.priceKes < 0);
        if (badBundle) return { ok: false, message: `Bundle price for "${badBundle.name}" cannot be negative.` };
      }
      const before = getSnapshot().pricing;
      setState((prev) => ({ pricing: { ...prev.pricing, ...patch } }));
      // Audit the exact old -> new movements, not just the touched keys.
      const changes: string[] = [];
      if (patch.items) {
        for (const next of patch.items) {
          const prev = before.items.find((i) => i.id === next.id);
          if (!prev) continue;
          for (const field of ['unitPriceKes', 'overageRateKes', 'backupRateKes', 'perPageKes'] as const) {
            const was = prev[field];
            const now = next[field];
            if (was !== now) changes.push(`${next.id} ${field} ${was ?? '—'}→${now ?? '—'}`);
          }
        }
      }
      if (patch.bundles) {
        for (const next of patch.bundles) {
          const prev = before.bundles.find((b) => b.id === next.id);
          if (prev && prev.priceKes !== next.priceKes) changes.push(`${next.id} price ${prev.priceKes}→${next.priceKes}`);
        }
      }
      for (const key of ['vatRatePct', 'setupFeeKes', 'monthlyAccessFeeKes', 'batchLabel', 'confirmedFromProposal'] as const) {
        if (patch[key] !== undefined && before[key] !== patch[key]) changes.push(`${key} ${String(before[key])}→${String(patch[key])}`);
      }
      auditService.append({
        actorId: actor.id,
        actorName: actor.name,
        actorTier: actor.tier,
        action: 'pricing.updated',
        entity: 'PricingCatalog',
        severity: 'critical',
        ip: actor.lastLoginIp ?? '0.0.0.0',
        detail: changes.length ? `Price adjustment — ${changes.slice(0, 12).join('; ')}${changes.length > 12 ? `; +${changes.length - 12} more` : ''}` : 'Pricing catalogue saved without changes',
      });
      return { ok: true, message: 'Pricing catalogue updated.' };
    };
    return apiOr('/api/pricing', { method: 'PATCH', body: patch }, local, { syncLocal: true }).then((r) => r.data);
  },

  resetPricing(actor: SystemUser | null): { ok: boolean; message?: string } {
    if (!actor || !can(actor, 'pricing.edit')) return { ok: false, message: 'Only a Super Admin can reset pricing.' };
    setState({ pricing: pricingCatalog });
    auditService.append({
      actorId: actor.id,
      actorName: actor.name,
      actorTier: actor.tier,
      action: 'pricing.reset',
      entity: 'PricingCatalog',
      severity: 'critical',
      ip: actor.lastLoginIp ?? '0.0.0.0',
      detail: 'Pricing catalogue reset to the shipped KYC/KYB proposal defaults',
    });
    return { ok: true, message: 'Pricing reset to defaults.' };
  },

  /** Health summary shown on the Super Admin dashboard. */
  health(actor: SystemUser | null): { label: string; ok: boolean; detail: string; severity: 'info' | 'warning' | 'danger' }[] {
    const s = getSnapshot();
    if (!actor || !can(actor, 'settings.view')) return [];
    const out: { label: string; ok: boolean; detail: string; severity: 'info' | 'warning' | 'danger' }[] = [];

    const sandboxProviders = s.providerConfigs.filter((p) => p.environment === 'sandbox' && p.enabled);
    out.push({
      label: 'Providers on sandbox tenants',
      ok: sandboxProviders.length === 0,
      detail: sandboxProviders.length ? `${sandboxProviders.map((p) => p.name).join(', ')} still pointing at sandbox` : 'All enabled providers are on live tenants',
      severity: sandboxProviders.length ? 'warning' : 'info',
    });

    const degraded = s.providerConfigs.filter((p) => p.status === 'Degraded' || p.status === 'Offline');
    out.push({
      label: 'Gateway health',
      ok: degraded.length === 0,
      detail: degraded.length ? `${degraded.map((p) => `${p.name} (${p.status})`).join(', ')}` : 'All gateways reporting healthy',
      severity: degraded.length ? 'warning' : 'info',
    });

    const expiring = s.apiKeys.filter((k) => k.status === 'active' && k.expiresAt && new Date(k.expiresAt).getTime() - Date.now() < 60 * 86400_000);
    out.push({
      label: 'API keys expiring within 60 days',
      ok: expiring.length === 0,
      detail: expiring.length ? expiring.map((k) => `${k.label} (${new Date(k.expiresAt!).toLocaleDateString('en-KE')})`).join(', ') : 'No keys close to expiry',
      severity: expiring.length ? 'warning' : 'info',
    });

    const noMfa = s.users.filter((u) => u.status === 'Active' && s.settings.security.mfaRequiredFor.includes(u.tier) && !u.mfaEnabled);
    out.push({
      label: 'MFA enforcement',
      ok: noMfa.length === 0,
      detail: noMfa.length ? `${noMfa.map((u) => u.name).join(', ')} must enrol MFA` : 'Every privileged account has MFA enrolled',
      severity: noMfa.length ? 'danger' : 'info',
    });

    const backupAgeDays = (Date.now() - new Date(s.settings.backup.lastSnapshotAt).getTime()) / 86400_000;
    out.push({
      label: 'Last backup',
      ok: backupAgeDays < 2,
      detail: `${backupAgeDays < 1 ? 'Today' : `${Math.floor(backupAgeDays)} day(s) ago`} — ${s.settings.backup.snapshotSchedule} schedule, ${s.settings.backup.retentionCount} retained`,
      severity: backupAgeDays < 2 ? 'info' : 'danger',
    });

    out.push({
      label: 'Pricing catalogue',
      ok: (() => {
        const total = s.pricing.items.length;
        const confirmed = s.pricing.items.filter((i) => i.confirmedFromProposal).length;
        return confirmed === total && s.pricing.confirmedFromProposal;
      })(),
      detail: (() => {
        const total = s.pricing.items.length;
        const confirmed = s.pricing.items.filter((i) => i.confirmedFromProposal).length;
        return confirmed === total
          ? 'All rates confirmed against the 2026 financial proposal'
          : `${confirmed} of ${total} rates confirmed from the proposal (batch 0–500); ${total - confirmed} still provisional`;
      })(),
      severity: s.pricing.items.every((i) => i.confirmedFromProposal) && s.pricing.confirmedFromProposal ? 'info' : 'warning',
    });

    out.push({
      label: 'Environment',
      ok: s.settings.platform.environment === 'production',
      detail: `Running in ${s.settings.platform.environment}${s.settings.platform.maintenanceMode ? ' · maintenance mode ON' : ''}`,
      severity: s.settings.platform.environment === 'production' ? 'info' : 'warning',
    });

    return out;
  },
};

function defaultPrefs(): NotificationPreferences {
  return {
    matrix: {
      'case.assigned': { inApp: true, email: true, sms: false, webhook: false },
      'case.updated': { inApp: true, email: false, sms: false, webhook: false },
      'report.ready': { inApp: true, email: true, sms: false, webhook: true },
      'payment.success': { inApp: true, email: true, sms: false, webhook: false },
      'payment.failed': { inApp: true, email: true, sms: true, webhook: true },
      'wallet.low': { inApp: true, email: true, sms: true, webhook: false },
      'quota.warning': { inApp: true, email: true, sms: false, webhook: false },
      'provider.outage': { inApp: true, email: true, sms: true, webhook: true },
      'security.alert': { inApp: true, email: true, sms: true, webhook: true },
      'login.newDevice': { inApp: true, email: true, sms: true, webhook: false },
      'digest.weekly': { inApp: true, email: true, sms: false, webhook: false },
    },
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '06:00',
    digestFrequency: 'weekly',
    smsNumber: '',
    smsVerified: false,
    webhookUrl: '',
    webhookSecret: '',
  };
}
