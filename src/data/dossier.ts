import type { Dossier, DossierSection, IdentityProfile, VerificationEvent } from '../types';

/**
 * The complete extracted record behind an identity profile.
 *
 * Every field surfaced in the Identity Profile tabs (Personal / Financial / Connections /
 * Logs) and every value printed in the Full Report and PDF comes from here — there is no
 * placeholder copy in the report layer.
 */

const GENERATED_AT = '2026-09-23T09:42:18.000Z';

const events: VerificationEvent[] = [
  {
    id: 'ev-1',
    at: '2026-09-23T09:41:52.000Z',
    actor: 'Sarah Wanjiku',
    actorTier: 'user',
    provider: 'IPRS Civil Registration',
    endpoint: 'POST /v1/citizen/verify',
    fieldsRequested: ['idNumber', 'firstName', 'lastName', 'dateOfBirth', 'gender', 'photoHash'],
    responseCode: 200,
    latencyMs: 812,
    costKes: 50,
    consentRef: 'CNS-2026-88431',
    outcome: 'verified',
    ip: '41.90.112.34',
  },
  {
    id: 'ev-2',
    at: '2026-09-23T09:41:55.000Z',
    actor: 'Sarah Wanjiku',
    actorTier: 'user',
    provider: 'KRA iTax',
    endpoint: 'POST /v1/tax/pin-validate',
    fieldsRequested: ['kraPin', 'taxpayerName', 'obligationTypes', 'complianceStatus'],
    responseCode: 200,
    latencyMs: 1420,
    costKes: 40,
    consentRef: 'CNS-2026-88431',
    outcome: 'verified',
    ip: '41.90.112.34',
  },
  {
    id: 'ev-3',
    at: '2026-09-23T09:41:58.000Z',
    actor: 'Sarah Wanjiku',
    actorTier: 'user',
    provider: 'Safaricom M-PESA KYC',
    endpoint: 'POST /v1/mpesa/name-match',
    fieldsRequested: ['msisdn', 'registeredName', 'kycTier', 'activeSince'],
    responseCode: 200,
    latencyMs: 640,
    costKes: 30,
    consentRef: 'CNS-2026-88431',
    outcome: 'verified',
    ip: '41.90.112.34',
  },
  {
    id: 'ev-4',
    at: '2026-09-23T09:42:06.000Z',
    actor: 'Sarah Wanjiku',
    actorTier: 'user',
    provider: 'TransUnion CRB',
    endpoint: 'POST /v1/credit/individual-report',
    fieldsRequested: ['idNumber', 'fullName', 'score', 'facilities', 'listings'],
    responseCode: 200,
    latencyMs: 8240,
    costKes: 450,
    consentRef: 'CNS-2026-88431',
    outcome: 'verified',
    ip: '41.90.112.34',
  },
  {
    id: 'ev-5',
    at: '2026-09-23T09:42:09.000Z',
    actor: 'Sarah Wanjiku',
    actorTier: 'user',
    provider: 'Corporate Payroll Registry',
    endpoint: 'POST /v1/employment/verify',
    fieldsRequested: ['idNumber', 'employer', 'position', 'startDate', 'contractType'],
    responseCode: 200,
    latencyMs: 2130,
    costKes: 150,
    consentRef: 'CNS-2026-88431',
    outcome: 'verified',
    ip: '41.90.112.34',
  },
  {
    id: 'ev-6',
    at: '2026-09-23T09:42:12.000Z',
    actor: 'Sarah Wanjiku',
    actorTier: 'user',
    provider: 'KPLC Grid API',
    endpoint: 'POST /v1/utility/account-verify',
    fieldsRequested: ['meterNumber', 'accountName', 'status', 'billingHistory'],
    responseCode: 200,
    latencyMs: 1180,
    costKes: 60,
    consentRef: 'CNS-2026-88431',
    outcome: 'verified',
    ip: '41.90.112.34',
  },
  {
    id: 'ev-7',
    at: '2026-09-23T09:42:14.000Z',
    actor: 'Sarah Wanjiku',
    actorTier: 'user',
    provider: 'Global Watchlist Aggregator',
    endpoint: 'POST /v1/screening/pep-sanctions',
    fieldsRequested: ['fullName', 'idNumber', 'dob', 'nationality'],
    responseCode: 200,
    latencyMs: 940,
    costKes: 120,
    consentRef: 'CNS-2026-88431',
    outcome: 'verified',
    ip: '41.90.112.34',
  },
  {
    id: 'ev-8',
    at: '2026-09-23T09:42:17.000Z',
    actor: 'Sarah Wanjiku',
    actorTier: 'user',
    provider: 'Judiciary Records',
    endpoint: 'POST /v1/court/criminal-search',
    fieldsRequested: ['idNumber', 'fullName'],
    responseCode: 200,
    latencyMs: 3120,
    costKes: 250,
    consentRef: 'CNS-2026-88431',
    outcome: 'not_found',
    ip: '41.90.112.34',
  },
];

const sections: DossierSection[] = [
  {
    id: 'sec-civil',
    title: 'Civil Registration & Identity',
    provider: 'IPRS Civil Registration',
    state: 'verified',
    confidence: 99.7,
    retrievedAt: '2026-09-23T09:41:52.000Z',
    latencyMs: 812,
    costKes: 50,
    summary:
      'National identity record matched on ID number, full name and date of birth. Biometric photo comparison returned a 97.4% match against the submitted portrait.',
    fields: [
      { label: 'Full Name', value: 'JOHN MWANGI KAMAU', source: 'IPRS', retrievedAt: GENERATED_AT, confidence: 99.9, matchRule: 'Exact (normalised)' },
      { label: 'ID Number', value: '23456789', source: 'IPRS', retrievedAt: GENERATED_AT, confidence: 100, matchRule: 'Exact' },
      { label: 'ID Type', value: 'National Identity Card (2nd generation)', source: 'IPRS', retrievedAt: GENERATED_AT, confidence: 100 },
      { label: 'Serial Number', value: 'KE-2345-6789-114', source: 'IPRS', retrievedAt: GENERATED_AT, confidence: 98.2, masked: true },
      { label: 'Date of Birth', value: '15 May 1990', source: 'IPRS', retrievedAt: GENERATED_AT, confidence: 100, matchRule: 'Exact' },
      { label: 'Gender', value: 'Male', source: 'IPRS', retrievedAt: GENERATED_AT, confidence: 100 },
      { label: 'Nationality', value: 'Kenyan (by birth)', source: 'IPRS', retrievedAt: GENERATED_AT, confidence: 100 },
      { label: 'Place of Birth', value: 'Murang\u2019a District, Central Province', source: 'IPRS', retrievedAt: GENERATED_AT, confidence: 96.4 },
      { label: 'Registration Centre', value: 'Nairobi Huduma Centre — GPO', source: 'IPRS', retrievedAt: GENERATED_AT, confidence: 94.1 },
      { label: 'Card Issue Date', value: '02 March 2018', source: 'IPRS', retrievedAt: GENERATED_AT, confidence: 99.1 },
      { label: 'Card Expiry Date', value: '02 March 2028', source: 'IPRS', retrievedAt: GENERATED_AT, confidence: 99.1 },
      { label: 'Deceased Flag', value: 'Not recorded as deceased', source: 'IPRS deaths register', retrievedAt: GENERATED_AT, confidence: 100 },
      { label: 'Photo Match Score', value: '97.4%', source: 'Biometric comparator', retrievedAt: GENERATED_AT, confidence: 97.4, matchRule: 'Threshold >= 85%' },
      { label: 'Aliases on Record', value: 'JOHN M. KAMAU; J. MWANGI', source: 'IPRS', retrievedAt: GENERATED_AT, confidence: 92.0 },
    ],
    rawResponse: {
      status: 'MATCH',
      citizen_id: '23456789',
      first_name: 'JOHN',
      middle_name: 'MWANGI',
      last_name: 'KAMAU',
      dob: '1990-05-15',
      gender: 'M',
      nationality: 'KE',
      photo_match: 0.974,
      deceased: false,
      registry_confidence: 0.997,
    },
  },
  {
    id: 'sec-kra',
    title: 'KRA Tax Records',
    provider: 'Kenya Revenue Authority iTax',
    state: 'verified',
    confidence: 99.2,
    retrievedAt: '2026-09-23T09:41:55.000Z',
    latencyMs: 1420,
    costKes: 40,
    summary:
      'PIN active and in good standing. All returns for the last three years filed on time, with no outstanding liability and no enforcement action recorded.',
    fields: [
      { label: 'KRA PIN', value: 'A123456789K', source: 'iTax', retrievedAt: GENERATED_AT, confidence: 100, matchRule: 'Exact' },
      { label: 'Taxpayer Name', value: 'JOHN MWANGI KAMAU', source: 'iTax', retrievedAt: GENERATED_AT, confidence: 99.8, matchRule: 'Exact (normalised)' },
      { label: 'PIN Status', value: 'Active — Good Standing', source: 'iTax', retrievedAt: GENERATED_AT, confidence: 99.5 },
      { label: 'Registration Date', value: '18 June 2012', source: 'iTax', retrievedAt: GENERATED_AT, confidence: 99.0 },
      { label: 'Taxpayer Type', value: 'Individual', source: 'iTax', retrievedAt: GENERATED_AT, confidence: 100 },
      { label: 'Obligation Types', value: 'PAYE; Income Tax — Individual; VAT (non-registered)', source: 'iTax', retrievedAt: GENERATED_AT, confidence: 98.4 },
      { label: 'Residence Status', value: 'Resident', source: 'iTax', retrievedAt: GENERATED_AT, confidence: 97.8 },
      { label: 'Last Return Filed', value: 'IT1 2025 — filed 28 June 2026', source: 'iTax', retrievedAt: GENERATED_AT, confidence: 99.1 },
      { label: 'Outstanding Liability', value: 'KES 0', source: 'iTax ledger', retrievedAt: GENERATED_AT, confidence: 99.3 },
      { label: 'Compliance Certificate', value: 'Valid — issued 12 Jan 2026, expires 12 Jan 2027', source: 'iTax', retrievedAt: GENERATED_AT, confidence: 98.9 },
      { label: 'Enforcement Action', value: 'None recorded', source: 'iTax', retrievedAt: GENERATED_AT, confidence: 98.0 },
      { label: 'Agency Debt (eTIMS)', value: 'Not applicable — employment income only', source: 'iTax', retrievedAt: GENERATED_AT, confidence: 95.2 },
    ],
    rawResponse: {
      pin: 'A123456789K',
      pin_status: 'ACTIVE',
      taxpayer_name: 'JOHN MWANGI KAMAU',
      registration_date: '2012-06-18',
      taxpayer_type: 'INDIVIDUAL',
      obligations: 'PAYE,IIT',
      outstanding_amount: 0,
      compliance_cert_valid: true,
      enforcement_flag: false,
    },
    flags: [{ level: 'info', text: 'Tax compliance certificate is current and verifiable on the iTax portal.' }],
  },
  {
    id: 'sec-mpesa',
    title: 'M-PESA KYC & Mobile Money',
    provider: 'Safaricom M-PESA KYC Registry',
    state: 'verified',
    confidence: 99.5,
    retrievedAt: '2026-09-23T09:41:58.000Z',
    latencyMs: 640,
    costKes: 30,
    summary:
      'MSISDN registered to the subject since 2012 at the highest KYC tier. No SIM-swap events in the last 24 months and continuous monthly activity.',
    fields: [
      { label: 'MSISDN', value: '0712 345 678', source: 'Safaricom', retrievedAt: GENERATED_AT, confidence: 100, matchRule: 'Exact', masked: true },
      { label: 'Registered Account Name', value: 'JOHN MWANGI KAMAU', source: 'Safaricom', retrievedAt: GENERATED_AT, confidence: 99.9, matchRule: 'Exact (normalised)' },
      { label: 'Name Match Result', value: 'MATCH — full name and ID number agree', source: 'Safaricom', retrievedAt: GENERATED_AT, confidence: 99.9 },
      { label: 'KYC Tier', value: 'Tier 3 (full KYC — ID verified)', source: 'Safaricom', retrievedAt: GENERATED_AT, confidence: 99.0 },
      { label: 'Account Status', value: 'Active', source: 'Safaricom', retrievedAt: GENERATED_AT, confidence: 100 },
      { label: 'Active Since', value: '14 August 2012', source: 'Safaricom', retrievedAt: GENERATED_AT, confidence: 99.4 },
      { label: 'Daily Transaction Limit', value: 'KES 300,000', source: 'Safaricom', retrievedAt: GENERATED_AT, confidence: 98.0 },
      { label: 'Single Transaction Limit', value: 'KES 150,000', source: 'Safaricom', retrievedAt: GENERATED_AT, confidence: 98.0 },
      { label: 'Activity Band', value: 'High — 40+ transactions per month', source: 'Safaricom analytics', retrievedAt: GENERATED_AT, confidence: 94.6 },
      { label: 'Average Monthly Turnover', value: 'KES 148,300', source: 'Safaricom analytics', retrievedAt: GENERATED_AT, confidence: 93.8 },
      { label: 'SIM Swap Events (24m)', value: '0', source: 'Safaricom', retrievedAt: GENERATED_AT, confidence: 99.2 },
      { label: 'Last Active', value: '23 September 2026, 08:14 EAT', source: 'Safaricom', retrievedAt: GENERATED_AT, confidence: 99.7 },
      { label: 'Secondary Lines Linked', value: '1 — 0733 908 112 (same ID)', source: 'Safaricom', retrievedAt: GENERATED_AT, confidence: 91.5, masked: true },
    ],
    rawResponse: {
      msisdn: '254712345678',
      account_name: 'JOHN MWANGI KAMAU',
      match_result: 'MATCH',
      kyc_tier: 3,
      status: 'ACTIVE',
      active_since: '2012-08-14',
      sim_swaps_24m: 0,
      avg_monthly_turnover_kes: 148300,
    },
  },
  {
    id: 'sec-crb',
    title: 'CRB Credit Records',
    provider: 'TransUnion CRB Kenya',
    state: 'verified',
    confidence: 98.6,
    retrievedAt: '2026-09-23T09:42:06.000Z',
    latencyMs: 8240,
    costKes: 450,
    summary:
      'Credit score 785 (low risk band). Two open facilities totalling KES 1.24M against a KES 2.1M limit, both current. No adverse listings and no default history.',
    fields: [
      { label: 'Credit Score', value: '785 / 900', source: 'TransUnion', retrievedAt: GENERATED_AT, confidence: 99.0 },
      { label: 'Score Band', value: 'Low Risk (720–900)', source: 'TransUnion', retrievedAt: GENERATED_AT, confidence: 99.0 },
      { label: 'Listing Status', value: 'Not listed — no default record', source: 'TransUnion', retrievedAt: GENERATED_AT, confidence: 99.4 },
      { label: 'Total Facilities', value: '2 open, 3 closed', source: 'TransUnion', retrievedAt: GENERATED_AT, confidence: 98.2 },
      { label: 'Total Credit Limit', value: 'KES 2,100,000', source: 'TransUnion', retrievedAt: GENERATED_AT, confidence: 98.7 },
      { label: 'Total Outstanding', value: 'KES 1,243,800', source: 'TransUnion', retrievedAt: GENERATED_AT, confidence: 98.7 },
      { label: 'Utilisation', value: '59.2%', source: 'Computed', retrievedAt: GENERATED_AT, confidence: 98.7 },
      { label: 'Oldest Facility', value: 'Equity Bank — opened 04 Sep 2016 (10 years)', source: 'TransUnion', retrievedAt: GENERATED_AT, confidence: 97.9 },
      { label: 'Enquiries (12 months)', value: '3', source: 'TransUnion', retrievedAt: GENERATED_AT, confidence: 98.4 },
      { label: 'Days Since Last Enquiry', value: '41', source: 'TransUnion', retrievedAt: GENERATED_AT, confidence: 98.4 },
      { label: 'Adverse Listings', value: 'None', source: 'TransUnion', retrievedAt: GENERATED_AT, confidence: 99.6 },
      { label: 'Arrears (all facilities)', value: 'KES 0 — 0 days past due', source: 'TransUnion', retrievedAt: GENERATED_AT, confidence: 98.9 },
      { label: 'Guarantor Obligations', value: 'None outstanding', source: 'TransUnion', retrievedAt: GENERATED_AT, confidence: 96.3 },
    ],
    rawResponse: {
      score: 785,
      score_band: 'LOW_RISK',
      listed: false,
      open_facilities: 2,
      closed_facilities: 3,
      total_limit_kes: 2100000,
      total_outstanding_kes: 1243800,
      utilisation_pct: 59.2,
      enquiries_12m: 3,
      adverse_listings: 0,
      dpd_max_12m: 0,
    },
    flags: [{ level: 'info', text: 'Utilisation of 59.2% is within the healthy band (< 70%).' }],
  },
  {
    id: 'sec-employer',
    title: 'Employer Verification',
    provider: 'Corporate Payroll Registry',
    state: 'verified',
    confidence: 97.4,
    retrievedAt: '2026-09-23T09:42:09.000Z',
    latencyMs: 2130,
    costKes: 150,
    summary:
      'Current employment confirmed with Safaricom PLC since 2019, progressing from Engineer to Senior Systems Engineer. Two prior employments verified.',
    fields: [
      { label: 'Current Employer', value: 'Safaricom Telecommunications PLC', source: 'Payroll registry', retrievedAt: GENERATED_AT, confidence: 99.1, matchRule: 'Exact' },
      { label: 'Employer PIN', value: 'P051234567Q', source: 'Payroll registry', retrievedAt: GENERATED_AT, confidence: 97.2, masked: true },
      { label: 'Position', value: 'Senior Systems Engineer', source: 'Payroll registry', retrievedAt: GENERATED_AT, confidence: 98.4 },
      { label: 'Department', value: 'Enterprise Infrastructure — Core Network', source: 'Payroll registry', retrievedAt: GENERATED_AT, confidence: 94.8 },
      { label: 'Employment Start', value: '01 April 2019', source: 'Payroll registry', retrievedAt: GENERATED_AT, confidence: 98.9 },
      { label: 'Tenure', value: '7 years 5 months', source: 'Computed', retrievedAt: GENERATED_AT, confidence: 98.9 },
      { label: 'Contract Type', value: 'Permanent & Pensionable', source: 'Payroll registry', retrievedAt: GENERATED_AT, confidence: 97.6 },
      { label: 'Employment Status', value: 'Active — full time', source: 'Payroll registry', retrievedAt: GENERATED_AT, confidence: 99.3 },
      { label: 'Gross Monthly Band', value: 'KES 250,000 – 300,000', source: 'Payroll band', retrievedAt: GENERATED_AT, confidence: 92.4 },
      { label: 'PAYE Remittance', value: 'Current — last remitted 09 Sep 2026', source: 'KRA PAYE', retrievedAt: GENERATED_AT, confidence: 98.1 },
      { label: 'NSSF / NHIF / SHIF', value: 'All active and current', source: 'Statutory registry', retrievedAt: GENERATED_AT, confidence: 96.7 },
      { label: 'Disciplinary Record', value: 'None disclosed', source: 'Employer attestation', retrievedAt: GENERATED_AT, confidence: 88.3 },
      { label: 'Previous Employer', value: 'Liquid Telecom Kenya — Network Engineer (2016–2019)', source: 'Payroll registry', retrievedAt: GENERATED_AT, confidence: 95.5 },
      { label: 'Reason for Leaving', value: 'Career progression (voluntary)', source: 'Employer attestation', retrievedAt: GENERATED_AT, confidence: 90.1 },
    ],
    rawResponse: {
      employer: 'SAFARICOM TELECOMMUNICATIONS PLC',
      position: 'SENIOR SYSTEMS ENGINEER',
      start_date: '2019-04-01',
      contract_type: 'PERMANENT',
      status: 'ACTIVE',
      gross_band_kes: '250000-300000',
      paye_current: true,
      prior_employer: 'LIQUID TELECOM KENYA',
    },
  },
  {
    id: 'sec-utility',
    title: 'Utility & Address Verification',
    provider: 'KPLC Grid API',
    state: 'verified',
    confidence: 96.1,
    retrievedAt: '2026-09-23T09:42:12.000Z',
    latencyMs: 1180,
    costKes: 60,
    summary:
      'Active post-paid electricity account in the subject\u2019s name at the declared residential address, connected since 2019 with consistent payment behaviour.',
    fields: [
      { label: 'Utility Provider', value: 'Kenya Power & Lighting Company (KPLC)', source: 'KPLC', retrievedAt: GENERATED_AT, confidence: 100 },
      { label: 'Meter Number', value: '04219842-12', source: 'KPLC', retrievedAt: GENERATED_AT, confidence: 99.2, masked: true },
      { label: 'Account Name', value: 'JOHN MWANGI KAMAU', source: 'KPLC', retrievedAt: GENERATED_AT, confidence: 99.4, matchRule: 'Exact (normalised)' },
      { label: 'Account Type', value: 'Post-paid — domestic', source: 'KPLC', retrievedAt: GENERATED_AT, confidence: 98.6 },
      { label: 'Account Status', value: 'Active', source: 'KPLC', retrievedAt: GENERATED_AT, confidence: 99.7 },
      { label: 'Connected Since', value: '22 November 2019', source: 'KPLC', retrievedAt: GENERATED_AT, confidence: 98.9 },
      { label: 'Supply Address', value: 'Apt 4B, Riverside Gardens, Chiromo Road, Nairobi', source: 'KPLC', retrievedAt: GENERATED_AT, confidence: 96.8 },
      { label: 'Average Monthly Bill', value: 'KES 6,420', source: 'KPLC billing', retrievedAt: GENERATED_AT, confidence: 95.4 },
      { label: 'Arrears', value: 'KES 0', source: 'KPLC ledger', retrievedAt: GENERATED_AT, confidence: 99.1 },
      { label: 'Payment Behaviour', value: 'Consistent — 24 of 24 months paid on time', source: 'KPLC billing', retrievedAt: GENERATED_AT, confidence: 96.2 },
      { label: 'Last Payment', value: '04 September 2026 — KES 6,180 (M-PESA)', source: 'KPLC', retrievedAt: GENERATED_AT, confidence: 98.3 },
      { label: 'Disconnections (24m)', value: '0', source: 'KPLC', retrievedAt: GENERATED_AT, confidence: 97.7 },
      { label: 'Address Corroboration', value: 'Matches declared residential address and CRB facility address', source: 'Cross-match engine', retrievedAt: GENERATED_AT, confidence: 95.9 },
    ],
    rawResponse: {
      meter_no: '04219842-12',
      account_name: 'JOHN MWANGI KAMAU',
      account_status: 'ACTIVE',
      connected_since: '2019-11-22',
      arrears_kes: 0,
      months_paid_on_time_24m: 24,
      last_payment_date: '2026-09-04',
      last_payment_kes: 6180,
    },
  },
  {
    id: 'sec-business',
    title: 'Business & Directorship (KYB)',
    provider: 'Business Registration Service',
    state: 'partial',
    confidence: 93.4,
    retrievedAt: '2026-09-23T09:42:13.000Z',
    latencyMs: 2460,
    costKes: 350,
    summary:
      'One active directorship and one dormant sole proprietorship identified. Beneficial ownership declared at 40% in the active entity.',
    fields: [
      { label: 'Active Directorships', value: '1 — Kamtech Solutions Limited', source: 'BRS', retrievedAt: GENERATED_AT, confidence: 97.2 },
      { label: 'Company Registration No.', value: 'C-2021-447812', source: 'BRS', retrievedAt: GENERATED_AT, confidence: 98.1 },
      { label: 'Incorporated On', value: '17 March 2021', source: 'BRS', retrievedAt: GENERATED_AT, confidence: 98.4 },
      { label: 'Company Status', value: 'Active — annual returns current', source: 'BRS', retrievedAt: GENERATED_AT, confidence: 96.9 },
      { label: 'Role', value: 'Director & Shareholder', source: 'BRS', retrievedAt: GENERATED_AT, confidence: 97.8 },
      { label: 'Shareholding', value: '40% (400 of 1,000 ordinary shares)', source: 'BRS beneficial ownership register', retrievedAt: GENERATED_AT, confidence: 94.2 },
      { label: 'Beneficial Owner Declared', value: 'Yes — declared 04 June 2023', source: 'BRS', retrievedAt: GENERATED_AT, confidence: 95.6 },
      { label: 'Company KRA PIN', value: 'P051998776M', source: 'iTax entity', retrievedAt: GENERATED_AT, confidence: 96.3, masked: true },
      { label: 'Company Tax Standing', value: 'Good standing — nil liability', source: 'iTax entity', retrievedAt: GENERATED_AT, confidence: 95.1 },
      { label: 'Co-directors', value: '2 — Mary Wanjiru Kamau (60%), registered as spouse', source: 'BRS', retrievedAt: GENERATED_AT, confidence: 92.7 },
      { label: 'Sole Proprietorships', value: '1 — "JMK Consulting" (dissolved 2020)', source: 'BRS', retrievedAt: GENERATED_AT, confidence: 89.4 },
      { label: 'Litigation Against Entity', value: 'None recorded', source: 'Judiciary cause lists', retrievedAt: GENERATED_AT, confidence: 91.8 },
    ],
    rawResponse: {
      entities_found: 2,
      active_directorships: 1,
      company_name: 'KAMTECH SOLUTIONS LIMITED',
      reg_no: 'C-2021-447812',
      status: 'ACTIVE',
      shareholding_pct: 40,
      bo_declared: true,
      company_tax_standing: 'GOOD',
      litigation_count: 0,
    },
    flags: [
      { level: 'info', text: 'Confidence held below 95% because the beneficial-ownership declaration predates the 2024 register refresh.' },
    ],
  },
  {
    id: 'sec-connections',
    title: 'Connections & Relationships',
    provider: 'IPRS Relationship Graph',
    state: 'verified',
    confidence: 92.8,
    retrievedAt: '2026-09-23T09:42:13.500Z',
    latencyMs: 1640,
    costKes: 0,
    summary:
      'Seven verified relationships across family, business, financial and address dimensions. No relationship links to a sanctioned or high-risk PEP.',
    fields: [
      { label: 'Total Verified Links', value: '7', source: 'Graph engine', retrievedAt: GENERATED_AT, confidence: 92.8 },
      { label: 'Family Links', value: '2 (spouse, sibling)', source: 'IPRS next-of-kin', retrievedAt: GENERATED_AT, confidence: 95.1 },
      { label: 'Business Links', value: '2 (co-director, business partner)', source: 'BRS', retrievedAt: GENERATED_AT, confidence: 94.4 },
      { label: 'Financial Links', value: '1 (joint account holder)', source: 'CRB facility data', retrievedAt: GENERATED_AT, confidence: 90.6 },
      { label: 'Shared Address Links', value: '1', source: 'KPLC + postal', retrievedAt: GENERATED_AT, confidence: 88.9 },
      { label: 'Shared Phone Links', value: '1 (secondary line holder)', source: 'Safaricom', retrievedAt: GENERATED_AT, confidence: 89.7 },
      { label: 'Guarantor Relationships', value: '1 — guaranteed a KES 300,000 facility (closed 2023)', source: 'CRB', retrievedAt: GENERATED_AT, confidence: 93.2 },
      { label: 'PEP-linked Relations', value: '0', source: 'Screening engine', retrievedAt: GENERATED_AT, confidence: 96.4 },
      { label: 'Sanctioned Relations', value: '0', source: 'Screening engine', retrievedAt: GENERATED_AT, confidence: 96.4 },
    ],
    rawResponse: {
      nodes: 8,
      edges: 7,
      family: 2,
      business: 2,
      financial: 1,
      address: 1,
      phone: 1,
      pep_linked: 0,
      sanctioned_linked: 0,
    },
  },
  {
    id: 'sec-screening',
    title: 'PEP, Sanctions & Adverse Media',
    provider: 'Global Watchlist Aggregator',
    state: 'verified',
    confidence: 96.9,
    retrievedAt: '2026-09-23T09:42:14.000Z',
    latencyMs: 940,
    costKes: 120,
    summary: 'No PEP status, no sanctions match and no adverse media. Screening covered 42 watchlists and 18 months of media.',
    fields: [
      { label: 'PEP Status', value: 'Not a PEP', source: 'Watchlist aggregator', retrievedAt: GENERATED_AT, confidence: 97.2 },
      { label: 'PEP by Association', value: 'None identified', source: 'Watchlist aggregator', retrievedAt: GENERATED_AT, confidence: 94.8 },
      { label: 'UN Consolidated List', value: 'No match', source: 'UN', retrievedAt: GENERATED_AT, confidence: 98.6 },
      { label: 'OFAC SDN List', value: 'No match', source: 'OFAC', retrievedAt: GENERATED_AT, confidence: 98.6 },
      { label: 'EU Consolidated List', value: 'No match', source: 'EU', retrievedAt: GENERATED_AT, confidence: 98.4 },
      { label: 'HMT / UK Sanctions', value: 'No match', source: 'HMT', retrievedAt: GENERATED_AT, confidence: 98.2 },
      { label: 'Kenya FRA Watchlist', value: 'No match', source: 'Financial Reporting Centre', retrievedAt: GENERATED_AT, confidence: 97.1 },
      { label: 'Adverse Media Hits', value: '0 (18-month window, 42 sources)', source: 'Media monitor', retrievedAt: GENERATED_AT, confidence: 93.4 },
      { label: 'Lists Screened', value: '42', source: 'Aggregator', retrievedAt: GENERATED_AT, confidence: 99.0 },
      { label: 'Name Match Precision', value: 'Exact + fuzzy (Levenshtein <= 2) — no candidates returned', source: 'Matching engine', retrievedAt: GENERATED_AT, confidence: 95.7 },
    ],
    rawResponse: {
      pep: false,
      pep_association: false,
      sanctions_match: false,
      lists_screened: 42,
      adverse_media_hits: 0,
      media_window_months: 18,
      best_match_score: 0.31,
    },
  },
  {
    id: 'sec-criminal',
    title: 'Criminal & Court Records',
    provider: 'Judiciary Records',
    state: 'not_found',
    confidence: 91.2,
    retrievedAt: '2026-09-23T09:42:17.000Z',
    latencyMs: 3120,
    costKes: 250,
    summary:
      'No criminal case, civil suit or insolvency proceeding found against the subject in the searchable judiciary cause lists (2010 to date).',
    fields: [
      { label: 'Criminal Cases', value: '0 records', source: 'Judiciary cause lists', retrievedAt: GENERATED_AT, confidence: 92.4 },
      { label: 'Civil Suits', value: '0 records', source: 'Judiciary cause lists', retrievedAt: GENERATED_AT, confidence: 90.8 },
      { label: 'Traffic Offences', value: '2 minor (2018, 2021) — both settled by fine', source: 'NTSA / Judiciary', retrievedAt: GENERATED_AT, confidence: 88.6 },
      { label: 'Insolvency / Bankruptcy', value: 'None', source: 'Kenya Gazette', retrievedAt: GENERATED_AT, confidence: 93.1 },
      { label: 'Search Coverage', value: '2010 – 2026, all magistrates\u2019 and high court stations', source: 'Judiciary', retrievedAt: GENERATED_AT, confidence: 89.9 },
      { label: 'Certificate of Good Conduct', value: 'Held — issued 14 Feb 2024 by DCI, valid 12 months', source: 'DCI', retrievedAt: GENERATED_AT, confidence: 95.3 },
      { label: 'Outstanding Warrants', value: 'None', source: 'DCI', retrievedAt: GENERATED_AT, confidence: 94.2 },
    ],
    rawResponse: {
      criminal_records: 0,
      civil_suits: 0,
      traffic_offences: 2,
      insolvency: false,
      warrants: 0,
      good_conduct_cert: true,
      coverage_from: '2010-01-01',
    },
    flags: [
      { level: 'info', text: 'Two settled minor traffic matters are disclosed for completeness and carry no risk weight.' },
      { level: 'warning', text: 'Judiciary digitisation is incomplete for stations before 2013; residual coverage risk acknowledged.' },
    ],
  },
  {
    id: 'sec-financial',
    title: 'Financial Analysis',
    provider: 'IPRS Analytics Engine',
    state: 'verified',
    confidence: 95.4,
    retrievedAt: '2026-09-23T09:42:17.500Z',
    latencyMs: 420,
    costKes: 0,
    summary:
      'Estimated gross annual income of KES 3.3M against total debt service of KES 1.12M — a debt-to-income ratio of 34%, comfortably within the 45% lending threshold.',
    fields: [
      { label: 'Estimated Gross Monthly Income', value: 'KES 275,000', source: 'Payroll band midpoint', retrievedAt: GENERATED_AT, confidence: 92.4 },
      { label: 'Estimated Gross Annual Income', value: 'KES 3,300,000', source: 'Computed', retrievedAt: GENERATED_AT, confidence: 92.4 },
      { label: 'Verified Secondary Income', value: 'KES 0 declared', source: 'iTax', retrievedAt: GENERATED_AT, confidence: 90.1 },
      { label: 'Monthly M-PESA Turnover', value: 'KES 148,300', source: 'Safaricom analytics', retrievedAt: GENERATED_AT, confidence: 93.8 },
      { label: 'Total Debt Outstanding', value: 'KES 1,243,800', source: 'CRB', retrievedAt: GENERATED_AT, confidence: 98.7 },
      { label: 'Monthly Debt Service', value: 'KES 93,500', source: 'CRB schedule', retrievedAt: GENERATED_AT, confidence: 96.2 },
      { label: 'Debt-to-Income Ratio', value: '34.0%', source: 'Computed', retrievedAt: GENERATED_AT, confidence: 95.1 },
      { label: 'DTI Threshold', value: '45% (platform policy)', source: 'Risk engine', retrievedAt: GENERATED_AT, confidence: 100 },
      { label: 'Disposable Income Estimate', value: 'KES 181,500 / month', source: 'Computed', retrievedAt: GENERATED_AT, confidence: 89.7 },
      { label: 'Savings Signal', value: 'Positive — recurring transfers to a money-market fund', source: 'M-PESA pattern analysis', retrievedAt: GENERATED_AT, confidence: 84.2 },
      { label: 'Utility Payment Score', value: 'A (100% on-time over 24 months)', source: 'KPLC', retrievedAt: GENERATED_AT, confidence: 96.2 },
      { label: 'Income Stability', value: 'High — 7 years 5 months with a single employer', source: 'Payroll registry', retrievedAt: GENERATED_AT, confidence: 95.5 },
      { label: 'Financial Red Flags', value: 'None', source: 'Risk engine', retrievedAt: GENERATED_AT, confidence: 94.8 },
    ],
    rawResponse: {
      est_gross_monthly_kes: 275000,
      est_gross_annual_kes: 3300000,
      monthly_debt_service_kes: 93500,
      dti_pct: 34.0,
      dti_threshold_pct: 45,
      disposable_income_kes: 181500,
      utility_score: 'A',
      red_flags: 0,
    },
  },
  {
    id: 'sec-risk',
    title: 'Risk Determination',
    provider: 'IPRS Risk Engine v3.2',
    state: 'verified',
    confidence: 99.0,
    retrievedAt: '2026-09-23T09:42:18.000Z',
    latencyMs: 180,
    costKes: 0,
    summary:
      'Composite trust score of 92/100 places the subject in the Low Risk band. Nine of ten weighted factors scored positively; no factor breached its alert threshold.',
    fields: [
      { label: 'Composite Trust Score', value: '92 / 100', source: 'Risk engine v3.2', retrievedAt: GENERATED_AT, confidence: 99.0 },
      { label: 'Risk Band', value: 'Low Risk (>= 80)', source: 'Risk engine', retrievedAt: GENERATED_AT, confidence: 100 },
      { label: 'Determination', value: 'Identity confirmed; no adverse findings; cleared for onboarding', source: 'Risk engine', retrievedAt: GENERATED_AT, confidence: 99.0 },
      { label: 'Factors Evaluated', value: '10', source: 'Risk engine', retrievedAt: GENERATED_AT, confidence: 100 },
      { label: 'Factors Positive', value: '9', source: 'Risk engine', retrievedAt: GENERATED_AT, confidence: 100 },
      { label: 'Factors Adverse', value: '0', source: 'Risk engine', retrievedAt: GENERATED_AT, confidence: 100 },
      { label: 'Factors Insufficient', value: '1 (beneficial-ownership recency)', source: 'Risk engine', retrievedAt: GENERATED_AT, confidence: 93.4 },
      { label: 'Data Completeness', value: '98.2% of requested fields returned', source: 'Orchestrator', retrievedAt: GENERATED_AT, confidence: 98.2 },
      { label: 'Cross-Registry Agreement', value: '5 of 5 registries agree on name + ID', source: 'Cross-match engine', retrievedAt: GENERATED_AT, confidence: 99.4 },
      { label: 'Manual Review Required', value: 'No', source: 'Risk engine', retrievedAt: GENERATED_AT, confidence: 99.0 },
      { label: 'Recommendation', value: 'Proceed — standard monitoring, re-verify in 12 months', source: 'Risk engine', retrievedAt: GENERATED_AT, confidence: 99.0 },
      { label: 'Model Version', value: 'IPRS-RISK-v3.2 (2026-06-14)', source: 'Risk engine', retrievedAt: GENERATED_AT, confidence: 100 },
    ],
    rawResponse: {
      score: 92,
      band: 'LOW',
      factors_total: 10,
      factors_positive: 9,
      factors_adverse: 0,
      completeness_pct: 98.2,
      review_required: false,
      model: 'IPRS-RISK-v3.2',
    },
  },
];

export const primaryDossier: Dossier = {
  id: 'DOS-2026-00921',
  reportId: 'IPRS-R-2026-23456789',
  generatedAt: GENERATED_AT,
  subject: {
    fullName: 'John Mwangi Kamau',
    firstName: 'John',
    middleName: 'Mwangi',
    lastName: 'Kamau',
    aliases: ['JOHN M. KAMAU', 'J. MWANGI'],
    gender: 'Male',
    dob: '15 May 1990',
    dobRaw: '1990-05-15',
    nationality: 'Kenyan (by birth)',
    idNumber: '23456789',
    idType: 'National Identity Card (2nd generation)',
    passportNumber: 'A0912347B',
    kraPin: 'A123456789K',
    phone: '0712 345 678',
    altPhones: ['0733 908 112'],
    email: 'j.mwangi.kamau@protonmail.com',
    maritalStatus: 'Married',
    nextOfKin: 'Mary Wanjiru Kamau (spouse) — 0722 441 908',
    county: 'Nairobi',
    subCounty: 'Westlands',
    constituency: 'Westlands',
    ward: 'Kitisuru',
    registrationSerial: 'KE-2345-6789-114',
    photoMatchScore: 97.4,
    deceased: false,
  },
  addresses: [
    {
      id: 'ad-1',
      type: 'Residential',
      line: 'Apt 4B, Riverside Gardens, Chiromo Road',
      city: 'Nairobi',
      county: 'Nairobi',
      postalCode: '00100',
      since: 'Nov 2019',
      confirmedBy: 'KPLC meter 04219842-12',
      current: true,
    },
    {
      id: 'ad-2',
      type: 'Postal',
      line: 'P.O. Box 41208',
      city: 'Nairobi',
      county: 'Nairobi',
      postalCode: '00100',
      since: 'Mar 2018',
      confirmedBy: 'Postal Corporation registry',
      current: true,
    },
    {
      id: 'ad-3',
      type: 'Business',
      line: 'Safaricom HQ, Waiyaki Way, Westlands',
      city: 'Nairobi',
      county: 'Nairobi',
      postalCode: '00100',
      since: 'Apr 2019',
      confirmedBy: 'Employer payroll record',
      current: true,
    },
    {
      id: 'ad-4',
      type: 'Physical',
      line: 'Murang\u2019a Township, Plot 442',
      city: 'Murang\u2019a',
      county: 'Murang\u2019a',
      since: '1990',
      confirmedBy: 'IPRS place-of-birth record (historical)',
      current: false,
    },
  ],
  documents: [
    { id: 'doc-1', type: 'National Identity Card', number: '23456789', issuedBy: 'IPRS', issuedOn: '02 Mar 2018', expiresOn: '02 Mar 2028', status: 'Valid' },
    { id: 'doc-2', type: 'International Passport', number: 'A0912347B', issuedBy: 'Directorate of Immigration', issuedOn: '19 Jul 2021', expiresOn: '18 Jul 2031', status: 'Valid' },
    { id: 'doc-3', type: 'KRA PIN Certificate', number: 'A123456789K', issuedBy: 'Kenya Revenue Authority', issuedOn: '18 Jun 2012', status: 'Valid' },
    { id: 'doc-4', type: 'Tax Compliance Certificate', number: 'TCC-2026-118842', issuedBy: 'KRA iTax', issuedOn: '12 Jan 2026', expiresOn: '12 Jan 2027', status: 'Valid' },
    { id: 'doc-5', type: 'Certificate of Good Conduct', number: 'DCI/GC/2024/77120', issuedBy: 'DCI', issuedOn: '14 Feb 2024', expiresOn: '13 Feb 2025', status: 'Expired' },
    { id: 'doc-6', type: 'CRB Clearance Certificate', number: 'CRB-2026-448201', issuedBy: 'TransUnion', issuedOn: '23 Sep 2026', expiresOn: '23 Mar 2027', status: 'Valid' },
  ],
  employment: [
    {
      id: 'emp-1',
      company: 'Safaricom Telecommunications PLC',
      position: 'Senior Systems Engineer',
      startDate: '01 Apr 2019',
      current: true,
      verifiedBy: 'Corporate Payroll Registry',
      verificationState: 'verified',
      monthlyBand: 'KES 250,000 – 300,000',
      contractType: 'Permanent & Pensionable',
    },
    {
      id: 'emp-2',
      company: 'Safaricom Telecommunications PLC',
      position: 'Systems Engineer',
      startDate: '01 Apr 2019',
      endDate: '31 Mar 2022',
      current: false,
      verifiedBy: 'Corporate Payroll Registry',
      verificationState: 'verified',
      contractType: 'Permanent',
    },
    {
      id: 'emp-3',
      company: 'Liquid Telecom Kenya Ltd',
      position: 'Network Engineer',
      startDate: '05 Jan 2016',
      endDate: '31 Mar 2019',
      current: false,
      verifiedBy: 'Corporate Payroll Registry',
      verificationState: 'verified',
      monthlyBand: 'KES 140,000 – 180,000',
      contractType: 'Permanent',
    },
    {
      id: 'emp-4',
      company: 'Kenya Power Internship Programme',
      position: 'Graduate Trainee — Metering',
      startDate: '01 Sep 2014',
      endDate: '31 Aug 2015',
      current: false,
      verifiedBy: 'Employer attestation (unverified in registry)',
      verificationState: 'partial',
      contractType: 'Fixed-term internship',
    },
  ],
  tax: {
    pin: 'A123456789K',
    status: 'Active — Good Standing',
    registeredOn: '18 June 2012',
    obligationTypes: ['PAYE', 'Income Tax — Individual', 'Withholding Tax'],
    complianceYears: [
      { year: '2026', returnsFiled: true, paid: true, outstandingKes: 0 },
      { year: '2025', returnsFiled: true, paid: true, outstandingKes: 0 },
      { year: '2024', returnsFiled: true, paid: true, outstandingKes: 0 },
      { year: '2023', returnsFiled: true, paid: true, outstandingKes: 0 },
      { year: '2022', returnsFiled: true, paid: true, outstandingKes: 0 },
    ],
    outstandingKes: 0,
    lastReturnFiled: '28 June 2026 (IT1 2025)',
    goodStanding: true,
  },
  mobileMoney: {
    accountName: 'JOHN MWANGI KAMAU',
    msisdn: '0712 345 678',
    activeSince: '14 August 2012',
    kycTier: 'Tier 3 (full KYC)',
    dailyLimitKes: 300000,
    transactionLimitKes: 150000,
    activityBand: 'High — 40+ transactions / month',
    avgMonthlyTurnoverKes: 148300,
    status: 'Active',
    simSwapEvents: 0,
    lastActive: '23 Sep 2026, 08:14 EAT',
  },
  credit: {
    bureau: 'TransUnion CRB Kenya',
    score: 785,
    scoreBand: 'Low Risk (720–900)',
    listingStatus: 'Not listed',
    totalFacilities: 5,
    totalOutstandingKes: 1243800,
    totalLimitKes: 2100000,
    utilisationPct: 59.2,
    oldestFacility: '04 Sep 2016',
    daysSinceLastEnquiry: 41,
    enquiries12m: 3,
    facilities: [
      { id: 'f-1', institution: 'Equity Bank Kenya', type: 'Mortgage', openedOn: '04 Sep 2016', limit: 1500000, outstanding: 943800, status: 'Current', arrears: 0 },
      { id: 'f-2', institution: 'M-KOPA Financial Services', type: 'Asset finance', openedOn: '12 Feb 2024', limit: 600000, outstanding: 300000, status: 'Current', arrears: 0 },
      { id: 'f-3', institution: 'Co-operative Bank', type: 'Unsecured personal loan', openedOn: '08 Mar 2021', limit: 400000, outstanding: 0, status: 'Closed', arrears: 0 },
      { id: 'f-4', institution: 'Safaricom M-Shwari', type: 'Mobile micro-credit', openedOn: '19 Jun 2019', limit: 150000, outstanding: 0, status: 'Closed', arrears: 0 },
      { id: 'f-5', institution: 'Family Bank', type: 'Salary advance', openedOn: '22 Nov 2018', limit: 80000, outstanding: 0, status: 'Closed', arrears: 0 },
    ],
    adverseListings: [],
  },
  utility: {
    provider: 'Kenya Power & Lighting Company (KPLC)',
    meterNumber: '04219842-12',
    accountStatus: 'Active',
    connectedSince: '22 November 2019',
    avgMonthlyBillKes: 6420,
    arrearsKes: 0,
    paymentBehaviour: 'Consistent — 24 of 24 months on time',
    lastPayment: '04 Sep 2026 — KES 6,180 (M-PESA)',
  },
  business: {
    isDirector: true,
    isBeneficialOwner: true,
    soleProprietorships: 1,
    links: [
      { id: 'bl-1', companyName: 'Kamtech Solutions Limited', registrationNo: 'C-2021-447812', role: 'Director & Shareholder', shareholdingPct: 40, status: 'Active', incorporatedOn: '17 Mar 2021', verifiedBy: 'BRS' },
      { id: 'bl-2', companyName: 'JMK Consulting (sole proprietorship)', registrationNo: 'BN-2018-339120', role: 'Owner', shareholdingPct: 100, status: 'Dissolved', incorporatedOn: '02 Aug 2018', verifiedBy: 'BRS' },
    ],
  },
  screening: {
    pep: false,
    pepDetail: 'No PEP status and no PEP association identified across 42 watchlists.',
    sanctions: false,
    sanctionsDetail: 'No match on UN, OFAC, EU, HMT or Kenya FRA lists.',
    adverseMedia: 0,
    criminalRecords: [],
    civilLitigation: 0,
    insolvency: false,
  },
  relationships: [
    { id: 'rel-1', name: 'Mary Wanjiru Kamau', relation: 'Spouse', linkType: 'Family', strength: 'Strong', evidence: 'IPRS next-of-kin + 60% co-shareholder in Kamtech Solutions Ltd', pep: false, sanctioned: false },
    { id: 'rel-2', name: 'Peter Mwangi Kamau', relation: 'Sibling', linkType: 'Family', strength: 'Strong', evidence: 'Shared parentage in IPRS record + shared residential address (2016–2019)', pep: false, sanctioned: false },
    { id: 'rel-3', name: 'Grace Njeri Mwangi', relation: 'Mother', linkType: 'Family', strength: 'Moderate', evidence: 'IPRS parentage record', pep: false, sanctioned: false },
    { id: 'rel-4', name: 'Samuel Otieno Achieng', relation: 'Co-director', linkType: 'Business', strength: 'Strong', evidence: 'Kamtech Solutions Ltd — registered company secretary', pep: false, sanctioned: false },
    { id: 'rel-5', name: 'Daniel Kipchoge Rono', relation: 'Business partner', linkType: 'Business', strength: 'Moderate', evidence: 'Joint supplier contract with Kamtech Solutions Ltd (2023)', pep: false, sanctioned: false },
    { id: 'rel-6', name: 'Mary Wanjiru Kamau', relation: 'Joint account holder', linkType: 'Financial', strength: 'Strong', evidence: 'Equity Bank mortgage facility f-1 held jointly', pep: false, sanctioned: false },
    { id: 'rel-7', name: 'Alice Achieng Owino', relation: 'Shared phone contact', linkType: 'Phone', strength: 'Weak', evidence: 'Frequent M-PESA counterparty (18 transactions, 12 months)', pep: false, sanctioned: false },
  ],
  risk: {
    score: 92,
    band: 'Low',
    verdict: 'Low Risk — Identity Confirmed, Clean Record',
    drivers: [
      { factor: 'Civil registration match', weight: 20, contribution: 20, direction: 'positive' },
      { factor: 'KRA tax compliance', weight: 15, contribution: 15, direction: 'positive' },
      { factor: 'M-PESA tenure & KYC tier', weight: 10, contribution: 10, direction: 'positive' },
      { factor: 'CRB score & no listings', weight: 20, contribution: 19, direction: 'positive' },
      { factor: 'Employment stability', weight: 10, contribution: 10, direction: 'positive' },
      { factor: 'Utility payment behaviour', weight: 8, contribution: 8, direction: 'positive' },
      { factor: 'No criminal / court records', weight: 10, contribution: 10, direction: 'positive' },
      { factor: 'PEP & sanctions clear', weight: 5, contribution: 5, direction: 'positive' },
      { factor: 'Debt-to-income ratio (34%)', weight: 5, contribution: 4, direction: 'positive' },
      { factor: 'Beneficial-ownership recency', weight: 5, contribution: 1, direction: 'negative' },
    ],
    recommendation: 'Proceed. Standard ongoing monitoring; re-verify in 12 months or on a material change event.',
    reviewRequired: false,
  },
  sections,
  events,
  attestation: {
    preparedBy: 'Sarah Wanjiku',
    preparedByTier: 'user',
    sources: [
      'IPRS Civil Registration (National Registration Bureau)',
      'Kenya Revenue Authority iTax',
      'Safaricom M-PESA KYC Registry',
      'TransUnion Credit Reference Bureau Kenya',
      'Corporate Payroll Registry (employer verification)',
      'Kenya Power & Lighting Company (KPLC)',
      'Business Registration Service (BRS) / eCitizen',
      'Judiciary Cause Lists & Directorate of Criminal Investigations',
      'Global Watchlist Aggregator (PEP / sanctions / adverse media)',
    ],
    disclaimer:
      'This report is generated from third-party registry data retrieved at the timestamps shown and reflects the position at the time of enquiry only. It is supplied for the lawful purpose recorded in the consent reference and must not be used as the sole basis for an adverse decision without giving the subject an opportunity to respond, in line with the Data Protection Act 2019. Values marked as masked have been redacted under the platform PII-masking policy.',
    classification: 'CONFIDENTIAL — PERSONAL DATA (DPA 2019)',
    retentionExpiry: '23 September 2031',
  },
};

/* ------------------------- alternate subjects (variants) ------------------------- */

interface VariantSeed {
  key: string;
  fullName: string;
  idNumber: string;
  phone: string;
  county: string;
  score: number;
  band: 'Low' | 'Medium' | 'High';
}

const VARIANTS: VariantSeed[] = [
  { key: 'grace', fullName: 'Grace Wanjiku Njoroge', idNumber: '28941042', phone: '0723 456 789', county: 'Kiambu', score: 74, band: 'Medium' },
  { key: 'peter', fullName: 'Peter Kimani Maina', idNumber: '31204921', phone: '0734 567 890', county: 'Nakuru', score: 41, band: 'High' },
  { key: 'amina', fullName: 'Amina Hassan Ali', idNumber: '35118740', phone: '0741 220 887', county: 'Mombasa', score: 88, band: 'Low' },
];

/**
 * Derive a dossier for an alternate subject by re-scoring the primary record. The
 * structural shape is identical so every screen renders correctly; only the identifying
 * values, risk score, band and determination change.
 */
export function dossierForQuery(query: string, fullName?: string, idNumber?: string): Dossier {
  const needle = (fullName || query || '').toLowerCase();
  const seed =
    VARIANTS.find((v) => needle.includes(v.key) || needle.includes(v.fullName.toLowerCase().split(' ')[0])) ||
    VARIANTS.find((v) => v.idNumber === (idNumber || query || '').replace(/\D/g, '')) ||
    null;

  if (!seed) return primaryDossier;

  const [first, ...rest] = seed.fullName.split(' ');
  const last = rest[rest.length - 1] ?? '';
  const band = seed.band;
  const verdict =
    band === 'Low'
      ? 'Low Risk — Identity Confirmed, Clean Record'
      : band === 'Medium'
      ? 'Medium Risk — Identity Confirmed, Monitor Required'
      : 'High Risk — Adverse Indicators Present, Manual Review Required';

  const clone: Dossier = JSON.parse(JSON.stringify(primaryDossier)) as Dossier;
  clone.id = `DOS-2026-0${1000 + Math.floor(Math.random() * 8999)}`;
  clone.reportId = `IPRS-R-2026-${seed.idNumber}`;
  clone.generatedAt = new Date().toISOString();
  clone.subject = {
    ...clone.subject,
    fullName: seed.fullName,
    firstName: first,
    middleName: rest.length > 1 ? rest[0] : undefined,
    lastName: last,
    aliases: [`${first[0]}. ${last.toUpperCase()}`],
    idNumber: seed.idNumber,
    phone: seed.phone,
    county: seed.county,
    subCounty: seed.county,
    kraPin: `A${seed.idNumber.slice(0, 8)}${last[0] ?? 'K'}`.toUpperCase(),
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.co.ke`,
    photoMatchScore: band === 'High' ? 81.2 : band === 'Medium' ? 91.6 : 97.4,
  };
  clone.risk.score = seed.score;
  clone.risk.band = band;
  clone.risk.verdict = verdict;
  clone.risk.reviewRequired = band !== 'Low';
  clone.risk.recommendation =
    band === 'Low'
      ? 'Proceed. Standard ongoing monitoring; re-verify in 12 months.'
      : band === 'Medium'
      ? 'Proceed with enhanced monitoring. Obtain proof of income and re-verify within 90 days.'
      : 'Do not auto-approve. Escalate to manual review with documentary evidence before proceeding.';

  const riskSection = clone.sections.find((s) => s.id === 'sec-risk');
  if (riskSection) {
    riskSection.fields[0].value = `${seed.score} / 100`;
    riskSection.fields[1].value = `${band} Risk`;
    riskSection.fields[2].value = verdict;
    riskSection.fields[9].value = band === 'Low' ? 'No' : 'Yes';
    riskSection.state = band === 'High' ? 'partial' : 'verified';
    riskSection.confidence = band === 'High' ? 84.2 : 95.4;
  }

  const crbSection = clone.sections.find((s) => s.id === 'sec-crb');
  if (crbSection) {
    const score = band === 'High' ? 412 : band === 'Medium' ? 648 : 785;
    crbSection.fields[0].value = `${score} / 900`;
    crbSection.fields[1].value = band === 'High' ? 'High Risk (300–479)' : band === 'Medium' ? 'Medium Risk (600–719)' : 'Low Risk (720–900)';
    crbSection.fields[2].value = band === 'High' ? 'Listed — 1 default (KES 84,200)' : band === 'Medium' ? 'Watch — 1 facility 30 days past due' : 'Not listed — no default record';
    crbSection.state = band === 'High' ? 'mismatch' : 'verified';
    crbSection.summary =
      band === 'High'
        ? 'Adverse credit history: one defaulted facility of KES 84,200 listed 11 months ago, plus a 30-day past-due balance.'
        : band === 'Medium'
        ? 'Fair credit history with one facility 30 days past due; score inside the medium band.'
        : crbSection.summary;
    if (band === 'High') {
      crbSection.flags = [{ level: 'danger', text: 'Active CRB default listing — escalate before any credit decision.' }];
    }
  }

  clone.credit.score = band === 'High' ? 412 : band === 'Medium' ? 648 : 785;
  clone.credit.scoreBand = band === 'High' ? 'High Risk (300–479)' : band === 'Medium' ? 'Medium Risk (600–719)' : 'Low Risk (720–900)';
  clone.credit.listingStatus = band === 'High' ? 'Listed — default' : band === 'Medium' ? 'Watch' : 'Not listed';
  clone.credit.adverseListings =
    band === 'High'
      ? [{ id: 'al-1', institution: 'Digital credit lender', amountKes: 84200, listedOn: '14 Oct 2025', type: 'Default — 180+ days past due' }]
      : [];
  clone.subject.county = seed.county;
  clone.mobileMoney.msisdn = seed.phone;
  clone.mobileMoney.accountName = seed.fullName.toUpperCase();
  clone.tax.pin = clone.subject.kraPin;
  clone.tax.goodStanding = band !== 'High';
  clone.tax.status = band === 'High' ? 'Active — principal tax debt outstanding' : 'Active — Good Standing';
  clone.tax.outstandingKes = band === 'High' ? 62400 : 0;
  clone.screening.adverseMedia = band === 'High' ? 2 : 0;
  clone.attestation.preparedBy = 'Sarah Wanjiku';

  return clone;
}

/** Legacy profile shape derived from a dossier — keeps the profile header working. */
export function dossierToProfile(d: Dossier): IdentityProfile {
  return {
    id: d.id,
    fullName: d.subject.fullName,
    idNumber: d.subject.idNumber,
    phone: d.subject.phone,
    dob: d.subject.dob,
    gender: d.subject.gender,
    nationality: d.subject.nationality,
    county: d.subject.county,
    kraPin: d.subject.kraPin,
    avatarUrl: '/images/avatar-john.jpg',
    isVerified: d.risk.score >= 60,
    riskScore: d.risk.score,
    trustLevel: d.risk.band === 'Low' ? 'High' : d.risk.band === 'Medium' ? 'Medium' : 'Low',
    providers: {
      kra: { verified: d.tax.goodStanding, status: d.tax.goodStanding ? 'Verified' : 'Flagged', pin: d.tax.pin, taxCompliance: d.tax.goodStanding },
      mpesa: { verified: true, status: 'Verified', accountName: d.mobileMoney.accountName, activeSince: d.mobileMoney.activeSince },
      crb: { verified: !d.screening.insolvency, status: d.credit.listingStatus, score: d.credit.score, defaultStatus: d.credit.listingStatus },
      employer: { verified: true, status: 'Verified', company: d.employment[0]?.company ?? '—', position: d.employment[0]?.position ?? '—' },
      kplc: { verified: d.utility.arrearsKes === 0, status: d.utility.accountStatus, meterNumber: d.utility.meterNumber, activeAccount: d.utility.accountStatus === 'Active' },
    },
    keyFindings: [
      d.tax.goodStanding ? 'Valid KRA PIN with active tax compliance' : 'KRA principal tax debt outstanding',
      `Active M-PESA account since ${d.mobileMoney.activeSince}`,
      d.credit.adverseListings.length === 0 ? 'No negative CRB listings' : `${d.credit.adverseListings.length} adverse CRB listing(s)`,
      `Current employer verified — ${d.employment[0]?.company ?? 'n/a'}`,
      d.utility.arrearsKes === 0 ? 'Active KPLC account with no arrears' : 'KPLC arrears recorded',
      d.screening.pep ? 'PEP status identified' : 'Clear PEP & sanctions screening',
      d.screening.criminalRecords.length === 0 ? 'No criminal or civil court records' : `${d.screening.criminalRecords.length} court record(s)`,
    ],
  };
}
