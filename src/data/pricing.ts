import type { PricingCatalog, PricingPlan } from '../types';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  KYC / KYB FINANCIAL PROPOSAL 2026 — pricing source of truth
 *  Band in use: 0 – 500 verifications (per instruction, higher bands are NOT used)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ⚠ PLACEHOLDER FIGURES — replace with the numbers from
 *    "KYC KYB Financial Proposal 2026.pdf".
 *
 *    The PDF was not present in the repository when this was built. Every consumer
 *    (Pricing & Tiers screen, Billing, wallet debit rates, cost calculator, PDF price
 *    schedule, Admin pricing editor) reads from THIS FILE ONLY, so updating the real
 *    proposal is a single-file edit. Set `confirmedFromProposal: true` once the figures
 *    have been transcribed — the UI stops showing the "provisional" banner.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export const pricingCatalog: PricingCatalog = {
  confirmedFromProposal: false,
  proposalRef: 'KYC/KYB Financial Proposal 2026 — Schedule A (Batch 0–500)',
  batchLabel: '0 – 500 verifications',
  batchMin: 0,
  batchMax: 500,
  currency: 'KES',
  effectiveDate: '01 January 2026',
  validUntil: '31 December 2026',
  vatRatePct: 16,
  setupFeeKes: 25000,
  monthlyAccessFeeKes: 15000,
  paymentTerms:
    'Monthly in advance. Settlement via M-PESA Paybill, Visa/Mastercard, or EFT. Wallet debits are applied per successful verification. Invoices are net 7 days.',
  paymentChannels: ['M-PESA (STK Push / Paybill 400200)', 'Visa / Mastercard', 'Bank Transfer (EFT)', 'Prepaid Wallet'],

  /* ------------------------------- KYC line items ------------------------------- */
  items: [
    {
      id: 'kyc-id',
      name: 'National ID Verification',
      type: 'kyc',
      description: 'Civil registration match on ID number + name + date of birth, with photo-match score.',
      source: 'IPRS / National Registration Bureau via Spin Mobile',
      unitPriceKes: 50,
      includedInBatch: 500,
      overageRateKes: 58,
      turnaround: 'Real-time (< 3s)',
      confidence: 'High',
    },
    {
      id: 'kyc-kra',
      name: 'KRA PIN Validation',
      type: 'kyc',
      description: 'PIN existence, registration date, tax obligation types, compliance standing and arrears.',
      source: 'Kenya Revenue Authority iTax gateway',
      unitPriceKes: 40,
      includedInBatch: 500,
      overageRateKes: 46,
      turnaround: 'Real-time (< 4s)',
      confidence: 'High',
    },
    {
      id: 'kyc-mpesa',
      name: 'M-PESA Name & Number Match',
      type: 'kyc',
      description: 'MSISDN-to-registered-name match, KYC tier, account tenure and activity band.',
      source: 'Safaricom M-PESA KYC registry',
      unitPriceKes: 30,
      includedInBatch: 500,
      overageRateKes: 35,
      turnaround: 'Real-time (< 2s)',
      confidence: 'High',
    },
    {
      id: 'kyc-crb',
      name: 'CRB Individual Report & Score',
      type: 'kyc',
      description: 'Credit score, listing status, facility schedule, utilisation and adverse listings.',
      source: 'TransUnion CRB Kenya',
      unitPriceKes: 450,
      includedInBatch: 150,
      overageRateKes: 520,
      turnaround: '5 – 15s',
      confidence: 'High',
    },
    {
      id: 'kyc-address',
      name: 'Address & Utility Verification',
      type: 'kyc',
      description: 'Physical address confirmation against a live utility account and billing behaviour.',
      source: 'KPLC / Kenya Power grid API',
      unitPriceKes: 60,
      includedInBatch: 300,
      overageRateKes: 70,
      turnaround: 'Real-time (< 5s)',
      confidence: 'Medium',
    },
    {
      id: 'kyc-employer',
      name: 'Employer Verification',
      type: 'kyc',
      description: 'Current and historical employment, position, contract type and income band.',
      source: 'Corporate payroll registry',
      unitPriceKes: 150,
      includedInBatch: 200,
      overageRateKes: 175,
      turnaround: '1 – 24h (async)',
      confidence: 'Medium',
    },
    {
      id: 'kyc-criminal',
      name: 'Criminal & Court Record Check',
      type: 'kyc',
      description: 'Criminal case history, charge, court, filing date and outcome from judiciary records.',
      source: 'Judiciary / Directorate of Criminal Investigations',
      unitPriceKes: 250,
      includedInBatch: 100,
      overageRateKes: 290,
      turnaround: '2 – 48h (async)',
      confidence: 'Standard',
    },
    {
      id: 'kyc-pep',
      name: 'PEP & Sanctions Screening',
      type: 'kyc',
      description: 'Politically-exposed-person, UN/OFAC/EU sanctions and adverse-media screening.',
      source: 'Global watchlist aggregator',
      unitPriceKes: 120,
      includedInBatch: 250,
      overageRateKes: 140,
      turnaround: 'Real-time (< 3s)',
      confidence: 'High',
    },
    {
      id: 'kyc-deceased',
      name: 'Deceased Registry Check',
      type: 'kyc',
      description: 'Confirms the subject is not recorded as deceased in the civil registry.',
      source: 'IPRS deaths register',
      unitPriceKes: 45,
      includedInBatch: 500,
      overageRateKes: 52,
      turnaround: 'Real-time (< 3s)',
      confidence: 'High',
    },

    /* ------------------------------- KYB line items ------------------------------- */
    {
      id: 'kyb-registry',
      name: 'Company Registry Search',
      type: 'kyb',
      description: 'Certificate of incorporation, status, registered office, share capital and filings.',
      source: 'Business Registration Service (BRS) / eCitizen',
      unitPriceKes: 350,
      includedInBatch: 120,
      overageRateKes: 400,
      turnaround: '10 – 60s',
      confidence: 'High',
    },
    {
      id: 'kyb-directors',
      name: 'Director & Officer Verification',
      type: 'kyb',
      description: 'Directors, secretary and officers cross-verified against national ID records.',
      source: 'BRS + IPRS cross-match',
      unitPriceKes: 200,
      includedInBatch: 150,
      overageRateKes: 230,
      turnaround: '10 – 60s',
      confidence: 'High',
    },
    {
      id: 'kyb-bo',
      name: 'Beneficial Ownership Register',
      type: 'kyb',
      description: 'Declared beneficial owners, ownership percentages and control chain.',
      source: 'BRS beneficial ownership register',
      unitPriceKes: 180,
      includedInBatch: 150,
      overageRateKes: 210,
      turnaround: '10 – 60s',
      confidence: 'Medium',
    },
    {
      id: 'kyb-tax',
      name: 'Business Tax Compliance',
      type: 'kyb',
      description: 'Corporate KRA PIN standing, VAT obligation, returns filed and outstanding liability.',
      source: 'KRA iTax (entity)',
      unitPriceKes: 120,
      includedInBatch: 200,
      overageRateKes: 140,
      turnaround: 'Real-time (< 5s)',
      confidence: 'High',
    },
    {
      id: 'kyb-crb',
      name: 'CRB Business Report',
      type: 'kyb',
      description: 'Corporate credit score, facility exposure, defaults and listing history.',
      source: 'TransUnion CRB Kenya (bureau business)',
      unitPriceKes: 900,
      includedInBatch: 60,
      overageRateKes: 1035,
      turnaround: '15 – 45s',
      confidence: 'High',
    },
    {
      id: 'kyb-litigation',
      name: 'Litigation & Insolvency Search',
      type: 'kyb',
      description: 'Civil suits, receivership, winding-up petitions and insolvency notices.',
      source: 'Judiciary cause lists + Kenya Gazette',
      unitPriceKes: 300,
      includedInBatch: 100,
      overageRateKes: 345,
      turnaround: '2 – 24h (async)',
      confidence: 'Standard',
    },
    {
      id: 'kyb-licence',
      name: 'Trade Licence Verification',
      type: 'kyb',
      description: 'County single business permit and sector licence validity.',
      source: 'County ePayment portals',
      unitPriceKes: 90,
      includedInBatch: 200,
      overageRateKes: 105,
      turnaround: '5 – 30s',
      confidence: 'Medium',
    },
  ],

  /* ---------------------------------- bundles ---------------------------------- */
  bundles: [
    {
      id: 'bundle-kyc-basic',
      name: 'KYC Basic',
      tagline: 'Fast identity confirmation for onboarding and low-value accounts.',
      itemIds: ['kyc-id', 'kyc-kra', 'kyc-mpesa'],
      priceKes: 105,
    },
    {
      id: 'bundle-kyc-standard',
      name: 'KYC Standard',
      tagline: 'The default onboarding pack for lending, SACCO and fintech KYC.',
      itemIds: ['kyc-id', 'kyc-kra', 'kyc-mpesa', 'kyc-address', 'kyc-deceased'],
      priceKes: 210,
      highlighted: true,
      badge: 'Most Selected',
    },
    {
      id: 'bundle-kyc-comprehensive',
      name: 'KYC Comprehensive',
      tagline: 'Full due diligence with credit, employment, criminal and screening.',
      itemIds: ['kyc-id', 'kyc-kra', 'kyc-mpesa', 'kyc-address', 'kyc-employer', 'kyc-criminal', 'kyc-pep', 'kyc-deceased', 'kyc-crb'],
      priceKes: 1085,
    },
    {
      id: 'bundle-kyb-essential',
      name: 'KYB Essential',
      tagline: 'Corporate onboarding: registry, directors and tax standing.',
      itemIds: ['kyb-registry', 'kyb-directors', 'kyb-tax'],
      priceKes: 620,
    },
    {
      id: 'bundle-kyb-complete',
      name: 'KYB Complete',
      tagline: 'Institutional-grade entity due diligence and ongoing monitoring.',
      itemIds: ['kyb-registry', 'kyb-directors', 'kyb-bo', 'kyb-tax', 'kyb-crb', 'kyb-litigation', 'kyb-licence'],
      priceKes: 2040,
    },
  ],

  notes: [
    'All prices are quoted in Kenya Shillings (KES) and are exclusive of VAT at 16%.',
    'Pricing applies to the 0–500 verification batch. Volumes above 500 are quoted separately.',
    'Per-check charges are debited from the prepaid wallet only on a successful (HTTP 200 + positive match) response. Timeouts and provider errors are not charged.',
    'Asynchronous checks (employer, criminal, litigation) are charged on submission; no further charge applies if the record is returned incomplete.',
    'The monthly platform access fee includes the API gateway, the analyst workspace, case management, report generation and standard support.',
    'A one-off implementation and onboarding fee covers integration, field mapping, UAT and staff training.',
    'Volumes are measured per calendar month and reset on the billing anniversary.',
  ],

  exclusions: [
    'Court file retrieval, certified copies and physical registry visits.',
    'International bureau reports outside Kenya.',
    'Custom data-source onboarding beyond the standard provider catalogue.',
    'Dedicated account management and on-site training beyond two sessions.',
  ],
};

/* ------------------------- derived subscription plans ------------------------- */

/**
 * Subscription tiers for the 0–500 batch. Derived from the catalogue so the two never
 * drift apart. `searches` is the monthly verification allowance inside the band.
 */
export const subscriptionPlans: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 5000,
    yearlyPrice: 4000,
    period: '/month',
    subtitle: 'Sole practitioners & small compliance desks',
    features: [
      'Up to 100 verifications / month',
      'KYC Basic bundle included',
      '1 analyst seat',
      'Prepaid wallet (M-PESA / card)',
      'Email support (next business day)',
    ],
    highlighted: false,
    ctaText: 'Choose Starter',
  },
  {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: 15000,
    yearlyPrice: 12000,
    period: '/month',
    subtitle: 'The 0–500 batch standard — lending, fintech & SACCO onboarding',
    features: [
      'Up to 500 verifications / month',
      'KYC Standard bundle included',
      '5 analyst seats + 1 admin seat',
      'Full provider catalogue (KRA, CRB, M-PESA, KPLC, employer)',
      'API access with field mapping',
      'Case management & PDF report export',
      'Priority support (4h response)',
    ],
    highlighted: true,
    badge: 'Batch 0–500',
    ctaText: 'Choose Professional',
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: 32000,
    yearlyPrice: 26000,
    period: '/month',
    subtitle: 'KYC + KYB teams running entity and individual diligence together',
    features: [
      'Up to 500 KYC + 250 KYB verifications / month',
      'KYC Comprehensive + KYB Essential bundles',
      '15 seats with role-based access control',
      'Risk-engine rule configuration',
      'Webhooks & SSO (SAML/OIDC)',
      'Dedicated support (1h response)',
    ],
    highlighted: false,
    ctaText: 'Choose Business',
  },
  {
    id: 'enterprise',
    name: 'Institutional',
    customPrice: 'Custom Pricing',
    monthlyPrice: 0,
    yearlyPrice: 0,
    period: '',
    subtitle: 'Banks, insurers, government & multi-entity groups',
    features: [
      'Volume bands above 500 quoted separately',
      'KYB Complete + ongoing monitoring',
      'Unlimited seats, custom permission matrix',
      'Private gateway & mTLS peering',
      '99.95% SLA with penalty credits',
      'Named account manager',
    ],
    highlighted: false,
    ctaText: 'Contact Sales',
  },
];

/* --------------------------------- selectors --------------------------------- */

export function itemById(id: string) {
  return pricingCatalog.items.find((i) => i.id === id);
}

export function bundlePrice(id: string): number {
  const b = pricingCatalog.bundles.find((x) => x.id === id);
  return b?.priceKes ?? 0;
}

export function kycItems() {
  return pricingCatalog.items.filter((i) => i.type === 'kyc');
}

export function kybItems() {
  return pricingCatalog.items.filter((i) => i.type === 'kyb');
}

export interface CostEstimate {
  lines: { item: (typeof pricingCatalog.items)[number]; volume: number; unit: number; total: number }[];
  subtotal: number;
  vat: number;
  total: number;
  totalChecks: number;
  effectivePerCheck: number;
  monthlyAccessFee: number;
  grandTotalFirstMonth: number;
}

/** Price a basket of checks at a volume, honouring the 0–500 batch cap. */
export function estimateCost(
  selections: { itemId: string; volume: number }[],
  opts: { includeAccessFee?: boolean; includeVat?: boolean } = {}
): CostEstimate {
  const includeAccessFee = opts.includeAccessFee ?? true;
  const lines = selections
    .map((s) => {
      const item = itemById(s.itemId);
      if (!item) return null;
      const volume = Math.max(0, Math.min(pricingCatalog.batchMax, Math.round(s.volume || 0)));
      return { item, volume, unit: item.unitPriceKes, total: volume * item.unitPriceKes };
    })
    .filter(Boolean) as CostEstimate['lines'];

  const subtotalChecks = lines.reduce((a, l) => a + l.total, 0);
  const monthlyAccessFee = includeAccessFee ? pricingCatalog.monthlyAccessFeeKes : 0;
  const subtotal = subtotalChecks + monthlyAccessFee;
  const vat = (opts.includeVat ?? true) ? (subtotal * pricingCatalog.vatRatePct) / 100 : 0;
  const totalChecks = lines.reduce((a, l) => a + l.volume, 0);
  return {
    lines,
    subtotal,
    vat,
    total: subtotal + vat,
    totalChecks,
    effectivePerCheck: totalChecks > 0 ? subtotalChecks / totalChecks : 0,
    monthlyAccessFee,
    grandTotalFirstMonth: subtotal + vat + pricingCatalog.setupFeeKes,
  };
}

/** Price a single search run — used to debit the wallet before dispatch. */
export function priceChecks(itemIds: string[]): { total: number; breakdown: { id: string; name: string; price: number }[] } {
  const breakdown = itemIds
    .map((id) => itemById(id))
    .filter(Boolean)
    .map((i) => ({ id: i!.id, name: i!.name, price: i!.unitPriceKes }));
  return { total: breakdown.reduce((a, b) => a + b.price, 0), breakdown };
}
