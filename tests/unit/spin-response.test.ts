import { createRequire } from 'node:module';
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoBanner } from '../../src/components/common/DemoBanner';
import { ErrorBoundary } from '../../src/components/common/ErrorBoundary';
import { PrintReport } from '../../src/components/report/PrintReport';
import { Screen4_IdentityProfile } from '../../src/components/screens/Screen4_IdentityProfile';
import { Screen5_DetailedReport } from '../../src/components/screens/Screen5_DetailedReport';
import { canCloseSearch } from '../../src/components/interactive/SearchSimulationModal';
import { AppDataProvider } from '../../src/context/AppDataContext';
import { RouterProvider } from '../../src/context/RouterContext';
import { buildFullReportPdf, buildSummaryPdf } from '../../src/lib/reports';
import { hasReportSection, reportAmount, reportBoolean, reportScore, reportStatus } from '../../src/lib/report-values';
import { dossierForQuery, dossierToProfile } from '../../src/data/dossier';
import { SPIN_MODULES } from '../../src/data/spinModules';
import { getSnapshot, resetWorkspace, setState } from '../../src/services/db';
import * as http from '../../src/services/http';
import { searchService } from '../../src/services/search.service';
import { normalizeResponse, search } from '../../server/spin.mjs';
import { dossierFromSpinResult } from '../../server/spin-dossier.mjs';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string, options?: { url?: string }) => { window: Window & typeof globalThis };
};
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
const testGlobals = globalThis as typeof globalThis & {
  window: Window & typeof globalThis;
  document: Document;
  HTMLElement: typeof HTMLElement;
  HTMLDivElement: typeof HTMLDivElement;
  Node: typeof Node;
};
Object.assign(testGlobals, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  HTMLDivElement: dom.window.HTMLDivElement,
  Node: dom.window.Node,
  IS_REACT_ACT_ENVIRONMENT: true,
});
dom.window.HTMLElement.prototype.scrollIntoView = () => {};

const originalBanner = import.meta.env.VITE_DEMO_BANNER;
let root: Root | undefined;
let container: HTMLDivElement | undefined;

const render = (node: ReactNode) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
};

const unmount = () => {
  if (root) act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
};

afterEach(() => {
  unmount();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetWorkspace();
  vi.stubEnv('VITE_DEMO_BANNER', originalBanner ?? '');
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubEnv('VITE_DEMO_BANNER', originalBanner ?? '');
});

describe('Spin response normalization', () => {
  it('normalizes the analytics envelope', () => {
    expect(normalizeResponse({ code: '200.001', data: { subject: 'verified' } })).toEqual({
      ok: true,
      providerCode: '200.001',
      message: '',
      data: { subject: 'verified' },
    });
  });

  it('normalizes the verification envelope', () => {
    expect(normalizeResponse({ response_code: '200', success: true, message: 'Match found', data: { subject: 'verified' } })).toEqual({
      ok: true,
      providerCode: '200',
      message: 'Match found',
      data: { subject: 'verified' },
    });
  });

  it('maps analytics failures and empty envelopes to honest errors', () => {
    expect(normalizeResponse({ code: '400.001', message: 'Invalid identifier', data: null })).toEqual({
      ok: false,
      providerCode: '400.001',
      message: 'Invalid identifier',
      data: null,
    });
    expect(normalizeResponse(null)).toEqual({
      ok: false,
      providerCode: null,
      message: 'Spin returned an empty response.',
      data: null,
    });
  });

  it('maps a normalized Spin success into a renderable dossier with provenance', () => {
    const module = SPIN_MODULES.find((entry) => entry.searchType === 'identity')!;
    const normalized = normalizeResponse({
      code: '200.001',
      data: {
        id_number: '23456789',
        first_name: 'Amina',
        other_name: 'Hassan',
        surname: 'Yusuf',
        gender: 'Female',
        phone_number: '0722118843',
        match_status: 'MATCH',
        confidence: 0.987,
        registry_confidence: 0.991,
      },
    });
    const dossier = dossierFromSpinResult({
      result: normalized,
      module,
      item: { id: 'kyc-id', unitPriceKes: 30 },
      owner: { name: 'Sarah Wanjiku', tier: 'user' },
      identifier: '23456789',
    });
    expect(dossier.subject).toMatchObject({ fullName: 'Amina Hassan Yusuf', idNumber: '23456789', phone: '0722118843' });
    expect(dossier.sections[0]).toMatchObject({ provider: 'Spin Mobile · IPRS Identity Verification', confidence: 98.7, rawResponse: { providerCode: '200.001', id_number: '23456789' } });
    expect(dossier.sections).toHaveLength(1);
    expect(dossier.employment).toEqual([]);
    expect(dossier.subject.registrationSerial).toBeUndefined();
    expect(dossierForQuery('35118740').subject.registrationSerial).toBeUndefined();
     expect(dossier.tax.status).toBe('Unknown');
     expect(dossier.tax.outstandingKes).toBeNull();
     expect(dossier.mobileMoney.status).toBe('Unknown');
     expect(dossier.mobileMoney.dailyLimitKes).toBeNull();
     expect(dossier.credit.listingStatus).toBe('Unknown');
     expect(dossier.credit.score).toBeNull();
     expect(dossier.utility.accountStatus).toBe('Unknown');
     expect(dossier.utility.avgMonthlyBillKes).toBeNull();
     expect(dossier.subject.photoMatchScore).toBeNull();
     expect(dossier.sections[0].confidence).toBe(98.7);
     expect(dossier.risk.score).toBeNull();
    expect(dossierToProfile(dossier).providers).toMatchObject({ mpesa: { status: 'Unknown' }, employer: { status: 'Unknown' }, crb: { status: 'Unknown' }, kplc: { status: 'Unknown' } });
    expect(dossier.events[0]).toMatchObject({ provider: 'Spin Mobile', responseCode: 200, costKes: 30 });
    expect(dossier.risk.reviewRequired).toBe(true);
  });

  it('keeps unknown provider values out of report, print, and PDF output', () => {
    const module = SPIN_MODULES.find((entry) => entry.searchType === 'identity')!;
    const dossier = dossierFromSpinResult({
      result: normalizeResponse({ code: '200.001', data: { id_number: '23456789', first_name: 'Amina', surname: 'Yusuf' } }),
      module,
      item: { id: 'kyc-id', unitPriceKes: 30 },
      owner: { name: 'Sarah Wanjiku', tier: 'user' },
      identifier: '23456789',
    });
     expect(dossier.sections[0].confidence).toBeNull();
     const settings = getSnapshot().settings;
    const fullPdf = new TextDecoder().decode(buildFullReportPdf(dossier, settings, { maskPii: false }).toBytes());
    const summaryPdf = new TextDecoder().decode(buildSummaryPdf(dossier, settings).toBytes());
    const printRoot = document.createElement('div');
    printRoot.id = 'print-root';
    document.body.appendChild(printRoot);
    render(createElement(PrintReport, { dossier, settings, mask: false }));
    const printText = document.body.textContent ?? '';
    for (const output of [fullPdf, summaryPdf, printText]) {
      expect(output).toContain('Unavailable');
       expect(output).not.toContain('KES 0');
       expect(output).not.toContain('0 / 900');
       expect(output).not.toContain('0%');
       expect(output).not.toContain('Medium risk');
       expect(output).not.toContain('not compliant');
       expect(output).not.toContain('181,500');
    }
    expect(reportAmount(0, false)).toBe('Unavailable');
    expect(reportBoolean(null, false)).toBe('Unknown');
    expect(reportStatus('Unknown', false)).toBe('Unavailable');
    expect(reportScore(0, false, 900)).toBe('Unavailable');
    printRoot.remove();
  });

  it('preserves provider-present values in report conversion', () => {
    const module = SPIN_MODULES.find((entry) => entry.searchType === 'MPESAKYCCHECK')!;
    const dossier = dossierFromSpinResult({
      result: normalizeResponse({ code: '200.001', data: { status: 'Active', account_name: 'Amina Yusuf', daily_limit: 5000, avg_monthly_turnover_kes: 5000, kyc_tier: 'Tier 3', confidence: 0.99 } }),
      module,
      item: { id: 'kyc-mpesa', unitPriceKes: 30 },
      owner: { name: 'Sarah Wanjiku', tier: 'user' },
      identifier: '0722118843',
    });
    const summary = new TextDecoder().decode(buildSummaryPdf(dossier, getSnapshot().settings).toBytes());
    expect(dossier.mobileMoney).toMatchObject({ status: 'Active', accountName: 'Amina Yusuf', dailyLimitKes: 5000, kycTier: 'Tier 3' });
    expect(dossierToProfile(dossier).providers.mpesa).toMatchObject({ verified: true, status: 'Verified', accountName: 'Amina Yusuf' });
    expect(summary).toContain('Active');
    expect(summary).toContain('KES 5,000');
  });

  it('keeps explicit nulls unknown across adapter, profile, screens, print, and PDFs', () => {
    const module = SPIN_MODULES.find((entry) => entry.searchType === 'Metropol')!;
    const dossier = dossierFromSpinResult({
      result: normalizeResponse({
        code: '200.001',
        data: {
          status: 'MATCH',
          credit_score: null,
          total_facilities: null,
          total_outstanding: null,
          total_limit: null,
          utilisation_pct: null,
          confidence: null,
          photo_match: null,
        },
      }),
      module,
      item: { id: 'kyc-metropol-score', unitPriceKes: 85 },
      owner: { name: 'Sarah Wanjiku', tier: 'user' },
      identifier: 'fixture',
    });

    expect(dossier.credit).toMatchObject({
      score: null,
      totalFacilities: null,
      totalOutstandingKes: null,
      totalLimitKes: null,
      utilisationPct: null,
    });
    expect(dossier.sections[0].confidence).toBeNull();
    expect(dossier.sections[0].latencyMs).toBeNull();
    expect(dossier.events[0].latencyMs).toBeNull();
    expect(dossier.subject.photoMatchScore).toBeNull();
    expect(dossier.risk).toMatchObject({ score: null, band: null });
    expect(dossierToProfile(dossier)).toMatchObject({ riskScore: null, trustLevel: 'Unknown' });
    expect(reportScore(dossier.credit.score, true, 900)).toBe('Unavailable');

    const settings = getSnapshot().settings;
    const fullPdf = new TextDecoder().decode(buildFullReportPdf(dossier, settings, { maskPii: false }).toBytes());
    const summaryPdf = new TextDecoder().decode(buildSummaryPdf(dossier, settings).toBytes());
    const printRoot = document.createElement('div');
    printRoot.id = 'print-root';
    document.body.appendChild(printRoot);
    const printMount = createRoot(printRoot);
    act(() => printMount.render(createElement(PrintReport, { dossier, settings, mask: false })));
    const printText = document.body.textContent ?? '';
    for (const output of [fullPdf, summaryPdf, printText]) {
      expect(output).toContain('Unavailable');
      expect(output).not.toContain('null%');
      expect(output).not.toContain('null ms');
      expect(output).not.toContain('null / 900');
      expect(output).not.toContain('0 / 900');
      expect(output).not.toContain('0%');
      expect(output).not.toContain('Medium risk');
    }
    act(() => printMount.unmount());
    printRoot.remove();

    const user = getSnapshot().users[0];
    if (!user) throw new Error('test user missing');
    setState({ currentUserId: user.id, activeDossier: dossier, dossierCache: { [dossier.id]: dossier } });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));

    render(createElement(AppDataProvider, null, createElement(RouterProvider, null, createElement(Screen4_IdentityProfile))));
    const profileText = document.body.textContent ?? '';
    expect(profileText).toContain('Risk unavailable · Unknown');
    expect(profileText).toContain('Photo match unavailable');
    expect(profileText).not.toContain('null%');
    expect(profileText).not.toContain('null ms');
    expect(profileText).not.toContain('0%');
    expect(profileText).not.toContain('Medium risk');
    unmount();

    render(createElement(AppDataProvider, null, createElement(Screen5_DetailedReport)));
    const reportText = document.body.textContent ?? '';
    expect(reportText).toContain('Unavailable');
    expect(reportText).not.toContain('null%');
    expect(reportText).not.toContain('null / 900');
    expect(reportText).not.toContain('0 / 900');
    expect(reportText).not.toContain('0%');
    expect(reportText).not.toContain('Medium risk');
  });

  it('matches hidden Spin provider families without unrelated substring matches', () => {
    const families = [
      ['Metropol', 'credit'],
      ['HAKIKISHA', 'hakikisha'],
      ['FULLKYC', 'kra'],
      ['FULLKYC', 'employer'],
      ['sim_swap', 'simswap'],
      ['PHONESEARCH', 'phonesearch'],
    ] as const;
    for (const [searchType, family] of families) {
      const module = SPIN_MODULES.find((entry) => entry.searchType === searchType)!;
      const dossier = dossierFromSpinResult({
        result: normalizeResponse({ code: '200.001', data: { status: 'MATCH' } }),
        module,
        item: { id: module.pricedItemId ?? 'test', unitPriceKes: 30 },
        owner: { name: 'Sarah Wanjiku', tier: 'user' },
        identifier: 'fixture',
      });
      expect(hasReportSection(dossier, [family])).toBe(true);
    }
    const identityModule = SPIN_MODULES.find((entry) => entry.searchType === 'identity')!;
    const identityDossier = dossierFromSpinResult({
      result: normalizeResponse({ code: '200.001', data: { status: 'MATCH' } }),
      module: identityModule,
      item: { id: 'kyc-id', unitPriceKes: 30 },
      owner: { name: 'Sarah Wanjiku', tier: 'user' },
      identifier: 'fixture',
    });
    expect(hasReportSection(identityDossier, ['credit'])).toBe(false);
    expect(hasReportSection(identityDossier, ['kra'])).toBe(false);
  });

  it('maps a normalized Spin failure to an error before dossier success', () => {
    const module = SPIN_MODULES.find((entry) => entry.searchType === 'identity')!;
    const normalized = normalizeResponse({ code: '402.001', message: 'Consent required', data: null });
    expect(() => dossierFromSpinResult({
      result: normalized,
      module,
      item: { id: 'kyc-id', unitPriceKes: 30 },
      owner: { name: 'Sarah Wanjiku', tier: 'user' },
      identifier: '23456789',
    })).toThrow('Consent required');
  });
  it('rejects an HTTP provider failure with its provider message', async () => {
    vi.stubEnv('SPIN_CONSUMER_KEY', 'test-key');
    vi.stubEnv('SPIN_CONSUMER_SECRET', 'test-secret');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'test-token', expires: 4102444800 }) })
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ code: '502.001', message: 'Provider unavailable', data: null }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(search('kyc-id', '12345678', { consent: true })).rejects.toThrow('Provider unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('user-facing search routing', () => {
  it('keeps the search overlay locked while scanning', () => {
    expect(canCloseSearch(true)).toBe(false);
    expect(canCloseSearch(false)).toBe(true);
  });

  it('uses the session-backed provider route when the API is available', async () => {
    vi.spyOn(http, 'getApiMode').mockReturnValue('api');
    const dossier = dossierForQuery('12345678', 'John Mwangi Kamau', '12345678');
    const post = vi.spyOn(http.api, 'post').mockResolvedValue({ ok: true, result: dossier, reference: 'DOS-test', costKes: 30 });
    const outcome = await searchService.run({
      actor: getSnapshot().users[0] ?? null,
      fullName: 'John Mwangi Kamau',
      idNumber: '12345678',
      phone: '0712345678',
      checkIds: ['kyc-id'],
    });
    expect(post).toHaveBeenCalledWith('/api/v1/verify/session', expect.objectContaining({ search_type: 'identity', consent: true }));
    expect(outcome).toMatchObject({ ok: true, costKes: 30, reference: 'DOS-test' });
  });

  it('uses the deterministic simulation when the backend is unavailable', async () => {
    vi.spyOn(http, 'getApiMode').mockReturnValue('api');
    const post = vi.spyOn(http.api, 'post').mockRejectedValue(new Error('backend offline'));
    const fallback = vi.spyOn(http, 'fallbackToLocal').mockImplementation(() => undefined);
    const outcome = await searchService.run({
      actor: getSnapshot().users[0] ?? null,
      fullName: 'John Mwangi Kamau',
      idNumber: '12345678',
      phone: '0712345678',
      checkIds: ['kyc-id'],
    });
    expect(post).toHaveBeenCalledWith('/api/v1/verify/session', expect.objectContaining({ consent: true }));
    expect(fallback).toHaveBeenCalledOnce();
    expect(outcome.ok).toBe(true);
    expect(outcome.dossier?.dataMode).toBe('simulated');
    if (!outcome.dossier) throw new Error('Simulation dossier missing.');
    render(createElement(AppDataProvider, null, createElement(RouterProvider, null, createElement(Screen4_IdentityProfile))));
    expect(document.body.textContent).toContain('SIMULATED VERIFICATION');
    unmount();
    const pdf = new TextDecoder().decode(buildFullReportPdf(outcome.dossier, getSnapshot().settings, { maskPii: false }).toBytes());
    expect(pdf).toContain('SIMULATED VERIFICATION');
  });

  it('does not replace a backend 401 with simulated verification data', async () => {
    vi.spyOn(http, 'getApiMode').mockReturnValue('api');
    vi.spyOn(http.api, 'post').mockRejectedValue(new http.ApiError('Request failed: 401', 401, { ok: false, message: 'Not authenticated.' }));
    const fallback = vi.spyOn(http, 'fallbackToLocal');

    const outcome = await searchService.run({
      actor: getSnapshot().users[0] ?? null,
      fullName: 'John Mwangi Kamau',
      idNumber: '12345678',
      phone: '0712345678',
      checkIds: ['kyc-id'],
    });

    expect(outcome).toEqual({ ok: false, message: 'Request failed: 401' });
    expect(fallback).not.toHaveBeenCalled();
  });
});

describe('frontend resilience primitives', () => {
  it('does not render the demo banner when the flag is empty', () => {
    vi.stubEnv('VITE_DEMO_BANNER', '');
    render(createElement(DemoBanner));
    expect(document.body.textContent).toBe('');
  });

  it('renders the demo banner when the flag is set', () => {
    vi.stubEnv('VITE_DEMO_BANNER', 'Demo environment — data is simulated');
    render(createElement(DemoBanner));
    expect(document.body.textContent).toContain('Demo environment — data is simulated');
  });

  it('renders the exact fallback after a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Thrower = () => {
      throw new Error('child failed');
    };
    render(
      createElement(
        ErrorBoundary,
        null,
        createElement(Thrower),
      ),
    );
    expect(document.body.textContent).toContain('Something broke on this screen');
  });
});
