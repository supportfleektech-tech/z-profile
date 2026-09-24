import type { PricingCatalog, PricingPlan } from '../types';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  KYC / KYB FINANCIAL PROPOSAL 2026 — pricing source of truth
 *  Band in use: 0 – 500 verifications (per instruction, higher bands are NOT used)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  STATUS: the KYC / identity API rates below are TRANSCRIBED FROM THE PROPOSAL and
 *  carry `confirmedFromProposal: true` individually. Three items are still provisional:
 *
 *    • Motor Vehicle Ownership — the proposal's Vehicle Verification table was cut off
 *      mid-row, so its 0–500 rate was never received.
 *    • Criminal & Court Record Check and Deceased Registry Check — not covered by the
 *      received extract.
 *    • ALL seven KYB products — the extract quotes no KYB pricing at all.
 *
 *  The catalogue-level flag therefore stays `false` until those arrive; the banners
 *  report an exact confirmed/total count so nothing unconfirmed is silently presented
 *  as final. Every consumer (Pricing & Tiers, Billing, wallet debit rates, the cost
 *  calculator, the PDF price schedule, the Admin pricing editor) reads THIS FILE ONLY.
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
    /*
     * KYC line items — transcribed from the received proposal extract.
     * Band in use: 0 – 500 (VAT exclusive). The proposal quotes a unit price and, for
     * the Identity Verification APIs, a separate "Back Up Rate" charged when the primary
     * source cannot answer. Higher volume bands (501–2,500 and above) are deliberately
     * NOT wired — only the 0–500 batch is in use.
     */

    /* ---- Identity Verification APIs · KES 30 unit / KES 45 back-up rate ---- */
    {
      id: 'kyc-id',
      name: "'IPRS Standard — National ID Verification'",
      type: 'kyc',
      description: 'Civil registration match on ID number, name and date of birth against the national register.',
      source: 'IPRS / National Registration Bureau',
      unitPriceKes: 30,
      includedInBatch: 500,
      overageRateKes: 30,
      backupRateKes: 45,
      turnaround: 'Real-time (< 3s)',
      confidence: 'High',
      proposalGroup: 'Identity Verification APIs',
      confirmedFromProposal: true,
    },
    {
      id: 'kyc-mpesa',
      name: "'Match ID & Phone Number'",
      type: 'kyc',
      description: 'Confirms that a national ID number and a mobile number belong to the same registered subscriber.',
      source: 'IPRS cross-referenced with the mobile subscriber register',
      unitPriceKes: 30,
      includedInBatch: 500,
      overageRateKes: 30,
      backupRateKes: 45,
      turnaround: 'Real-time (< 3s)',
      confidence: 'High',
      proposalGroup: 'Identity Verification APIs',
      confirmedFromProposal: true,
    },
    {
      id: 'kyc-employer',
      name: "'Employer Verification'",
      type: 'kyc',
      description: 'Confirms current employment, employer name and job title with the declared employer.',
      source: 'Employer / payroll confirmation desk',
      unitPriceKes: 30,
      includedInBatch: 500,
      overageRateKes: 30,
      backupRateKes: 45,
      turnaround: '2 – 24h (async)',
      confidence: 'Medium',
      proposalGroup: 'Identity Verification APIs',
      confirmedFromProposal: true,
    },
    {
      id: 'kyc-face',
      name: "'Face ID Match'",
      type: 'kyc',
      description: 'Liveness-checked facial comparison of a submitted selfie against the ID document photograph.',
      source: 'IPRS photograph repository + biometric match engine',
      unitPriceKes: 30,
      includedInBatch: 500,
      overageRateKes: 30,
      backupRateKes: 45,
      turnaround: 'Real-time (< 5s)',
      confidence: 'High',
      proposalGroup: 'Identity Verification APIs',
      confirmedFromProposal: true,
    },
    {
      id: 'kyc-bank',
      name: "'Bank Account Verification'",
      type: 'kyc',
      description: 'Validates that a bank account number and holder name match an active account.',
      source: 'Bank account verification network',
      unitPriceKes: 30,
      includedInBatch: 500,
      overageRateKes: 30,
      backupRateKes: 45,
      turnaround: 'Real-time (< 5s)',
      confidence: 'High',
      proposalGroup: 'Identity Verification APIs',
      confirmedFromProposal: true,
    },

    /* ---- Identity Verification APIs · KES 75 (no back-up rate quoted) ---- */
    {
      id: 'kyc-alien',
      name: "'Alien ID Verification'",
      type: 'kyc',
      description: 'Verifies a foreign national against their alien ID / foreigner registration record.',
      source: 'Directorate of Immigration Services',
      unitPriceKes: 75,
      includedInBatch: 500,
      overageRateKes: 75,
      turnaround: 'Real-time (< 5s)',
      confidence: 'High',
      proposalGroup: 'Identity Verification APIs',
      confirmedFromProposal: true,
    },
    {
      id: 'kyc-pep',
      name: "'AML & PEP Screen'",
      type: 'kyc',
      description: 'Screens the subject against politically-exposed-person, sanctions and adverse-media lists.',
      source: 'Global watchlist aggregator',
      unitPriceKes: 75,
      includedInBatch: 500,
      overageRateKes: 75,
      turnaround: 'Real-time (< 5s)',
      confidence: 'High',
      proposalGroup: 'Identity Verification APIs',
      confirmedFromProposal: true,
    },
    {
      id: 'kyc-passport',
      name: "'Passport Check'",
      type: 'kyc',
      description: 'Validates passport number, holder name, issue and expiry against the issuing authority.',
      source: 'Directorate of Immigration Services',
      unitPriceKes: 75,
      includedInBatch: 500,
      overageRateKes: 75,
      turnaround: 'Real-time (< 5s)',
      confidence: 'High',
      proposalGroup: 'Identity Verification APIs',
      confirmedFromProposal: true,
    },

    /* ---- Utility & Compliance APIs · KES 20 ---- */
    {
      id: 'kyc-address',
      name: "'KPLC Location Checker'",
      type: 'kyc',
      description: 'Confirms a declared physical address against the power utility connection point.',
      source: 'Kenya Power (KPLC) connection register',
      unitPriceKes: 20,
      includedInBatch: 500,
      overageRateKes: 20,
      turnaround: 'Real-time (< 3s)',
      confidence: 'Medium',
      proposalGroup: 'Utility & Compliance APIs',
      confirmedFromProposal: true,
    },
    {
      id: 'kyc-kra',
      name: "'KRA PIN Verification'",
      type: 'kyc',
      description: 'Validates a KRA PIN against the taxpayer register and returns the registered name and status.',
      source: 'Kenya Revenue Authority',
      unitPriceKes: 20,
      includedInBatch: 500,
      overageRateKes: 20,
      turnaround: 'Real-time (< 3s)',
      confidence: 'High',
      proposalGroup: 'Utility & Compliance APIs',
      confirmedFromProposal: true,
    },
    {
      id: 'kyc-sim',
      name: "'SIM Swap Check'",
      type: 'kyc',
      description: 'Detects whether the subject mobile number has had a SIM swap within the lookback window.',
      source: 'Telecom SIM registry',
      unitPriceKes: 20,
      includedInBatch: 500,
      overageRateKes: 20,
      turnaround: 'Real-time (< 3s)',
      confidence: 'High',
      proposalGroup: 'Utility & Compliance APIs',
      confirmedFromProposal: true,
    },
    {
      id: 'kyc-namephone',
      name: "'Search Name by Phone Number'",
      type: 'kyc',
      description: 'Returns the registered subscriber name for a given mobile number.',
      source: 'Telecom SIM registry',
      unitPriceKes: 20,
      includedInBatch: 500,
      overageRateKes: 20,
      turnaround: 'Real-time (< 3s)',
      confidence: 'Medium',
      proposalGroup: 'Utility & Compliance APIs',
      confirmedFromProposal: true,
    },

    /* ---- Identity & CRB APIs · KES 50 ---- */
    {
      id: 'kyc-phonebyid',
      name: "'Search Phone Numbers by ID'",
      type: 'kyc',
      description: 'Returns the mobile numbers registered against a national ID number.',
      source: 'CRB / telecom subscriber index',
      unitPriceKes: 50,
      includedInBatch: 500,
      overageRateKes: 50,
      turnaround: 'Real-time (< 5s)',
      confidence: 'Medium',
      proposalGroup: 'Identity & CRB APIs',
      confirmedFromProposal: true,
    },

    /* ---- Spin Score · volume-banded, 1–1,000 band applies to this batch ---- */
    {
      id: 'kyc-crb',
      name: "'Spin Score (Credit Score Only)'",
      type: 'kyc',
      description: 'Credit score only — no full bureau report. The proposal bands this 1–1,000 at KES 130, so the 0–500 batch falls inside that band.',
      source: 'CRB (TransUnion) via Spin',
      unitPriceKes: 130,
      includedInBatch: 500,
      overageRateKes: 130,
      turnaround: 'Real-time (< 5s)',
      confidence: 'High',
      proposalGroup: 'Spin Score',
      confirmedFromProposal: true,
    },

    /* ---- Page-metered ---- */
    {
      id: 'kyc-statement',
      name: "'Scanned Statement Analysis'",
      type: 'kyc',
      description: 'Bank or mobile-money statement ingestion and analysis. Priced KES 120 base plus KES 4 per page; the base rate is shown here and the per-page component is metered at upload.',
      source: 'Statement analysis engine',
      unitPriceKes: 120,
      includedInBatch: 500,
      overageRateKes: 120,
      perPageKes: 4,
      turnaround: '5 – 60s per page',
      confidence: 'Medium',
      proposalGroup: 'Scanned Statement',
      confirmedFromProposal: true,
    },

    /* ---- Vehicle Verification APIs · rate NOT received ---- */
    {
      id: 'kyc-vehicle',
      name: "'Motor Vehicle Ownership'",
      type: 'kyc',
      description: 'Confirms registered ownership, logbook status and vehicle particulars against the national register.',
      source: 'NTSA vehicle register',
      unitPriceKes: 250,
      includedInBatch: 500,
      overageRateKes: 250,
      turnaround: 'Real-time (< 5s)',
      confidence: 'Medium',
      proposalGroup: 'Vehicle Verification APIs',
      confirmedFromProposal: false,
    },

    /* ---- Not covered by the received proposal extract ---- */
    {
      id: 'kyc-criminal',
      name: "'Criminal & Court Record Check'",
      type: 'kyc',
      description: 'Searches criminal and civil court records for convictions and active proceedings.',
      source: 'Judiciary Records',
      unitPriceKes: 250,
      includedInBatch: 500,
      overageRateKes: 250,
      turnaround: '2 – 24h (async)',
      confidence: 'Medium',
      proposalGroup: 'Not in received extract',
      confirmedFromProposal: false,
    },
    {
      id: 'kyc-deceased',
      name: "'Deceased Registry Check'",
      type: 'kyc',
      description: 'Confirms whether a national ID number appears on the deceased register.',
      source: 'IPRS / National Registration Bureau',
      unitPriceKes: 45,
      includedInBatch: 500,
      overageRateKes: 45,
      turnaround: 'Real-time (< 3s)',
      confidence: 'High',
      proposalGroup: 'Not in received extract',
      confirmedFromProposal: false,
    },
    /* ------------------------------- KYB line items ------------------------------- */
    /*
     * The proposal extract received covers the KYC / identity APIs only. It quotes NO
     * KYB products, so every rate below is still a placeholder and is flagged as such.
     */
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
      proposalGroup: 'Not in the received proposal extract',
      confirmedFromProposal: false,
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
      proposalGroup: 'Not in the received proposal extract',
      confirmedFromProposal: false,
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
      proposalGroup: 'Not in the received proposal extract',
      confirmedFromProposal: false,
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
      proposalGroup: 'Not in the received proposal extract',
      confirmedFromProposal: false,
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
      proposalGroup: 'Not in the received proposal extract',
      confirmedFromProposal: false,
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
      proposalGroup: 'Not in the received proposal extract',
      confirmedFromProposal: false,
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
      proposalGroup: 'Not in the received proposal extract',
      confirmedFromProposal: false,
    },
  ],

  /* ---------------------------------- bundles ---------------------------------- */
  bundles: [
    {
      id: 'bundle-kyc-basic',
      name: 'KYC Basic',
      tagline: 'Fast identity confirmation for onboarding and low-value accounts.',
      itemIds: ['kyc-id', 'kyc-kra', 'kyc-mpesa'],
      priceKes: 80,
    },
    {
      id: 'bundle-kyc-standard',
      name: 'KYC Standard',
      tagline: 'The default onboarding pack for lending, SACCO and fintech KYC.',
      itemIds: ['kyc-id', 'kyc-kra', 'kyc-mpesa', 'kyc-address', 'kyc-deceased'],
      priceKes: 145,
      highlighted: true,
      badge: 'Most Selected',
    },
    {
      id: 'bundle-kyc-comprehensive',
      name: 'KYC Comprehensive',
      tagline: 'Full due diligence with credit, employment, criminal and screening.',
      itemIds: ['kyc-id', 'kyc-kra', 'kyc-mpesa', 'kyc-address', 'kyc-employer', 'kyc-criminal', 'kyc-pep', 'kyc-deceased', 'kyc-crb'],
      priceKes: 630,
    },
    {
      id: 'bundle-kyb-essential',
      name: 'KYB Essential',
      tagline: 'Corporate onboarding: registry, directors and tax standing.',
      itemIds: ['kyb-registry', 'kyb-directors', 'kyb-tax'],
      priceKes: 670,
    },
    {
      id: 'bundle-kyb-complete',
      name: 'KYB Complete',
      tagline: 'Institutional-grade entity due diligence and ongoing monitoring.',
      itemIds: ['kyb-registry', 'kyb-directors', 'kyb-bo', 'kyb-tax', 'kyb-crb', 'kyb-litigation', 'kyb-licence'],
      priceKes: 2140,
    },
  ],

  notes: [
    'All prices are quoted in Kenya Shillings (KES) and are exclusive of VAT at 16%.',
    'Only the 0–500 verification batch is wired, per instruction. The proposal\u2019s higher bands (501–2,500, 2,501–5,000, …) are deliberately not used — note they are CHEAPER per unit, so volume is a discount rather than an overage.',
    'The Identity Verification APIs carry a "Back Up Rate" (KES 45 against a KES 30 unit price) charged when the primary source cannot answer and the request falls back.',
    'Spin Score is volume-banded 1–1,000 at KES 130; the 0–500 batch sits inside that band, so KES 130 applies.',
    'Scanned Statement Analysis is page-metered: KES 120 base plus KES 4 per page.',
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

/* ------------------------------ provenance helper ------------------------------ */

/**
 * Per-item provenance for the pricing banners.
 *
 * The catalogue-level `confirmedFromProposal` is deliberately all-or-nothing, so on its
 * own it can only say "nothing is final". Once part of a proposal is transcribed that is
 * misleading in both directions — it would hide the confirmed rates, or (if flipped true)
 * silently present the unconfirmed ones as final. This counts the line items instead so
 * every banner can state exactly what is and is not sourced from the proposal.
 */
export function pricingProvenance(catalog: PricingCatalog): {
  total: number;
  confirmed: number;
  provisional: number;
  allConfirmed: boolean;
} {
  const total = catalog.items.length;
  const confirmed = catalog.items.filter((i) => i.confirmedFromProposal).length;
  const provisional = total - confirmed;
  return { total, confirmed, provisional, allConfirmed: provisional === 0 && catalog.confirmedFromProposal };
}
