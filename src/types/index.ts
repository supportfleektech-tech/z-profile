/**
 * IPRS Kenya — core domain model.
 *
 * Everything the platform persists, renders or exchanges with a provider gateway is
 * described here. Types are intentionally explicit (no `any`) so the RBAC, wallet and
 * provider-configuration layers stay compile-time safe.
 */

/* ------------------------------------------------------------------ *
 * Legacy shapes kept for backwards compatibility with older screens
 * ------------------------------------------------------------------ */

export interface CaseItem {
  id: string;
  caseId: string;
  subject: string;
  type: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'In Progress' | 'Open' | 'Completed' | 'Closed';
  updated: string;
  /** Owning user id — `user` tier only ever sees their own. */
  ownerId?: string;
  assignedTo?: string;
  riskScore?: number;
  notes?: string;
  createdAt?: string;
}

export interface InvoiceItem {
  id: string;
  invoiceNo: string;
  date: string;
  amount: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  amountValue?: number;
  userId?: string;
  channel?: PaymentChannel;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  category: 'Security' | 'System' | 'Billing' | 'Reports' | 'Payments' | 'Providers';
  type: 'success' | 'warning' | 'danger' | 'info';
  read: boolean;
  /** Restrict delivery to specific tiers (undefined = everyone). */
  tiers?: RoleTier[];
  /** Restrict delivery to a single user (undefined = broadcast). */
  userId?: string;
}

/* ------------------------------------------------------------------ *
 * Identity & roles
 * ------------------------------------------------------------------ */

/** The three dashboard experiences. Mutually exclusive. */
export type RoleTier = 'user' | 'admin' | 'super_admin';

/** Sub-roles that scope what a `user`-tier account may do. */
export type UserSubRole = 'analyst' | 'officer' | 'viewer' | 'billing';

export type Permission =
  // search & investigations
  | 'search.run'
  | 'search.view.own'
  | 'search.view.all'
  | 'case.create'
  | 'case.update'
  | 'case.view.own'
  | 'case.view.all'
  | 'report.view'
  | 'report.export'
  // wallet & billing
  | 'wallet.view.own'
  | 'wallet.topup'
  | 'wallet.view.all'
  | 'payments.view.all'
  | 'payments.refund'
  | 'billing.view'
  | 'pricing.view'
  | 'pricing.edit'
  // providers
  | 'providers.view'
  | 'providers.configure'
  | 'providers.test'
  | 'provider.logs.view'
  | 'apikeys.manage'
  // people & access
  | 'users.view'
  | 'users.create'
  | 'users.create.admin'
  | 'users.edit'
  | 'users.delete'
  | 'roles.view'
  | 'roles.edit'
  | 'sessions.view.all'
  | 'sessions.revoke'
  | 'audit.view'
  | 'audit.export'
  // platform
  | 'settings.view'
  | 'settings.edit.operational'
  | 'settings.edit.security'
  | 'settings.edit.compliance'
  | 'settings.edit.platform'
  | 'maintenance.toggle'
  | 'analytics.view'
  | 'profile.manage';

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  /** Demo-only credential store. A real deployment hashes this server-side. */
  password: string;
  phone: string;
  department: string;
  jobTitle: string;
  tier: RoleTier;
  /** Meaningful only when tier === 'user'. */
  subRole: UserSubRole;
  status: 'Active' | 'Inactive' | 'Suspended';
  /** Seeded accounts cannot be edited, deactivated or deleted from any UI. */
  isSystem: boolean;
  mfaEnabled: boolean;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  failedLoginAttempts: number;
  lockedUntil?: string | null;
  /** Per-user overrides of the global permission set. */
  permissionOverrides?: Partial<Record<Permission, boolean>>;
  ipAllowlist?: string[];
  walletId?: string;
}

/** Legacy alias — `UserItem` was consumed by older screens. */
export type UserItem = SystemUser;

export interface RoleDefinition {
  tier: RoleTier;
  label: string;
  description: string;
  dashboard: string;
  permissions: Permission[];
  /** Seeded by the system; never creatable through the UI. */
  systemOnly?: boolean;
  /** Which tier is allowed to create accounts of this tier. */
  creatableBy?: RoleTier[];
}

export interface SubRoleDefinition {
  id: UserSubRole;
  label: string;
  description: string;
  permissions: Permission[];
}

export interface SessionRecord {
  id: string;
  userId: string;
  userName: string;
  tier: RoleTier;
  ip: string;
  device: string;
  browser: string;
  location: string;
  startedAt: string;
  lastSeenAt: string;
  current: boolean;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  actorTier: RoleTier;
  action: string;
  entity: string;
  entityId?: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  ip: string;
  detail?: string;
  meta?: Record<string, string | number | boolean>;
}

/* ------------------------------------------------------------------ *
 * Identity dossier (the full extracted record)
 * ------------------------------------------------------------------ */

export type VerificationState = 'verified' | 'partial' | 'not_found' | 'mismatch' | 'insufficient';

export interface ExtractedField {
  label: string;
  value: string | number | boolean | null;
  source?: string;
  retrievedAt?: string;
  /** 0–100 */
  confidence?: number;
  matchRule?: string;
  masked?: boolean;
}

export interface AddressRecord {
  id: string;
  type: 'Postal' | 'Physical' | 'Residential' | 'Business' | 'Utility-confirmed';
  line: string;
  city: string;
  county: string;
  postalCode?: string;
  since?: string;
  confirmedBy?: string;
  current: boolean;
}

export interface EmploymentRecord {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  verifiedBy: string;
  verificationState: VerificationState;
  monthlyBand?: string;
  contractType?: string;
}

export interface CreditFacility {
  id: string;
  institution: string;
  type: string;
  openedOn: string;
  limit: number;
  outstanding: number;
  status: 'Current' | 'Watch' | 'Default' | 'Closed';
  arrears: number;
}

export interface BusinessLink {
  id: string;
  companyName: string;
  registrationNo: string;
  role: string;
  shareholdingPct?: number;
  status: 'Active' | 'Dissolved' | 'Dormant';
  incorporatedOn?: string;
  verifiedBy: string;
}

export interface RelationshipLink {
  id: string;
  name: string;
  relation: string;
  linkType: 'Family' | 'Business' | 'Financial' | 'Address' | 'Phone' | 'Employment';
  strength: 'Strong' | 'Moderate' | 'Weak';
  evidence: string;
  pep: boolean;
  sanctioned: boolean;
}

export interface VerificationEvent {
  id: string;
  at: string;
  actor: string;
  actorTier: RoleTier;
  provider: string;
  endpoint: string;
  fieldsRequested: string[];
  responseCode: number;
  latencyMs: number;
  costKes: number;
  consentRef: string;
  outcome: VerificationState;
  ip: string;
}

export interface DocumentRecord {
  id: string;
  type: string;
  number: string;
  issuedBy: string;
  issuedOn: string;
  expiresOn?: string;
  status: 'Valid' | 'Expired' | 'Pending';
}

/** The complete extracted record behind an identity profile / full report. */
export interface Dossier {
  id: string;
  reportId: string;
  generatedAt: string;
  subject: {
    fullName: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    aliases: string[];
    gender: string;
    dob: string;
    dobRaw: string;
    nationality: string;
    idNumber: string;
    idType: string;
    passportNumber?: string;
    kraPin: string;
    phone: string;
    altPhones: string[];
    email: string;
    maritalStatus: string;
    nextOfKin: string;
    county: string;
    subCounty: string;
    constituency: string;
    ward: string;
    registrationSerial?: string;
    photoMatchScore: number;
    deceased: boolean;
  };
  addresses: AddressRecord[];
  documents: DocumentRecord[];
  employment: EmploymentRecord[];
  tax: {
    pin: string;
    status: string;
    registeredOn: string;
    obligationTypes: string[];
    complianceYears: { year: string; returnsFiled: boolean; paid: boolean; outstandingKes: number }[];
    outstandingKes: number;
    lastReturnFiled: string;
    goodStanding: boolean;
  };
  mobileMoney: {
    accountName: string;
    msisdn: string;
    activeSince: string;
    kycTier: string;
    dailyLimitKes: number;
    transactionLimitKes: number;
    activityBand: string;
    avgMonthlyTurnoverKes: number;
    status: string;
    simSwapEvents: number;
    lastActive: string;
  };
  credit: {
    bureau: string;
    score: number;
    scoreBand: string;
    listingStatus: string;
    totalFacilities: number;
    totalOutstandingKes: number;
    totalLimitKes: number;
    utilisationPct: number;
    oldestFacility: string;
    daysSinceLastEnquiry: number;
    enquiries12m: number;
    facilities: CreditFacility[];
    adverseListings: { id: string; institution: string; amountKes: number; listedOn: string; type: string }[];
  };
  utility: {
    provider: string;
    meterNumber: string;
    accountStatus: string;
    connectedSince: string;
    avgMonthlyBillKes: number;
    arrearsKes: number;
    paymentBehaviour: string;
    lastPayment: string;
  };
  business: {
    links: BusinessLink[];
    isDirector: boolean;
    isBeneficialOwner: boolean;
    soleProprietorships: number;
  };
  screening: {
    pep: boolean;
    pepDetail: string;
    sanctions: boolean;
    sanctionsDetail: string;
    adverseMedia: number;
    criminalRecords: { id: string; caseNo: string; court: string; charge: string; filedOn: string; outcome: string }[];
    civilLitigation: number;
    insolvency: boolean;
  };
  relationships: RelationshipLink[];
  risk: {
    score: number;
    band: 'Low' | 'Medium' | 'High';
    verdict: string;
    drivers: { factor: string; weight: number; contribution: number; direction: 'positive' | 'negative' }[];
    recommendation: string;
    reviewRequired: boolean;
  };
  sections: DossierSection[];
  events: VerificationEvent[];
  attestation: {
    preparedBy: string;
    preparedByTier: RoleTier;
    sources: string[];
    disclaimer: string;
    classification: string;
    retentionExpiry: string;
  };
}

export interface DossierSection {
  id: string;
  title: string;
  provider: string;
  state: VerificationState;
  confidence: number;
  retrievedAt: string;
  latencyMs: number;
  costKes: number;
  summary: string;
  fields: ExtractedField[];
  /** Raw (masked) gateway response for the full report. */
  rawResponse?: Record<string, string | number | boolean | null>;
  flags?: { level: 'info' | 'warning' | 'danger'; text: string }[];
}

/* ------------------------------------------------------------------ *
 * Providers / integrations
 * ------------------------------------------------------------------ */

export interface ProviderItem {
  id: string;
  name: string;
  code: string;
  category: string;
  status: 'Active' | 'Degraded' | 'Offline' | 'Disabled';
  lastSync: string;
  latencyMs: number;
  uptime: string;
  color: string;
}

export type ProviderAuthType = 'api_key' | 'bearer' | 'oauth2' | 'mtls' | 'basic' | 'none';

export interface ProviderFieldMapping {
  id: string;
  /** Canonical platform field, e.g. `subject.fullName`. */
  platformField: string;
  /** Path in the provider response, e.g. `data.citizen.first_name`. */
  providerField: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
  required: boolean;
  transform: 'none' | 'uppercase' | 'titlecase' | 'mask' | 'date-iso' | 'phone-e164' | 'to-kes';
  defaultValue?: string;
  notes?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  code: string;
  category: string;
  color: string;
  enabled: boolean;
  environment: 'sandbox' | 'live';
  /* connection */
  baseUrl: string;
  endpointPath: string;
  method: 'GET' | 'POST';
  authType: ProviderAuthType;
  consumerKey: string;
  consumerSecret: string;
  tokenUrl: string;
  certificateRef: string;
  ipAllowlist: string[];
  maintenanceWindow: string;
  /* behaviour */
  timeoutMs: number;
  retries: number;
  backoff: 'fixed' | 'linear' | 'exponential';
  rateLimitPerMin: number;
  concurrency: number;
  cacheTtlSec: number;
  circuitBreakerFailures: number;
  queuePriority: 'low' | 'normal' | 'high';
  /* commercial */
  costPerCallKes: number;
  costPerSuccessKes: number;
  includedMonthlyQuota: number;
  overageRateKes: number;
  billingMode: 'wallet' | 'invoice';
  slaTargetPct: number;
  /* contract */
  requestTemplate: string;
  responseSample: string;
  fieldMappings: ProviderFieldMapping[];
  webhookUrl: string;
  webhookSecret: string;
  webhookEvents: string[];
  webhookRetries: number;
  /* alerts */
  alertLatencyMs: number;
  alertErrorRatePct: number;
  alertContacts: string[];
  /* runtime */
  status: ProviderItem['status'];
  lastSync: string;
  latencyMs: number;
  uptime: string;
  lastTestAt?: string;
  lastTestResult?: 'pass' | 'fail';
  notes?: string;
}

export interface ProviderRequestLog {
  id: string;
  at: string;
  providerId: string;
  providerName: string;
  endpoint: string;
  actorId: string;
  actorName: string;
  subjectRef: string;
  status: 'success' | 'error' | 'timeout' | 'rejected';
  httpCode: number;
  latencyMs: number;
  costKes: number;
  fieldsRequested: number;
  ip: string;
  errorMessage?: string;
}

export interface ApiKeyRecord {
  id: string;
  label: string;
  prefix: string;
  secretMasked: string;
  scopes: string[];
  providerId?: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  status: 'active' | 'revoked';
  ownerId: string;
  environment: 'sandbox' | 'live';
}

/* ------------------------------------------------------------------ *
 * Wallet & payments
 * ------------------------------------------------------------------ */

export type PaymentChannel = 'mpesa' | 'card' | 'bank' | 'wallet' | 'system';
export type PaymentStatus = 'pending' | 'processing' | 'success' | 'failed' | 'refunded' | 'cancelled' | 'timeout';

export interface Wallet {
  id: string;
  userId: string;
  currency: 'KES';
  /** Spendable balance. */
  balance: number;
  /** Reserved for in-flight searches. */
  held: number;
  lifetimeTopUp: number;
  lifetimeSpend: number;
  autoTopUp: boolean;
  autoTopUpTriggerKes: number;
  autoTopUpAmountKes: number;
  lowBalanceAlertKes: number;
  overdraftAllowed: boolean;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  userId: string;
  userName: string;
  at: string;
  direction: 'credit' | 'debit';
  kind: 'topup' | 'search' | 'refund' | 'adjustment' | 'subscription' | 'reversal';
  amount: number;
  balanceAfter: number;
  channel: PaymentChannel;
  status: PaymentStatus;
  reference: string;
  description: string;
  gatewayRef?: string;
  meta?: Record<string, string | number>;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  channel: PaymentChannel;
  label: string;
  /** Masked display value, e.g. `**** 4242` or `0712 *** 678`. */
  display: string;
  isDefault: boolean;
  addedAt: string;
  brand?: 'Visa' | 'Mastercard' | 'Amex' | 'UnionPay' | 'Discover';
  expiry?: string;
  token: string;
  status: 'active' | 'expired' | 'revoked';
}

/** Models the Safaricom Daraja STK Push callback shape. */
export interface MpesaStkResult {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  MpesaReceiptNumber?: string;
  TransactionDate?: string;
  PhoneNumber: string;
  Amount: number;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  at: string;
  channel: PaymentChannel;
  method: string;
  amount: number;
  currency: 'KES';
  status: PaymentStatus;
  reference: string;
  gateway: string;
  gatewayRef?: string;
  feeKes: number;
  netKes: number;
  walletTransactionId?: string;
  rawResponse?: Record<string, string | number | boolean | null>;
  failureReason?: string;
  refundedAt?: string;
  refundedBy?: string;
  ip: string;
}

/* ------------------------------------------------------------------ *
 * Pricing (KYC / KYB Financial Proposal 2026 — 0–500 batch)
 * ------------------------------------------------------------------ */

export type PricedItemType = 'kyc' | 'kyb' | 'subscription' | 'setup';

export interface PricedItem {
  id: string;
  name: string;
  type: PricedItemType;
  description: string;
  source: string;
  unitPriceKes: number;
  includedInBatch: number;
  overageRateKes: number;
  turnaround: string;
  confidence: 'High' | 'Medium' | 'Standard';
  /**
   * The proposal groups its APIs under headings ("Identity Verification APIs",
   * "Utility & Compliance APIs", …). Carried per item so the Pricing screen can
   * reproduce the proposal's own structure instead of a flat list.
   */
  proposalGroup?: string;
  /**
   * Per-item provenance. The catalogue-level flag can only say "all or nothing",
   * but the received proposal extract confirms the KYC APIs and says nothing about
   * the KYB products — so each line states its own status and the banners report
   * an exact confirmed/total count rather than silently hiding unconfirmed rates.
   */
  confirmedFromProposal?: boolean;
  /**
   * The proposal quotes a "Back Up Rate" alongside the unit price for the Identity
   * Verification APIs: what is charged when the primary source cannot answer.
   */
  backupRateKes?: number;
  /** Per-page component for page-metered pricing (scanned statement analysis). */
  perPageKes?: number;
}

export interface PricingBundle {
  id: string;
  name: string;
  tagline: string;
  itemIds: string[];
  priceKes: number;
  highlighted?: boolean;
  badge?: string;
}

export interface PricingCatalog {
  /** Set true once the figures are lifted from the proposal PDF. */
  confirmedFromProposal: boolean;
  proposalRef: string;
  batchLabel: string;
  batchMin: number;
  batchMax: number;
  currency: 'KES';
  effectiveDate: string;
  validUntil: string;
  vatRatePct: number;
  setupFeeKes: number;
  monthlyAccessFeeKes: number;
  paymentTerms: string;
  paymentChannels: string[];
  items: PricedItem[];
  bundles: PricingBundle[];
  notes: string[];
  exclusions: string[];
}

/** Legacy plan shape consumed by older screens; derived from the catalogue. */
export interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  period: string;
  subtitle: string;
  features: string[];
  highlighted: boolean;
  ctaText: string;
  badge?: string;
  customPrice?: string;
}

/* ------------------------------------------------------------------ *
 * Usage & telemetry
 * ------------------------------------------------------------------ */

export interface UsageRecord {
  id: string;
  at: string;
  userId: string;
  userName: string;
  providerId: string;
  providerName: string;
  checkType: string;
  costKes: number;
  status: 'success' | 'failed';
  latencyMs: number;
  subjectRef: string;
}

export interface QuotaState {
  label: string;
  used: number;
  total: number;
  color: string;
}

/* ------------------------------------------------------------------ *
 * System settings
 * ------------------------------------------------------------------ */

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  expiryDays: number;
  historyDepth: number;
  breachCheck: boolean;
}

export interface SecuritySettings {
  passwordPolicy: PasswordPolicy;
  mfaRequiredFor: RoleTier[];
  sessionTimeoutMin: number;
  idleTimeoutMin: number;
  maxConcurrentSessions: number;
  lockoutThreshold: number;
  lockoutDurationMin: number;
  ipAllowlist: string[];
  ipDenylist: string[];
  geoFencingEnabled: boolean;
  allowedCountries: string[];
  trustedDeviceMemoryDays: number;
  captchaOnLogin: boolean;
}

export interface ComplianceSettings {
  framework: string;
  dpoName: string;
  dpoEmail: string;
  dpoPhone: string;
  consentCapture: 'explicit' | 'implicit' | 'per-search';
  lawfulBasisRegister: string;
  piiMasking: { field: string; mask: 'full' | 'partial' | 'none' }[];
  retention: { recordType: string; months: number }[];
  erasureWorkflowEnabled: boolean;
  crossBorderTransfer: boolean;
  auditRetentionMonths: number;
  purposeLimitationText: string;
}

export interface RiskEngineSettings {
  providerWeights: { providerId: string; weight: number }[];
  lowThreshold: number;
  highThreshold: number;
  autoFlagRules: { id: string; label: string; enabled: boolean; severity: 'warning' | 'danger' }[];
  manualReviewQueue: boolean;
  minConfidenceToAutoApprove: number;
  modelVersion: string;
}

export interface BillingSettings {
  currency: 'KES';
  vatRatePct: number;
  invoicePrefix: string;
  nextInvoiceNo: number;
  mpesaShortcode: string;
  mpesaPasskey: string;
  mpesaPaybill: boolean;
  cardGateway: string;
  cardPublicKey: string;
  walletMinTopUpKes: number;
  walletMaxTopUpKes: number;
  autoTopUpEnabled: boolean;
  lowBalanceAlertKes: number;
  overdraftAllowed: boolean;
  blockSearchOnNegativeBalance: boolean;
  creditTermsDays: number;
  discountPct: number;
}

export interface IntegrationSettings {
  webhooks: { id: string; label: string; url: string; secret: string; events: string[]; retries: number; enabled: boolean }[];
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpFrom: string;
  smsGateway: string;
  smsApiKey: string;
  smsSender: string;
  ssoEnabled: boolean;
  ssoProtocol: 'saml' | 'oidc';
  ssoMetadataUrl: string;
  objectStorageBucket: string;
  erpExportEnabled: boolean;
}

export interface PlatformSettings {
  environment: 'sandbox' | 'production';
  apiRateLimitPerMin: { tier: RoleTier; limit: number }[];
  globalConcurrency: number;
  cacheTtlSec: number;
  workers: number;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  telemetryConsent: boolean;
  featureFlags: { id: string; label: string; enabled: boolean; description: string }[];
  maintenanceMode: boolean;
  maintenanceMessage: string;
  maintenanceExemptTiers: RoleTier[];
}

export interface OrgSettings {
  legalName: string;
  tradingName: string;
  kraPin: string;
  registrationNo: string;
  address: string;
  city: string;
  country: string;
  supportEmail: string;
  supportPhone: string;
  website: string;
  timezone: string;
  locale: string;
  currency: 'KES';
  fiscalYearStart: string;
  businessHours: string;
}

export interface BrandingSettings {
  accentColor: string;
  loginHeadline: string;
  loginSubtext: string;
  emailSenderName: string;
  reportFooter: string;
  reportDisclaimer: string;
  whiteLabel: boolean;
}

export interface BackupSettings {
  snapshotSchedule: 'hourly' | 'daily' | 'weekly';
  lastSnapshotAt: string;
  retentionCount: number;
  encryptionAtRest: boolean;
  offsiteReplication: boolean;
}

export interface SystemSettings {
  org: OrgSettings;
  branding: BrandingSettings;
  security: SecuritySettings;
  compliance: ComplianceSettings;
  risk: RiskEngineSettings;
  billing: BillingSettings;
  integrations: IntegrationSettings;
  platform: PlatformSettings;
  backup: BackupSettings;
}

export type SettingsGroup = keyof SystemSettings;

/* ------------------------------------------------------------------ *
 * Notification preferences
 * ------------------------------------------------------------------ */

export type NotificationChannel = 'inApp' | 'email' | 'sms' | 'webhook';

export type NotificationEvent =
  | 'case.assigned'
  | 'case.updated'
  | 'report.ready'
  | 'payment.success'
  | 'payment.failed'
  | 'wallet.low'
  | 'quota.warning'
  | 'provider.outage'
  | 'security.alert'
  | 'login.newDevice'
  | 'digest.weekly';

export interface NotificationPreferences {
  matrix: Record<NotificationEvent, Record<NotificationChannel, boolean>>;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  digestFrequency: 'daily' | 'weekly' | 'monthly' | 'off';
  smsNumber: string;
  smsVerified: boolean;
  webhookUrl: string;
  webhookSecret: string;
}

/* ------------------------------------------------------------------ *
 * Appearance
 * ------------------------------------------------------------------ */

export interface AppearanceSettings {
  accent: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose';
  density: 'compact' | 'comfortable';
  fontScale: number;
  sidebarCollapsed: boolean;
  reduceMotion: boolean;
  monoNumerals: boolean;
}

/* ------------------------------------------------------------------ *
 * Search results
 * ------------------------------------------------------------------ */

export interface SearchResult {
  query: string;
  profile: IdentityProfile;
  timestamp: string;
  riskScore: number;
  dossierId?: string;
  costKes?: number;
  actorId?: string;
}

/* ------------------------------------------------------------------ *
 * Legacy identity profile (still rendered by the profile header)
 * ------------------------------------------------------------------ */

export interface IdentityProfile {
  id: string;
  fullName: string;
  idNumber: string;
  phone: string;
  dob: string;
  gender: string;
  nationality: string;
  county: string;
  kraPin: string;
  avatarUrl?: string;
  isVerified: boolean;
  riskScore: number;
  trustLevel: 'Low' | 'Medium' | 'High';
  providers: {
    kra: { verified: boolean; status: string; pin: string; taxCompliance: boolean };
    mpesa: { verified: boolean; status: string; accountName: string; activeSince: string };
    crb: { verified: boolean; status: string; score: number; defaultStatus: string };
    employer: { verified: boolean; status: string; company: string; position: string };
    kplc: { verified: boolean; status: string; meterNumber: string; activeAccount: boolean };
  };
  keyFindings: string[];
}

export interface ActivityItem {
  id: string;
  title: string;
  time: string;
  status: string;
  type: string;
  userId?: string;
}
