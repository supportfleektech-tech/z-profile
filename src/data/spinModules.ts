/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  SPIN MOBILE — KENYA MODULE REGISTRY
 *  Transcribed from https://docs.spinmobile.co (Kenya section, reviewed in full).
 *  Single source of truth for how this platform talks to Spin's SuperCrunch API:
 *  every consumer (New Search catalogue, Provider Management, the backend adapter,
 *  provider logs) reads from HERE — the same pattern pricing.ts uses for rates.
 *
 *  INTEGRATION METHOD (docs: Introduction → Definitions → Authorization):
 *    1. POST {base}/analytics/auth/  body {consumer_key, consumer_secret}
 *       → { token, expires }   (token valid ~10 minutes — cache and reuse)
 *    2. Every search: POST {base}/analytics/… with
 *       Authorization: Bearer <token>, JSON body
 *       { search_type, identifier, consent, consent_collected_by }
 *       (some modules add phone_number; Metropol Full uses identity_number +
 *       identifier-as-type)
 *    3. Sandbox and production share ONE base URL — only the keys differ.
 *
 *  RESPONSE CONVENTIONS (two envelopes appear in the docs):
 *    • Analytics envelope   { code: "200.001", data: { … } }
 *    • Verification envelope{ response_code: "200", success: true, message, data: {…} }
 *
 *  Fidelity notes, kept honest:
 *    • `endpoint` is filled ONLY where the docs publish the path
 *      (employer, full_kyc_check, phonesearch). The remaining pages document
 *      request/response params but not the path — `endpoint: null` means
 *      "same Bearer + JSON pattern, path per onboarding", NOT an invented URL.
 *    • Passport / Face ID / Hakikisha / Bank Account / E-Statements / Combined
 *      Analysis pages exist in the docs sidebar but their exact parameter tables
 *      were not retrievable at review time — marked `fidelity: 'section-only'`.
 *    • AML/PEP screening, Motor Vehicle Ownership, Criminal and Deceased checks
 *      are PRICED in the financial proposal but are NOT in the Kenya docs sidebar
 *      — kept as items, flagged accordingly.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export interface SpinRequestParam {
  name: string;
  description: string;
  type: 'String' | 'Boolean' | 'Number';
  required?: boolean;
}

export interface SpinModule {
  /** Stable id — matches pricing item ids where a priced equivalent exists. */
  id: string;
  name: string;
  /** Docs sidebar section, e.g. "Identity", "CRB", "Hakikisha". */
  section: string;
  /** The SuperCrunch `search_type` value (verbatim from the docs). */
  searchType: string;
  /** Published endpoint path, or null when the docs don't state one. */
  endpoint: string | null;
  identifierLabel: string;
  /** Params beyond the standard {search_type, identifier, consent, consent_collected_by}. */
  extraParams?: SpinRequestParam[];
  /** Response field names transcribed from the docs' response tables/samples. */
  responseFields: { name: string; description: string }[];
  /** Which pricing-catalogue item this module delivers (null = not priced). */
  pricedItemId: string | null;
  /** 'full' = params + response transcribed; 'section-only' = page not retrievable. */
  fidelity: 'full' | 'section-only';
  /** Notes from the docs worth surfacing to operators. */
  notes?: string;
}

/** Standard request body every Spin search shares (docs: Authorization section). */
export const SPIN_STANDARD_PARAMS: SpinRequestParam[] = [
  { name: 'search_type', description: 'The SuperCrunch search type to execute', type: 'String', required: true },
  { name: 'identifier', description: 'The search parameter — ID number, PIN, phone, meter, licence or reg no. depending on the module', type: 'String', required: true },
  { name: 'consent', description: 'Whether the data owner consented (1/0 or true/false)', type: 'String', required: true },
  { name: 'consent_collected_by', description: 'Name or identifier of who collected the data owner’s consent', type: 'String' },
];

export const SPIN_AUTH = {
  /** POST — body {consumer_key, consumer_secret} → {token, expires}. Token lives ~10 min. */
  tokenPath: '/analytics/auth/',
  tokenTtlMinutes: 10,
  requestParams: [
    { name: 'consumer_key', description: 'API key identifying the customer (Dashboard → Setup → API Keys)', type: 'String' as const, required: true },
    { name: 'consumer_secret', description: 'Secret used alongside the consumer key', type: 'String' as const, required: true },
  ],
  responseFields: [
    { name: 'token', description: 'Access token for subsequent calls' },
    { name: 'expires', description: 'Token expiry (epoch seconds)' },
  ],
};

export const SPIN_MODULES: SpinModule[] = [
  /* ───────────────────────────── Identity ───────────────────────────── */
  {
    id: 'spin-iprs-identity',
    name: 'IPRS Identity Verification',
    section: 'Identity',
    searchType: 'identity',
    endpoint: null,
    identifierLabel: 'National ID number',
    responseFields: [
      { name: 'data.photo', description: 'Client’s photo (bytes)' },
      { name: 'data.signature', description: 'Client’s signature (bytes)' },
      { name: 'data.fingerprint', description: 'Client’s fingerprint (bytes)' },
      { name: 'data.id_number', description: 'Client’s ID number' },
      { name: 'data.surname / first_name / other_name', description: 'Names exactly as registered' },
      { name: 'data.gender / date_of_birth / citizenship', description: 'Demographics' },
      { name: 'data.clan / ethnic_group / family', description: 'Registered lineage fields' },
      { name: 'data.serial_number', description: 'ID card serial number' },
      { name: 'data.place_of_birth / place_of_live', description: 'Birth and residence' },
    ],
    pricedItemId: 'kyc-id',
    fidelity: 'full',
    notes: 'Docs: IPRS capabilities eventually include phone/NHIF/NSSF/DL; today Identity + KRA PIN are live.',
  },
  {
    id: 'spin-iprs-conso',
    name: 'IPRS Identity + KRA (Consolidated)',
    section: 'Identity',
    searchType: 'identity-kra',
    endpoint: null,
    identifierLabel: 'National ID number',
    responseFields: [
      { name: 'data.* (all identity fields)', description: 'The full identity payload' },
      { name: 'data.krapin', description: 'Client’s KRA PIN returned with the identity' },
    ],
    pricedItemId: 'kyc-id-kra',
    fidelity: 'full',
    notes: 'Also accepted: search_type "conso". One call, identity + PIN.',
  },
  {
    id: 'spin-kra-pin',
    name: 'KRA PIN Checker',
    section: 'KRA PIN Verification',
    searchType: 'pin',
    endpoint: null,
    identifierLabel: 'KRA PIN (or ID with search_type id_no)',
    extraParams: [],
    responseFields: [
      { name: 'id_number', description: 'Resolved national ID' },
      { name: 'krapin', description: 'The verified KRA PIN' },
    ],
    pricedItemId: 'kyc-kra',
    fidelity: 'full',
    notes: 'search_type "pin" checks by PIN, "id_no" resolves the PIN from an ID number.',
  },
  {
    id: 'spin-passport',
    name: 'Passport Check',
    section: 'Passport Check',
    searchType: 'PASSPORTCHECK',
    endpoint: null,
    identifierLabel: 'Passport number',
    responseFields: [],
    pricedItemId: 'kyc-passport',
    fidelity: 'section-only',
    notes: 'Docs page exists under Kenya → Passport Check; parameter table not retrievable at review time.',
  },
  {
    id: 'spin-face-id',
    name: 'Face ID Match',
    section: 'Face ID Match',
    searchType: 'FACEIDMATCH',
    endpoint: null,
    identifierLabel: 'ID number + selfie reference',
    responseFields: [],
    pricedItemId: 'kyc-face',
    fidelity: 'section-only',
    notes: 'Docs page exists under Kenya → Face ID Match; parameters not retrievable at review time.',
  },
  {
    id: 'spin-alien',
    name: 'Alien ID Verification',
    section: 'Alien ID Check',
    searchType: 'ALIENCHECK',
    endpoint: null,
    identifierLabel: 'Alien ID number',
    responseFields: [
      { name: 'response_code', description: '"200" on success' },
      { name: 'success', description: 'true' },
      { name: 'message', description: '"Alien ID verification successful"' },
      { name: 'data', description: 'Verification payload' },
    ],
    pricedItemId: 'kyc-alien',
    fidelity: 'full',
  },

  /* ───────────────────────────── CRB ───────────────────────────── */
  {
    id: 'spin-metropol-summary',
    name: 'Metropol Summary Report',
    section: 'CRB',
    searchType: 'Metropol',
    endpoint: null,
    identifierLabel: 'National ID number',
    responseFields: [
      { name: 'code', description: '"200.001"' },
      { name: 'data', description: 'Summary credit report' },
    ],
    pricedItemId: 'kyc-crb',
    fidelity: 'full',
    notes: 'Spin is integrated with Metropol and TransUnion for a holistic bureau view.',
  },
  {
    id: 'spin-metropol-full',
    name: 'Metropol Full Report',
    section: 'CRB',
    searchType: 'METROPOLFULLJSON',
    endpoint: null,
    identifierLabel: 'National ID number (+ identifier = "National ID")',
    extraParams: [
      { name: 'identity_number', description: 'The ID number being queried', type: 'String', required: true },
    ],
    responseFields: [
      { name: 'data.credit_score', description: 'Bureau credit score (e.g. 260)' },
      { name: 'data.account_info[]', description: 'Accounts: number, status, balances, arrears, payments, product' },
      { name: 'data.identity_verification', description: 'Verified bio data from the bureau' },
      { name: 'data.identity_scrub', description: 'Names, phones, physical/postal addresses, employment' },
      { name: 'data.lender_sector', description: 'Bank vs other-sector performing/NPA account counts' },
      { name: 'data.no_of_enquiries / bounced_cheques / credit_applications', description: '3/6/12-month counters' },
      { name: 'data.delinquency_code / has_fraud / guarantors / stakeholders', description: 'Risk flags and relationships' },
    ],
    pricedItemId: 'kyc-metropol-full',
    fidelity: 'full',
  },
  {
    id: 'spin-creditinfo',
    name: 'Creditinfo Score & Report',
    section: 'CRB',
    searchType: 'CREDITINFO',
    endpoint: null,
    identifierLabel: 'National ID number',
    extraParams: [
      { name: 'report_type', description: 'e.g. CreditReport', type: 'String' },
      { name: 'document_type', description: 'e.g. NationalID', type: 'String' },
      { name: 'client_name', description: 'The client name being queried', type: 'String' },
    ],
    responseFields: [
      { name: 'data.client_name / phone / id_no / passport_no', description: 'Personal information' },
      { name: 'data.status / trend_status / score_type_name', description: 'Score status' },
      { name: 'data.id_verified / passport_verified', description: 'Verification booleans' },
      { name: 'data.gender / citizenship / ethnic_group / serial_number', description: 'Demographics' },
      { name: 'data.place_of_birth / place_of_live', description: 'Origins and residence' },
    ],
    pricedItemId: 'kyc-creditinfo',
    fidelity: 'full',
  },

  /* ──────────────────── Hakikisha / phone intelligence ──────────────────── */
  {
    id: 'spin-hakikisha',
    name: 'Phone Number Hakikisha',
    section: 'Hakikisha',
    searchType: 'HAKIKISHA',
    endpoint: null,
    identifierLabel: 'Phone number',
    responseFields: [],
    pricedItemId: 'kyc-namephone',
    fidelity: 'section-only',
    notes: 'Docs page exists under Kenya → Hakikisha; parameter table not retrievable at review time.',
  },
  {
    id: 'spin-mpesa-kyc',
    name: 'M-PESA KYC (Safaricom)',
    section: 'Mpesa KYC',
    searchType: 'MPESAKYCCHECK',
    endpoint: null,
    identifierLabel: 'ID number + phone_number',
    extraParams: [
      { name: 'phone_number', description: 'The phone number to verify against the ID', type: 'String', required: true },
    ],
    responseFields: [
      { name: 'data.responseRefID', description: 'Provider reference' },
      { name: 'data.responseCode', description: '"4000" — details match' },
      { name: 'data.responseMessage', description: '"Details match successfully"' },
      { name: 'data.status', description: 'true/false match result' },
    ],
    pricedItemId: 'kyc-mpesa',
    fidelity: 'full',
  },
  {
    id: 'spin-sim-swap',
    name: 'SIM Swap Check (Safaricom)',
    section: 'Sim Swap',
    searchType: 'sim_swap',
    endpoint: null,
    identifierLabel: 'Phone number',
    responseFields: [
      { name: 'data', description: 'Last-swap details for the line' },
    ],
    pricedItemId: 'kyc-sim',
    fidelity: 'full',
    notes: 'Docs also show an "imsi" search_type variant on the same module.',
  },
  {
    id: 'spin-phone-search',
    name: 'Phone Number Search (skip trace)',
    section: 'Phone Number Search',
    searchType: 'PHONESEARCH',
    endpoint: '/analytics/account/phonesearch',
    identifierLabel: 'National ID number',
    responseFields: [
      { name: 'data.Data.response.PersonalInformation', description: 'DocumentID + FullName' },
      { name: 'data.Data.response.AdditionalContactsFound', description: '"Yes"/"No"' },
      { name: 'data.Data.response.AdditionalContacts.PhoneContacts[]', description: 'Registered phone numbers' },
      { name: 'data.Data.response.Strategy', description: 'Trace strategy metadata (BeeStrategy: SpinmobileSkipTrace)' },
    ],
    pricedItemId: 'kyc-phonebyid',
    fidelity: 'full',
  },
  {
    id: 'spin-bank-account',
    name: 'Bank Account Validation',
    section: 'Bank Account Validation',
    searchType: 'BANKACCOUNTVALIDATION',
    endpoint: null,
    identifierLabel: 'Account number',
    responseFields: [],
    pricedItemId: 'kyc-bank',
    fidelity: 'section-only',
    notes: 'Docs page exists under Kenya → Bank Account Validation; parameters not retrievable at review time.',
  },

  /* ──────────────────── Composite & employer ──────────────────── */
  {
    id: 'spin-full-kyc',
    name: 'Full KYC Verification',
    section: 'Full KYC',
    searchType: 'FULLKYC',
    endpoint: '/analytics/account/full_kyc_check',
    identifierLabel: 'National ID number',
    responseFields: [
      { name: 'data.id_number / surname / first_name / other_name', description: 'Identity block' },
      { name: 'data.serial_number / gender / date_of_birth / citizenship', description: 'Identity block' },
      { name: 'data.place_of_birth / place_of_live / phone_number / email', description: 'Contact + origins' },
      { name: 'data.employed / employer_details.employerName / jobGroup', description: 'Employment block' },
      { name: 'data.KRAPIN / TypeOfTaxpayer / Name / StatusOfPIN', description: 'KRA block' },
    ],
    pricedItemId: 'kyc-fullkyc',
    fidelity: 'full',
    notes: 'Composite: identity + employer + KRA in one call.',
  },
  {
    id: 'spin-employer',
    name: 'Employer Verification',
    section: 'Employer Verification',
    searchType: 'employer',
    endpoint: '/analytics/account/employer',
    identifierLabel: 'National ID number',
    responseFields: [
      { name: 'employed', description: 'boolean' },
      { name: 'id_number', description: 'Masked ID queried' },
      { name: 'employer_details.employerName / jobGroup', description: 'Employer of record' },
      { name: 'full_name', description: 'Subject name' },
    ],
    pricedItemId: 'kyc-employer',
    fidelity: 'full',
  },

  /* ──────────────────── Business, driving, utility ──────────────────── */
  {
    id: 'spin-business',
    name: 'Business Verification',
    section: 'Business Verification',
    searchType: 'COMPANYSEARCHREGNO',
    endpoint: null,
    identifierLabel: 'Business registration number',
    responseFields: [
      { name: 'response_code', description: '"200" on success' },
      { name: 'success / message', description: '"Business verification successful"' },
      { name: 'data', description: 'Company details' },
    ],
    pricedItemId: 'kyb-registry',
    fidelity: 'full',
  },
  {
    id: 'spin-driver-licence',
    name: 'Driving Licence Check',
    section: 'Driver Licence Checks',
    searchType: 'DRIVERSLICENCECHECK',
    endpoint: null,
    identifierLabel: 'Driving licence number',
    responseFields: [
      { name: 'response_code', description: '"200" on success' },
      { name: 'success / message', description: '"Driving licence details fetched successful"' },
      { name: 'data', description: 'Licence details' },
    ],
    pricedItemId: 'kyc-driving-licence',
    fidelity: 'full',
  },
  {
    id: 'spin-kplc',
    name: 'KPLC Location Checker',
    section: 'KPLC Location Checker',
    searchType: 'kplc',
    endpoint: null,
    identifierLabel: 'KPLC meter number',
    responseFields: [
      { name: 'data.address', description: 'Connection address for the meter' },
    ],
    pricedItemId: 'kyc-address',
    fidelity: 'full',
  },

  /* ──────────────────── Statements ──────────────────── */
  {
    id: 'spin-estatements',
    name: 'E-Statements (submit → status → analysis → webhook)',
    section: 'E-Statements',
    searchType: 'E_STATEMENT',
    endpoint: null,
    identifierLabel: 'Statement file / reference',
    responseFields: [],
    pricedItemId: 'kyc-statement',
    fidelity: 'section-only',
    notes: 'Four documented steps (Submission/Upload, Status Query, Analysis Query, Analysis Webhook/Receiver); paths not retrievable at review time. Includes fake-statement fraud detection per the use-cases page.',
  },
  {
    id: 'spin-combined-analysis',
    name: 'Combined Analysis',
    section: 'Combined Analysis',
    searchType: 'COMBINED_ANALYSIS',
    endpoint: null,
    identifierLabel: 'Statement file / reference',
    responseFields: [],
    pricedItemId: null,
    fidelity: 'section-only',
    notes: 'Statement + analytics combined; adds Analyze-All and Analyze-Single operations. Not priced separately in the proposal.',
  },
];

/* ────────────────────────────── helpers ────────────────────────────── */

/** The Spin module that delivers a priced catalogue item, if any. */
export function spinModuleForItem(itemId: string): SpinModule | undefined {
  return SPIN_MODULES.find((m) => m.pricedItemId === itemId);
}

/** Modules whose docs publish a concrete endpoint path. */
export function spinModulesWithEndpoints(): SpinModule[] {
  return SPIN_MODULES.filter((m) => m.endpoint);
}

/** Spin-native modules NOT priced in the received proposal (visible in the docs, absent from pricing). */
export function spinModulesUnpriced(): SpinModule[] {
  return SPIN_MODULES.filter((m) => m.pricedItemId === null);
}

/**
 * Build the real Spin request body for a module — used by the backend adapter in live
 * mode and by the provider-test simulation so what we log matches what we would send.
 */
export function spinRequestBody(
  module: SpinModule,
  identifier: string,
  opts: { phone?: string; consent?: boolean | string; consentCollectedBy?: string } = {}
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    search_type: module.searchType,
    identifier,
    consent: opts.consent ?? '1',
    consent_collected_by: opts.consentCollectedBy ?? 'IPRS Demo Platform',
  };
  if (module.id === 'spin-metropol-full') {
    body.identity_number = identifier;
    body.identifier = 'National ID';
  }
  if (module.extraParams?.some((p) => p.name === 'phone_number') && opts.phone) {
    body.phone_number = opts.phone;
  }
  return body;
}
