import type { SystemSettings } from '../types';

/** Default System Settings. Every group is editable from the System Settings module. */
export const defaultSettings: SystemSettings = {
  org: {
    legalName: 'IPRS Identity Intelligence Limited',
    tradingName: 'IPRS Kenya',
    kraPin: 'P051776543K',
    registrationNo: 'C-2024-118834',
    address: 'Delta Corner, Building C — 3rd Floor, Chiromo Road, Westlands',
    city: 'Nairobi',
    country: 'Kenya',
    supportEmail: 'support@iprs.co.ke',
    supportPhone: '+254 709 118 000',
    website: 'https://iprs.co.ke',
    timezone: 'Africa/Nairobi (EAT, UTC+3)',
    locale: 'en-KE',
    currency: 'KES',
    fiscalYearStart: '01 January',
    businessHours: 'Mon–Fri 08:00–18:00 EAT · Sat 09:00–13:00 EAT',
  },

  branding: {
    accentColor: '#22d3ee',
    loginHeadline: 'Better Intelligence. Safer Decisions.',
    loginSubtext:
      'Access comprehensive identity and background verification data from trusted Kenyan registries via Spin Mobile.',
    emailSenderName: 'IPRS Kenya Platform',
    reportFooter: 'IPRS Identity Intelligence Limited · Delta Corner, Westlands, Nairobi · support@iprs.co.ke',
    reportDisclaimer:
      'This report is generated from third-party registry data and reflects the position at the time of enquiry only. It must not be used as the sole basis for an adverse decision without giving the subject an opportunity to respond (Data Protection Act 2019, s.35).',
    whiteLabel: false,
  },

  security: {
    passwordPolicy: {
      minLength: 10,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSymbol: true,
      expiryDays: 90,
      historyDepth: 5,
      breachCheck: true,
    },
    mfaRequiredFor: ['super_admin', 'admin'],
    sessionTimeoutMin: 480,
    idleTimeoutMin: 30,
    maxConcurrentSessions: 3,
    lockoutThreshold: 5,
    lockoutDurationMin: 15,
    ipAllowlist: [],
    ipDenylist: ['185.220.101.0/24'],
    geoFencingEnabled: true,
    allowedCountries: ['KE'],
    trustedDeviceMemoryDays: 30,
    captchaOnLogin: true,
  },

  compliance: {
    framework: 'Kenya Data Protection Act 2019 + ODPC Guidance Notes',
    dpoName: 'Wanjiru Githinji',
    dpoEmail: 'dpo@iprs.co.ke',
    dpoPhone: '+254 709 118 042',
    consentCapture: 'per-search',
    lawfulBasisRegister:
      'Identity verification for KYC/AML onboarding (s.30(1)(b) — contractual necessity) and fraud prevention (s.30(1)(f) — legitimate interest).',
    piiMasking: [
      { field: 'subject.idNumber', mask: 'partial' },
      { field: 'subject.phone', mask: 'partial' },
      { field: 'mobileMoney.msisdn', mask: 'partial' },
      { field: 'utility.meterNumber', mask: 'partial' },
      { field: 'tax.pin', mask: 'partial' },
      { field: 'subject.passportNumber', mask: 'full' },
      { field: 'subject.email', mask: 'partial' },
      { field: 'business.companyPin', mask: 'partial' },
    ],
    retention: [
      { recordType: 'Identity dossiers', months: 60 },
      { recordType: 'Search audit events', months: 84 },
      { recordType: 'Provider request logs', months: 24 },
      { recordType: 'Payment records', months: 84 },
      { recordType: 'Platform audit log', months: 120 },
      { recordType: 'Session records', months: 12 },
    ],
    erasureWorkflowEnabled: true,
    crossBorderTransfer: false,
    auditRetentionMonths: 120,
    purposeLimitationText:
      'Personal data retrieved through this platform may only be processed for the purpose recorded in the consent reference attached to each search. Secondary use for marketing is prohibited.',
  },

  risk: {
    providerWeights: [
      { providerId: 'p-kra', weight: 15 },
      { providerId: 'p-mpesa', weight: 10 },
      { providerId: 'p-crb', weight: 20 },
      { providerId: 'p-employer', weight: 10 },
      { providerId: 'p-kplc', weight: 8 },
      { providerId: 'p-brs', weight: 7 },
      { providerId: 'civil', weight: 20 },
      { providerId: 'court', weight: 10 },
    ],
    lowThreshold: 80,
    highThreshold: 50,
    autoFlagRules: [
      { id: 'r-pep', label: 'PEP or PEP-by-association hit', enabled: true, severity: 'danger' },
      { id: 'r-sanctions', label: 'Sanctions list match', enabled: true, severity: 'danger' },
      { id: 'r-crb-default', label: 'Active CRB default listing', enabled: true, severity: 'danger' },
      { id: 'r-deceased', label: 'Subject recorded as deceased', enabled: true, severity: 'danger' },
      { id: 'r-name-mismatch', label: 'Name mismatch across registries', enabled: true, severity: 'warning' },
      { id: 'r-address-mismatch', label: 'Declared address not corroborated', enabled: true, severity: 'warning' },
      { id: 'r-sim-swap', label: 'SIM swap within 30 days', enabled: true, severity: 'warning' },
      { id: 'r-low-photo', label: 'Photo match below 85%', enabled: true, severity: 'warning' },
      { id: 'r-dti', label: 'Debt-to-income above 45%', enabled: true, severity: 'warning' },
      { id: 'r-tax-debt', label: 'Outstanding KRA principal tax debt', enabled: true, severity: 'warning' },
      { id: 'r-young-id', label: 'ID issued within 90 days', enabled: false, severity: 'warning' },
    ],
    manualReviewQueue: true,
    minConfidenceToAutoApprove: 90,
    modelVersion: 'IPRS-RISK-v3.2 (2026-06-14)',
  },

  billing: {
    currency: 'KES',
    vatRatePct: 16,
    invoicePrefix: 'INV',
    nextInvoiceNo: 1924,
    mpesaShortcode: '400200',
    mpesaPasskey: 'MTg2YTQyZTRjNTk0MzVhMWVjYmE3ZmY2MTU1NDM4MGJkOGY0YzA5',
    mpesaPaybill: true,
    cardGateway: 'Pesapal / IntaSend (Visa & Mastercard)',
    cardPublicKey: 'pk_live_iprs_9f21ab90c7',
    walletMinTopUpKes: 500,
    walletMaxTopUpKes: 500000,
    autoTopUpEnabled: true,
    lowBalanceAlertKes: 2500,
    overdraftAllowed: false,
    blockSearchOnNegativeBalance: true,
    creditTermsDays: 7,
    discountPct: 0,
  },

  integrations: {
    webhooks: [
      {
        id: 'wh-1',
        label: 'Client onboarding callback',
        url: 'https://client.example.co.ke/hooks/iprs',
        secret: 'whsec_••••••7d21',
        events: ['report.ready', 'case.updated'],
        retries: 5,
        enabled: true,
      },
      {
        id: 'wh-2',
        label: 'Finance ledger sync',
        url: 'https://erp.internal.iprs.co.ke/api/ledger',
        secret: 'whsec_••••••3b88',
        events: ['payment.success', 'wallet.debit'],
        retries: 3,
        enabled: true,
      },
    ],
    smtpHost: 'smtp.sendgrid.net',
    smtpPort: 587,
    smtpUser: 'apikey',
    smtpFrom: 'IPRS Kenya Platform <no-reply@iprs.co.ke>',
    smsGateway: "Africa's Talking",
    smsApiKey: 'ats_••••••••••••c91f',
    smsSender: 'IPRS-KE',
    ssoEnabled: false,
    ssoProtocol: 'oidc',
    ssoMetadataUrl: '',
    objectStorageBucket: 's3://iprs-prod-artifacts/ke-nairobi-1',
    erpExportEnabled: true,
  },

  platform: {
    environment: 'production',
    apiRateLimitPerMin: [
      { tier: 'user', limit: 60 },
      { tier: 'admin', limit: 240 },
      { tier: 'super_admin', limit: 600 },
    ],
    globalConcurrency: 64,
    cacheTtlSec: 900,
    workers: 8,
    logLevel: 'info',
    telemetryConsent: true,
    featureFlags: [
      { id: 'ff-kyb', label: 'KYB entity verification', enabled: true, description: 'Exposes the Business Registry provider and KYB bundles.' },
      { id: 'ff-wallet', label: 'Prepaid wallet & M-PESA STK top-up', enabled: true, description: 'Enables wallet debits and self-service top-ups.' },
      { id: 'ff-risk-engine', label: 'Configurable risk engine', enabled: true, description: 'Allows weight and threshold tuning from System Settings.' },
      { id: 'ff-batch-api', label: 'Batch verification API', enabled: false, description: 'CSV batch upload for volumes up to the 0–500 band.' },
      { id: 'ff-webhooks', label: 'Outbound webhooks', enabled: true, description: 'Client callbacks on report and payment events.' },
      { id: 'ff-sso', label: 'SSO (SAML / OIDC)', enabled: false, description: 'Enterprise single sign-on for the analyst workspace.' },
      { id: 'ff-mobile-push', label: 'Mobile push notifications', enabled: false, description: 'PWA push channel for case and payment alerts.' },
    ],
    maintenanceMode: false,
    maintenanceMessage:
      'The platform is undergoing scheduled maintenance. Verification requests are queued and will be processed automatically.',
    maintenanceExemptTiers: ['admin', 'super_admin'],
  },

  backup: {
    snapshotSchedule: 'daily',
    lastSnapshotAt: '2026-09-23T03:00:00.000Z',
    retentionCount: 30,
    encryptionAtRest: true,
    offsiteReplication: true,
  },
};

export const SETTINGS_GROUPS: {
  key: keyof SystemSettings;
  label: string;
  description: string;
  /** Which permission unlocks editing of this group. */
  editPermission: 'settings.edit.operational' | 'settings.edit.security' | 'settings.edit.compliance' | 'settings.edit.platform';
}[] = [
  { key: 'org', label: 'General & Organisation', description: 'Legal entity, contacts, timezone, locale and currency.', editPermission: 'settings.edit.operational' },
  { key: 'branding', label: 'Branding & Reports', description: 'Accent colour, login copy, report footer and disclaimer.', editPermission: 'settings.edit.operational' },
  { key: 'security', label: 'Security & Access', description: 'Password policy, MFA enforcement, sessions, lockout and IP controls.', editPermission: 'settings.edit.security' },
  { key: 'compliance', label: 'Compliance & Data Protection', description: 'DPA 2019 posture, consent, PII masking and retention.', editPermission: 'settings.edit.compliance' },
  { key: 'risk', label: 'Risk Engine', description: 'Provider weights, band thresholds, auto-flag rules and review policy.', editPermission: 'settings.edit.security' },
  { key: 'billing', label: 'Billing & Wallet', description: 'VAT, invoicing, payment channels and wallet policy.', editPermission: 'settings.edit.operational' },
  { key: 'integrations', label: 'Integrations', description: 'Webhooks, SMTP, SMS gateway, SSO and object storage.', editPermission: 'settings.edit.operational' },
  { key: 'platform', label: 'Platform & Performance', description: 'Rate limits, concurrency, feature flags and maintenance mode.', editPermission: 'settings.edit.platform' },
  { key: 'backup', label: 'Backup & Recovery', description: 'Snapshot schedule, retention, encryption and replication.', editPermission: 'settings.edit.platform' },
];
