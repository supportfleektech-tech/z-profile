import type { Dossier, SystemUser, UsageRecord } from '../types';
import { getSnapshot, setState } from './db';
import { auditService } from './auth.service';
import { walletService } from './wallet.service';
import { providerService } from './provider.service';
import { can } from '../auth/permissions';
import { dossierForQuery, dossierToProfile } from '../data/dossier';
import { priceChecks } from '../data/pricing';
import { sleep, uid } from '../lib/format';

/**
 * Search orchestration: consent → pricing → wallet debit → provider fan-out → dossier
 * assembly → audit. This is the single place a verification is charged and recorded.
 */

export interface SearchRequest {
  actor: SystemUser | null;
  fullName: string;
  idNumber: string;
  phone: string;
  county?: string;
  dob?: string;
  /** Pricing catalogue item ids to run. */
  checkIds: string[];
  consentRef?: string;
  caseId?: string;
}

export interface SearchOutcome {
  ok: boolean;
  message?: string;
  dossier?: Dossier;
  costKes?: number;
  reference?: string;
  consentRef?: string;
  stages?: { label: string; ok: boolean; ms: number }[];
}

/** Which provider serves which catalogue item. */
const ITEM_PROVIDER: Record<string, string> = {
  'kyc-id': 'civil',
  'kyc-kra': 'p-kra',
  'kyc-mpesa': 'p-mpesa',
  'kyc-crb': 'p-crb',
  'kyc-address': 'p-kplc',
  'kyc-employer': 'p-employer',
  'kyc-criminal': 'p-court',
  'kyc-pep': 'p-screen',
  'kyc-deceased': 'civil',
  'kyb-registry': 'p-brs',
  'kyb-directors': 'p-brs',
  'kyb-bo': 'p-brs',
  'kyb-tax': 'p-kra',
  'kyb-crb': 'p-crb',
  'kyb-litigation': 'p-court',
  'kyb-licence': 'p-brs',
};

const ITEM_PROVIDER_NAME: Record<string, string> = {
  civil: 'IPRS Civil Registration',
  'p-court': 'Judiciary Records',
  'p-screen': 'Global Watchlist Aggregator',
};

export const searchService = {
  price(checkIds: string[]): number {
    return priceChecks(checkIds).total;
  },

  /** Pre-flight check surfaced in the New Search UI before the wallet is touched. */
  preflight(actor: SystemUser | null, checkIds: string[]): { ok: boolean; reason?: string; costKes: number; balance: number } {
    const s = getSnapshot();
    const cost = searchService.price(checkIds);
    if (!actor) return { ok: false, reason: 'You are not signed in.', costKes: cost, balance: 0 };
    if (!can(actor, 'search.run')) return { ok: false, reason: 'Your role does not permit running searches.', costKes: cost, balance: 0 };
    if (checkIds.length === 0) return { ok: false, reason: 'Select at least one check.', costKes: 0, balance: 0 };
    const wallet = s.wallets.find((w) => w.userId === actor.id);
    const balance = wallet?.balance ?? 0;
    if (balance < cost && !wallet?.overdraftAllowed && s.settings.billing.blockSearchOnNegativeBalance) {
      return { ok: false, reason: `Insufficient wallet balance — this search costs KES ${cost.toLocaleString('en-KE')} and you have KES ${balance.toLocaleString('en-KE')}.`, costKes: cost, balance };
    }
    const disabledProviders = checkIds
      .map((id) => ITEM_PROVIDER[id])
      .filter(Boolean)
      .map((pid) => s.providerConfigs.find((c) => c.id === pid))
      .filter((c) => c && !c.enabled);
    if (disabledProviders.length) {
      return { ok: false, reason: `Disabled gateway(s): ${disabledProviders.map((p) => p!.name).join(', ')}.`, costKes: cost, balance };
    }
    return { ok: true, costKes: cost, balance };
  },

  async run(req: SearchRequest): Promise<SearchOutcome> {
    const s = getSnapshot();
    const pre = searchService.preflight(req.actor, req.checkIds);
    if (!pre.ok || !req.actor) return { ok: false, message: pre.reason ?? 'Search rejected.' };
    const actor: SystemUser = req.actor;

    const reference = `SRCH-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`;
    const consentRef = req.consentRef ?? `CNS-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`;
    const stages: { label: string; ok: boolean; ms: number }[] = [];

    // 1. Consent capture (required by the compliance settings).
    await sleep(240);
    stages.push({ label: 'Consent captured & lawful basis recorded', ok: true, ms: 240 });

    // 2. Price and debit the wallet.
    const price = priceChecks(req.checkIds);
    const debit = walletService.debitWallet(req.actor.id, price.total, {
      kind: 'search',
      reference,
      description: `${req.checkIds.length} check(s) — ${req.fullName || req.idNumber || req.phone}`,
      meta: { checks: req.checkIds.length, consentRef },
    });
    if (!debit.ok) return { ok: false, message: debit.message };
    stages.push({ label: `Wallet debited KES ${price.total.toLocaleString('en-KE')}`, ok: true, ms: 120 });

    // 3. Fan out to each provider gateway.
    const usageEntries: UsageRecord[] = [];
    for (const itemId of req.checkIds) {
      const providerId = ITEM_PROVIDER[itemId] ?? 'civil';
      const cfg = s.providerConfigs.find((c) => c.id === providerId);
      const providerName = cfg?.name ?? ITEM_PROVIDER_NAME[providerId] ?? providerId;
      const item = s.pricing.items.find((i) => i.id === itemId);
      const ms = Math.round(200 + Math.random() * (cfg?.timeoutMs ? Math.min(cfg.timeoutMs, 2500) : 1200));
      await sleep(Math.min(420, ms / 6));
      const ok = cfg ? cfg.enabled && cfg.status !== 'Offline' : true;
      stages.push({ label: `${providerName} — ${item?.name ?? itemId}`, ok, ms });

      providerService.logRequest({
        providerId: cfg?.id ?? providerId,
        providerName,
        endpoint: cfg ? `${cfg.method} ${cfg.endpointPath}` : 'POST /v1/registry/query',
        actorId: req.actor.id,
        actorName: req.actor.name,
        subjectRef: req.idNumber ? `ID ${req.idNumber}` : req.phone ? `MSISDN ${req.phone}` : `NAME ${req.fullName}`,
        status: ok ? 'success' : 'error',
        httpCode: ok ? 200 : 503,
        latencyMs: ms,
        costKes: ok ? item?.unitPriceKes ?? 0 : 0,
        fieldsRequested: cfg?.fieldMappings.length ?? 6,
        ip: req.actor.lastLoginIp ?? '0.0.0.0',
        errorMessage: ok ? undefined : `${providerName} gateway unavailable`,
      });

      usageEntries.push({
        id: uid('us'),
        at: new Date().toISOString(),
        userId: req.actor.id,
        userName: req.actor.name,
        providerId: cfg?.id ?? providerId,
        providerName,
        checkType: item?.name ?? itemId,
        costKes: ok ? item?.unitPriceKes ?? 0 : 0,
        status: ok ? 'success' : 'failed',
        latencyMs: ms,
        subjectRef: req.idNumber || req.phone || req.fullName,
      });
    }

    // 4. Assemble the dossier.
    await sleep(320);
    const dossier = dossierForQuery(req.idNumber || req.phone || req.fullName, req.fullName, req.idNumber);
    dossier.id = `DOS-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`;
    dossier.reportId = `IPRS-R-${new Date().getFullYear()}-${req.idNumber || 'UNKNOWN'}`;
    dossier.generatedAt = new Date().toISOString();
    dossier.attestation.preparedBy = req.actor.name;
    dossier.attestation.preparedByTier = req.actor.tier;
    if (req.county) dossier.subject.county = req.county;
    if (req.phone) dossier.subject.phone = req.phone;
    if (req.fullName) dossier.subject.fullName = req.fullName;
    if (req.idNumber) dossier.subject.idNumber = req.idNumber;

    const profile = dossierToProfile(dossier);

    // 5. Persist results, usage, activity and notifications.
    setState((prev) => ({
      activeDossier: dossier,
      dossierCache: { ...prev.dossierCache, [dossier.id]: dossier },
      usage: [...usageEntries, ...prev.usage].slice(0, 2000),
      searchHistory: [
        { query: req.idNumber || req.phone || req.fullName, at: new Date().toISOString(), subject: dossier.subject.fullName, costKes: price.total, userId: actor.id },
        ...prev.searchHistory,
      ].slice(0, 50),
      activities: [
        { id: uid('a'), title: `Identity Report — ${dossier.subject.fullName}`, time: 'Just now', status: 'Completed', type: 'identity', userId: actor.id },
        ...prev.activities,
      ].slice(0, 20),
      notifications: [
        {
          id: uid('n'),
          title: dossier.risk.reviewRequired ? 'High-risk subject flagged' : 'Report ready',
          description: dossier.risk.reviewRequired
            ? `${dossier.subject.fullName} scored ${dossier.risk.score}/100 — ${dossier.risk.verdict}. Manual review required.`
            : `Full identity report for ${dossier.subject.fullName} is ready (${dossier.reportId}).`,
          time: 'Just now',
          category: dossier.risk.reviewRequired ? 'Security' : 'Reports',
          type: dossier.risk.reviewRequired ? 'danger' : 'info',
          read: false,
          userId: actor.id,
        },
        ...prev.notifications,
      ],
      lastSearch: { query: req.idNumber || req.phone || req.fullName, profile, timestamp: dossier.generatedAt, riskScore: dossier.risk.score },
    }));

    auditService.append({
      actorId: actor.id,
      actorName: actor.name,
      actorTier: actor.tier,
      action: 'search.executed',
      entity: 'Search',
      entityId: reference,
      severity: dossier.risk.reviewRequired ? 'warning' : 'info',
      ip: actor.lastLoginIp ?? '0.0.0.0',
      detail: `${dossier.subject.fullName} — ${req.checkIds.length} checks, KES ${price.total.toLocaleString('en-KE')}, score ${dossier.risk.score}/100, consent ${consentRef}`,
    });

    return { ok: true, dossier, costKes: price.total, reference, consentRef, stages };
  },
};

/** Legacy shape still consumed by older screens. */
export interface LegacySearchResult {
  query: string;
  profile: ReturnType<typeof dossierToProfile>;
  timestamp: string;
  riskScore: number;
}
