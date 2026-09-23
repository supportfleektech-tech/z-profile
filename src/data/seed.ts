import type {
  ActivityItem,
  AuditEntry,
  CaseItem,
  InvoiceItem,
  NotificationItem,
  PaymentMethod,
  PaymentRecord,
  SessionRecord,
  UsageRecord,
  Wallet,
  WalletTransaction,
} from '../types';

/* ---------------------------------- cases ---------------------------------- */

export const casesData: CaseItem[] = [
  { id: 'c1', caseId: 'IPRS-00432', subject: 'John Mwangi Kamau', type: 'Full Background', priority: 'High', status: 'In Progress', updated: '2h ago', ownerId: 'u-analyst', assignedTo: 'Sarah Wanjiku', riskScore: 92, createdAt: '2026-09-23T07:10:00.000Z' },
  { id: 'c2', caseId: 'IPRS-00431', subject: 'Grace Wanjiku Njoroge', type: 'Identity Verification', priority: 'Medium', status: 'Open', updated: '5h ago', ownerId: 'u-analyst', assignedTo: 'Sarah Wanjiku', riskScore: 74, createdAt: '2026-09-23T04:22:00.000Z' },
  { id: 'c3', caseId: 'IPRS-00430', subject: 'Peter Kimani Maina', type: 'M-PESA KYC', priority: 'Medium', status: 'Completed', updated: '1d ago', ownerId: 'u-officer', assignedTo: 'Mike Ochieng', riskScore: 41, createdAt: '2026-09-22T09:41:00.000Z' },
  { id: 'c4', caseId: 'IPRS-00429', subject: 'Amina Hassan Ali', type: 'CRB Check', priority: 'High', status: 'In Progress', updated: '1d ago', ownerId: 'u-officer', assignedTo: 'Mike Ochieng', riskScore: 88, createdAt: '2026-09-22T08:05:00.000Z' },
  { id: 'c5', caseId: 'IPRS-00428', subject: 'Daniel Otieno Omondi', type: 'Employer Verification', priority: 'Low', status: 'Closed', updated: '2d ago', ownerId: 'u-analyst', assignedTo: 'Sarah Wanjiku', riskScore: 67, createdAt: '2026-09-21T11:30:00.000Z' },
  { id: 'c6', caseId: 'IPRS-00427', subject: 'Kamtech Solutions Ltd', type: 'KYB Entity Review', priority: 'High', status: 'In Progress', updated: '2d ago', ownerId: 'u-admin', assignedTo: 'David Mbugua', riskScore: 71, createdAt: '2026-09-21T09:12:00.000Z' },
];

/* --------------------------------- wallets --------------------------------- */

export const seedWallets: Wallet[] = [
  { id: 'w-analyst', userId: 'u-analyst', currency: 'KES', balance: 18420, held: 450, lifetimeTopUp: 120000, lifetimeSpend: 101580, autoTopUp: true, autoTopUpTriggerKes: 5000, autoTopUpAmountKes: 20000, lowBalanceAlertKes: 2500, overdraftAllowed: false, updatedAt: '2026-09-23T09:42:18.000Z' },
  { id: 'w-officer', userId: 'u-officer', currency: 'KES', balance: 4210, held: 0, lifetimeTopUp: 45000, lifetimeSpend: 40790, autoTopUp: false, autoTopUpTriggerKes: 2500, autoTopUpAmountKes: 10000, lowBalanceAlertKes: 2500, overdraftAllowed: false, updatedAt: '2026-09-23T08:15:00.000Z' },
  { id: 'w-viewer', userId: 'u-viewer', currency: 'KES', balance: 950, held: 0, lifetimeTopUp: 12000, lifetimeSpend: 11050, autoTopUp: false, autoTopUpTriggerKes: 1000, autoTopUpAmountKes: 5000, lowBalanceAlertKes: 2500, overdraftAllowed: false, updatedAt: '2026-09-21T13:22:00.000Z' },
  { id: 'w-billing', userId: 'u-billing', currency: 'KES', balance: 62400, held: 1085, lifetimeTopUp: 310000, lifetimeSpend: 247600, autoTopUp: true, autoTopUpTriggerKes: 15000, autoTopUpAmountKes: 50000, lowBalanceAlertKes: 10000, overdraftAllowed: false, updatedAt: '2026-09-23T05:58:00.000Z' },
  { id: 'w-admin', userId: 'u-admin', currency: 'KES', balance: 148900, held: 0, lifetimeTopUp: 900000, lifetimeSpend: 751100, autoTopUp: true, autoTopUpTriggerKes: 25000, autoTopUpAmountKes: 100000, lowBalanceAlertKes: 15000, overdraftAllowed: false, updatedAt: '2026-09-23T07:44:00.000Z' },
  { id: 'w-super', userId: 'u-super', currency: 'KES', balance: 250000, held: 0, lifetimeTopUp: 1500000, lifetimeSpend: 1250000, autoTopUp: false, autoTopUpTriggerKes: 50000, autoTopUpAmountKes: 250000, lowBalanceAlertKes: 25000, overdraftAllowed: true, updatedAt: '2026-09-23T06:12:00.000Z' },
];

/* ---------------------------- wallet transactions ---------------------------- */

export const seedWalletTransactions: WalletTransaction[] = [
  { id: 'wt-1', walletId: 'w-analyst', userId: 'u-analyst', userName: 'Sarah Wanjiku', at: '2026-09-23T09:42:18.000Z', direction: 'debit', kind: 'search', amount: 1150, balanceAfter: 18420, channel: 'wallet', status: 'success', reference: 'SRCH-2026-09412', description: 'Full background — John Mwangi Kamau (9 checks)' },
  { id: 'wt-2', walletId: 'w-analyst', userId: 'u-analyst', userName: 'Sarah Wanjiku', at: '2026-09-23T07:02:44.000Z', direction: 'credit', kind: 'topup', amount: 20000, balanceAfter: 19570, channel: 'mpesa', status: 'success', reference: 'MPESA-QGH7X2K9LP', description: 'M-PESA STK Push top-up — 0712 *** 678', gatewayRef: 'QGH7X2K9LP' },
  { id: 'wt-3', walletId: 'w-analyst', userId: 'u-analyst', userName: 'Sarah Wanjiku', at: '2026-09-22T16:20:11.000Z', direction: 'debit', kind: 'search', amount: 450, balanceAfter: 0, channel: 'wallet', status: 'success', reference: 'SRCH-2026-09388', description: 'CRB individual report — Grace Wanjiku Njoroge' },
  { id: 'wt-4', walletId: 'w-admin', userId: 'u-admin', userName: 'David Mbugua', at: '2026-09-22T11:04:52.000Z', direction: 'credit', kind: 'topup', amount: 100000, balanceAfter: 148900, channel: 'card', status: 'success', reference: 'CARD-PI-8842190', description: 'Card top-up — Visa **** 4242 (3-D Secure passed)', gatewayRef: 'PI-8842190' },
  { id: 'wt-5', walletId: 'w-officer', userId: 'u-officer', userName: 'Mike Ochieng', at: '2026-09-23T08:15:03.000Z', direction: 'debit', kind: 'search', amount: 210, balanceAfter: 4210, channel: 'wallet', status: 'success', reference: 'SRCH-2026-09401', description: 'KYC Standard bundle — Amina Hassan Ali' },
  { id: 'wt-6', walletId: 'w-officer', userId: 'u-officer', userName: 'Mike Ochieng', at: '2026-09-23T08:12:44.000Z', direction: 'credit', kind: 'topup', amount: 5000, balanceAfter: 4420, channel: 'mpesa', status: 'failed', reference: 'MPESA-PENDING-7741', description: 'M-PESA STK Push — customer cancelled the prompt', gatewayRef: 'ResultCode 1032' },
  { id: 'wt-7', walletId: 'w-billing', userId: 'u-billing', userName: 'Achieng Otieno', at: '2026-09-21T14:31:09.000Z', direction: 'credit', kind: 'topup', amount: 50000, balanceAfter: 62400, channel: 'bank', status: 'success', reference: 'EFT-KCB-55219', description: 'Bank transfer (EFT) — KCB **** 4421' },
  { id: 'wt-8', walletId: 'w-billing', userId: 'u-billing', userName: 'Achieng Otieno', at: '2026-09-20T09:00:00.000Z', direction: 'debit', kind: 'subscription', amount: 15000, balanceAfter: 12400, channel: 'wallet', status: 'success', reference: 'INV-01923', description: 'Monthly platform access fee — Professional (batch 0–500)' },
  { id: 'wt-9', walletId: 'w-viewer', userId: 'u-viewer', userName: 'Grace Njeri', at: '2026-09-19T10:44:31.000Z', direction: 'credit', kind: 'refund', amount: 450, balanceAfter: 950, channel: 'system', status: 'success', reference: 'RFD-2026-0044', description: 'Refund — CRB gateway timeout, charge reversed' },
  { id: 'wt-10', walletId: 'w-analyst', userId: 'u-analyst', userName: 'Sarah Wanjiku', at: '2026-09-18T15:22:08.000Z', direction: 'debit', kind: 'search', amount: 1085, balanceAfter: 500, channel: 'wallet', status: 'success', reference: 'SRCH-2026-09204', description: 'KYC Comprehensive bundle — Peter Kimani Maina' },
];

/* ---------------------------- payment methods ---------------------------- */

export const seedPaymentMethods: PaymentMethod[] = [
  { id: 'pm-1', userId: 'u-analyst', channel: 'mpesa', label: 'M-PESA — Safaricom', display: '0712 *** 678', isDefault: true, addedAt: '2026-01-12T09:00:00.000Z', token: 'mpesa_254712345678', status: 'active' },
  { id: 'pm-2', userId: 'u-analyst', channel: 'card', label: 'Visa debit', display: '**** **** **** 4242', isDefault: false, addedAt: '2026-04-02T11:20:00.000Z', brand: 'Visa', expiry: '09/29', token: 'tok_visa_4242', status: 'active' },
  { id: 'pm-3', userId: 'u-admin', channel: 'card', label: 'Mastercard corporate', display: '**** **** **** 8871', isDefault: true, addedAt: '2025-11-04T08:00:00.000Z', brand: 'Mastercard', expiry: '03/28', token: 'tok_mc_8871', status: 'active' },
  { id: 'pm-4', userId: 'u-billing', channel: 'bank', label: 'KCB business account', display: 'KCB **** 4421', isDefault: true, addedAt: '2026-02-18T10:00:00.000Z', token: 'bank_kcb_4421', status: 'active' },
  { id: 'pm-5', userId: 'u-officer', channel: 'mpesa', label: 'M-PESA — Safaricom', display: '0733 *** 118', isDefault: true, addedAt: '2026-03-22T09:30:00.000Z', token: 'mpesa_254733000118', status: 'active' },
];

/* ------------------------------ payment records ------------------------------ */

export const seedPayments: PaymentRecord[] = [
  { id: 'pay-1', userId: 'u-analyst', userName: 'Sarah Wanjiku', userEmail: 'analyst@iprs.co.ke', at: '2026-09-23T07:02:44.000Z', channel: 'mpesa', method: 'STK Push — 0712 *** 678', amount: 20000, currency: 'KES', status: 'success', reference: 'MPESA-QGH7X2K9LP', gateway: 'Safaricom Daraja', gatewayRef: 'QGH7X2K9LP', feeKes: 0, netKes: 20000, walletTransactionId: 'wt-2', rawResponse: { MerchantRequestID: '29115-34620561-2', CheckoutRequestID: 'ws_CO_23092026070244', ResultCode: 0, ResultDesc: 'The service request is processed successfully.', MpesaReceiptNumber: 'QGH7X2K9LP', TransactionDate: '20260923070244', PhoneNumber: '254712345678', Amount: 20000 }, ip: '41.90.112.34' },
  { id: 'pay-2', userId: 'u-admin', userName: 'David Mbugua', userEmail: 'admin@iprs.co.ke', at: '2026-09-22T11:04:52.000Z', channel: 'card', method: 'Visa **** 4242', amount: 100000, currency: 'KES', status: 'success', reference: 'CARD-PI-8842190', gateway: 'Pesapal', gatewayRef: 'PI-8842190', feeKes: 2900, netKes: 97100, walletTransactionId: 'wt-4', rawResponse: { id: 'PI-8842190', status: 'succeeded', amount: 100000, currency: 'KES', three_d_secure: 'authenticated', brand: 'visa', last4: '4242', risk_score: 12 }, ip: '41.90.112.22' },
  { id: 'pay-3', userId: 'u-officer', userName: 'Mike Ochieng', userEmail: 'officer@iprs.co.ke', at: '2026-09-23T08:12:44.000Z', channel: 'mpesa', method: 'STK Push — 0733 *** 118', amount: 5000, currency: 'KES', status: 'cancelled', reference: 'MPESA-PENDING-7741', gateway: 'Safaricom Daraja', feeKes: 0, netKes: 0, rawResponse: { MerchantRequestID: '29115-34620884-7', CheckoutRequestID: 'ws_CO_23092026081244', ResultCode: 1032, ResultDesc: 'Request cancelled by user', PhoneNumber: '254733000118', Amount: 5000 }, failureReason: 'Customer cancelled the STK prompt on the handset', ip: '197.232.44.18' },
  { id: 'pay-4', userId: 'u-billing', userName: 'Achieng Otieno', userEmail: 'billing@iprs.co.ke', at: '2026-09-21T14:31:09.000Z', channel: 'bank', method: 'EFT — KCB **** 4421', amount: 50000, currency: 'KES', status: 'success', reference: 'EFT-KCB-55219', gateway: 'KCB Corporate EFT', gatewayRef: '55219', feeKes: 0, netKes: 50000, walletTransactionId: 'wt-7', ip: '41.90.112.77' },
  { id: 'pay-5', userId: 'u-viewer', userName: 'Grace Njeri', userEmail: 'viewer@iprs.co.ke', at: '2026-09-20T17:44:02.000Z', channel: 'mpesa', method: 'STK Push — 0720 *** 441', amount: 2000, currency: 'KES', status: 'failed', reference: 'MPESA-TIMEOUT-2210', gateway: 'Safaricom Daraja', feeKes: 0, netKes: 0, rawResponse: { MerchantRequestID: '29115-34619002-1', CheckoutRequestID: 'ws_CO_20092026174402', ResultCode: 1037, ResultDesc: 'DS timeout user cannot be reached', PhoneNumber: '254720000441', Amount: 2000 }, failureReason: 'Handset unreachable — STK prompt timed out', ip: '197.232.44.61' },
  { id: 'pay-6', userId: 'u-analyst', userName: 'Sarah Wanjiku', userEmail: 'analyst@iprs.co.ke', at: '2026-09-19T09:12:33.000Z', channel: 'card', method: 'Visa **** 4242', amount: 10000, currency: 'KES', status: 'refunded', reference: 'CARD-PI-8831004', gateway: 'Pesapal', gatewayRef: 'PI-8831004', feeKes: 290, netKes: 9710, rawResponse: { id: 'PI-8831004', status: 'refunded', amount: 10000, currency: 'KES', three_d_secure: 'authenticated', brand: 'visa', last4: '4242' }, refundedAt: '2026-09-19T10:44:31.000Z', refundedBy: 'David Mbugua', ip: '41.90.112.34' },
  { id: 'pay-7', userId: 'u-billing', userName: 'Achieng Otieno', userEmail: 'billing@iprs.co.ke', at: '2026-09-15T08:00:00.000Z', channel: 'wallet', method: 'Wallet debit — subscription', amount: 15000, currency: 'KES', status: 'success', reference: 'INV-01923', gateway: 'IPRS Wallet', feeKes: 0, netKes: 15000, walletTransactionId: 'wt-8', ip: '41.90.112.77' },
  { id: 'pay-8', userId: 'u-admin', userName: 'David Mbugua', userEmail: 'admin@iprs.co.ke', at: '2026-09-12T13:22:10.000Z', channel: 'mpesa', method: 'STK Push — 0722 *** 908', amount: 75000, currency: 'KES', status: 'success', reference: 'MPESA-QFG22MK8TR', gateway: 'Safaricom Daraja', gatewayRef: 'QFG22MK8TR', feeKes: 0, netKes: 75000, rawResponse: { ResultCode: 0, ResultDesc: 'The service request is processed successfully.', MpesaReceiptNumber: 'QFG22MK8TR', Amount: 75000 }, ip: '41.90.112.22' },
];

/* -------------------------------- invoices -------------------------------- */

export const invoicesData: InvoiceItem[] = [
  { id: 'inv1', invoiceNo: 'INV-01923', date: '15 Sep 2026', amount: 'KES 17,400', amountValue: 17400, status: 'Paid', userId: 'u-billing', channel: 'wallet' },
  { id: 'inv2', invoiceNo: 'INV-01922', date: '15 Aug 2026', amount: 'KES 17,400', amountValue: 17400, status: 'Paid', userId: 'u-billing', channel: 'wallet' },
  { id: 'inv3', invoiceNo: 'INV-01921', date: '15 Jul 2026', amount: 'KES 17,400', amountValue: 17400, status: 'Paid', userId: 'u-admin', channel: 'card' },
  { id: 'inv4', invoiceNo: 'INV-01924', date: '15 Oct 2026', amount: 'KES 17,400', amountValue: 17400, status: 'Pending', userId: 'u-billing', channel: 'wallet' },
];

/* ----------------------------- notifications ----------------------------- */

export const notificationsData: NotificationItem[] = [
  { id: 'n1', title: 'High-risk subject flagged', description: 'Peter Kimani Maina (ID 31204921) scored 41/100 — an active CRB default listing was found. Manual review required.', time: '12m ago', category: 'Security', type: 'danger', read: false },
  { id: 'n2', title: 'M-PESA top-up successful', description: 'KES 20,000 credited to your wallet. Receipt QGH7X2K9LP.', time: '2h ago', category: 'Payments', type: 'success', read: false },
  { id: 'n3', title: 'KPLC gateway degraded', description: 'Error rate 6.2% over the last 15 minutes — above the 6% alert threshold. Circuit breaker armed.', time: '3h ago', category: 'Providers', type: 'warning', read: false, tiers: ['admin', 'super_admin'] },
  { id: 'n4', title: 'Wallet balance low', description: 'Grace Njeri\u2019s wallet is at KES 950 — below the KES 2,500 alert threshold.', time: '5h ago', category: 'Billing', type: 'warning', read: false, tiers: ['admin', 'super_admin'] },
  { id: 'n5', title: 'Report ready', description: 'Full identity report for John Mwangi Kamau is ready to download (IPRS-R-2026-23456789).', time: '6h ago', category: 'Reports', type: 'info', read: true },
  { id: 'n6', title: 'New case assigned', description: 'Case IPRS-00432 (Full Background — John Mwangi Kamau) has been assigned to you.', time: '8h ago', category: 'System', type: 'success', read: true },
  { id: 'n7', title: 'Scheduled maintenance', description: 'KRA gateway maintenance window: Sunday 02:00–04:00 EAT. Requests will be queued.', time: '1d ago', category: 'System', type: 'info', read: true },
  { id: 'n8', title: 'Login from a new device', description: 'A sign-in to your account was detected from 197.232.44.18 (Nairobi, Chrome on Windows).', time: '1d ago', category: 'Security', type: 'warning', read: true },
];

/* -------------------------------- sessions -------------------------------- */

export const seedSessions: SessionRecord[] = [
  { id: 's-1', userId: 'u-analyst', userName: 'Sarah Wanjiku', tier: 'user', ip: '41.90.112.34', device: 'MacBook Pro 14"', browser: 'Chrome 141', location: 'Nairobi, KE', startedAt: '2026-09-23T08:05:19.000Z', lastSeenAt: '2026-09-23T09:44:02.000Z', current: true },
  { id: 's-2', userId: 'u-admin', userName: 'David Mbugua', tier: 'admin', ip: '41.90.112.22', device: 'Dell Latitude 7440', browser: 'Edge 140', location: 'Nairobi, KE', startedAt: '2026-09-23T07:44:02.000Z', lastSeenAt: '2026-09-23T09:31:44.000Z', current: false },
  { id: 's-3', userId: 'u-super', userName: 'John Kamau', tier: 'super_admin', ip: '41.90.112.10', device: 'ThinkPad X1 Carbon', browser: 'Firefox 143', location: 'Nairobi, KE', startedAt: '2026-09-23T06:12:44.000Z', lastSeenAt: '2026-09-23T09:02:11.000Z', current: false },
  { id: 's-4', userId: 'u-officer', userName: 'Mike Ochieng', tier: 'user', ip: '197.232.44.18', device: 'iPhone 15', browser: 'Safari Mobile', location: 'Kisumu, KE', startedAt: '2026-09-22T16:38:51.000Z', lastSeenAt: '2026-09-23T08:15:03.000Z', current: false },
  { id: 's-5', userId: 'u-billing', userName: 'Achieng Otieno', tier: 'user', ip: '41.90.112.77', device: 'HP EliteBook 840', browser: 'Chrome 141', location: 'Nairobi, KE', startedAt: '2026-09-23T05:58:33.000Z', lastSeenAt: '2026-09-23T07:49:03.000Z', current: false },
];

/* -------------------------------- audit log -------------------------------- */

export const seedAudit: AuditEntry[] = [
  { id: 'au-1', at: '2026-09-23T09:42:18.000Z', actorId: 'u-analyst', actorName: 'Sarah Wanjiku', actorTier: 'user', action: 'report.generated', entity: 'Dossier', entityId: 'DOS-2026-00921', severity: 'info', ip: '41.90.112.34', detail: 'Full background report generated for ID 23456789 — 12 sections, KES 1,150 debited' },
  { id: 'au-2', at: '2026-09-23T09:41:52.000Z', actorId: 'u-analyst', actorName: 'Sarah Wanjiku', actorTier: 'user', action: 'search.executed', entity: 'Search', entityId: 'SRCH-2026-09412', severity: 'info', ip: '41.90.112.34', detail: 'Consent reference CNS-2026-88431 captured; 9 providers invoked' },
  { id: 'au-3', at: '2026-09-23T09:22:10.000Z', actorId: 'u-admin', actorName: 'David Mbugua', actorTier: 'admin', action: 'provider.request.failed', entity: 'ProviderConfig', entityId: 'p-brs', severity: 'warning', ip: '41.90.112.22', detail: 'BRS sandbox returned HTTP 502 — upstream eCitizen unavailable' },
  { id: 'au-4', at: '2026-09-23T08:12:44.000Z', actorId: 'u-officer', actorName: 'Mike Ochieng', actorTier: 'user', action: 'payment.failed', entity: 'Payment', entityId: 'MPESA-PENDING-7741', severity: 'warning', ip: '197.232.44.18', detail: 'M-PESA STK push cancelled by the customer (ResultCode 1032)' },
  { id: 'au-5', at: '2026-09-23T07:02:44.000Z', actorId: 'u-analyst', actorName: 'Sarah Wanjiku', actorTier: 'user', action: 'wallet.topup.success', entity: 'Wallet', entityId: 'w-analyst', severity: 'success', ip: '41.90.112.34', detail: 'KES 20,000 credited via M-PESA receipt QGH7X2K9LP' },
  { id: 'au-6', at: '2026-09-23T06:32:40.000Z', actorId: 'u-admin', actorName: 'David Mbugua', actorTier: 'admin', action: 'provider.tested', entity: 'ProviderConfig', entityId: 'p-crb', severity: 'success', ip: '41.90.112.22', detail: 'Connection test passed in 1,842ms — HTTP 200, schema validated' },
  { id: 'au-7', at: '2026-09-23T06:12:44.000Z', actorId: 'u-super', actorName: 'John Kamau', actorTier: 'super_admin', action: 'auth.login', entity: 'Session', entityId: 's-3', severity: 'success', ip: '41.90.112.10', detail: 'Super Admin signed in with MFA (TOTP) from a trusted device' },
  { id: 'au-8', at: '2026-09-22T18:04:11.000Z', actorId: 'u-admin', actorName: 'David Mbugua', actorTier: 'admin', action: 'provider.config.updated', entity: 'ProviderConfig', entityId: 'p-employer', severity: 'info', ip: '41.90.112.22', detail: 'Timeout raised 10000ms → 15000ms; retries 1 → 2 (backoff exponential)' },
  { id: 'au-9', at: '2026-09-22T14:20:00.000Z', actorId: 'u-super', actorName: 'John Kamau', actorTier: 'super_admin', action: 'settings.security.updated', entity: 'SystemSettings', entityId: 'security', severity: 'critical', ip: '41.90.112.10', detail: 'MFA enforcement extended to the admin tier; session timeout 720 → 480 minutes' },
  { id: 'au-10', at: '2026-09-22T11:04:52.000Z', actorId: 'u-admin', actorName: 'David Mbugua', actorTier: 'admin', action: 'wallet.topup.success', entity: 'Wallet', entityId: 'w-admin', severity: 'success', ip: '41.90.112.22', detail: 'KES 100,000 credited via Visa **** 4242 — 3-D Secure authenticated' },
  { id: 'au-11', at: '2026-09-21T15:02:33.000Z', actorId: 'u-super', actorName: 'John Kamau', actorTier: 'super_admin', action: 'user.created', entity: 'SystemUser', entityId: 'u-billing', severity: 'critical', ip: '41.90.112.10', detail: 'Created Achieng Otieno as User · Billing (finance seat)' },
  { id: 'au-12', at: '2026-09-20T10:44:31.000Z', actorId: 'u-admin', actorName: 'David Mbugua', actorTier: 'admin', action: 'payment.refunded', entity: 'Payment', entityId: 'CARD-PI-8831004', severity: 'warning', ip: '41.90.112.22', detail: 'KES 10,000 refunded to Grace Njeri — CRB gateway timeout reversal' },
  { id: 'au-13', at: '2026-09-19T09:00:00.000Z', actorId: 'system', actorName: 'System', actorTier: 'super_admin', action: 'backup.completed', entity: 'Platform', severity: 'success', ip: '127.0.0.1', detail: 'Daily snapshot written to s3://iprs-prod-artifacts — 412 MB, encrypted at rest' },
  { id: 'au-14', at: '2026-09-18T16:11:02.000Z', actorId: 'u-admin', actorName: 'David Mbugua', actorTier: 'admin', action: 'apikey.created', entity: 'ApiKey', entityId: 'ak-2', severity: 'critical', ip: '41.90.112.22', detail: 'Sandbox API key issued (scopes: verify:read)' },
  { id: 'au-15', at: '2026-09-17T08:30:00.000Z', actorId: 'u-super', actorName: 'John Kamau', actorTier: 'super_admin', action: 'roles.updated', entity: 'RoleDefinition', entityId: 'admin', severity: 'critical', ip: '41.90.112.10', detail: 'Removed pricing.edit from the Admin role — pricing is now Super Admin only' },
];

/* --------------------------------- usage --------------------------------- */

export const seedUsage: UsageRecord[] = [
  { id: 'us-1', at: '2026-09-23T09:42:18.000Z', userId: 'u-analyst', userName: 'Sarah Wanjiku', providerId: 'p-crb', providerName: 'CRB (TransUnion)', checkType: 'CRB Individual Report & Score', costKes: 450, status: 'success', latencyMs: 8240, subjectRef: 'ID 23456789' },
  { id: 'us-2', at: '2026-09-23T09:42:14.000Z', userId: 'u-analyst', userName: 'Sarah Wanjiku', providerId: 'p-kra', providerName: 'KRA', checkType: 'KRA PIN Validation', costKes: 40, status: 'success', latencyMs: 1420, subjectRef: 'PIN A123456789K' },
  { id: 'us-3', at: '2026-09-23T09:41:58.000Z', userId: 'u-analyst', userName: 'Sarah Wanjiku', providerId: 'p-mpesa', providerName: 'M-PESA', checkType: 'M-PESA Name & Number Match', costKes: 30, status: 'success', latencyMs: 640, subjectRef: 'MSISDN 254712***678' },
  { id: 'us-4', at: '2026-09-23T09:38:02.000Z', userId: 'u-officer', userName: 'Mike Ochieng', providerId: 'p-kplc', providerName: 'KPLC', checkType: 'Address & Utility Verification', costKes: 0, status: 'failed', latencyMs: 10000, subjectRef: 'METER 0421***12' },
  { id: 'us-5', at: '2026-09-23T09:31:44.000Z', userId: 'u-analyst', userName: 'Sarah Wanjiku', providerId: 'p-employer', providerName: 'Employer Verification', checkType: 'Employer Verification', costKes: 150, status: 'success', latencyMs: 2130, subjectRef: 'ID 31204921' },
  { id: 'us-6', at: '2026-09-23T08:15:03.000Z', userId: 'u-officer', userName: 'Mike Ochieng', providerId: 'p-kra', providerName: 'KRA', checkType: 'KRA PIN Validation', costKes: 40, status: 'success', latencyMs: 1290, subjectRef: 'PIN A35118740A' },
  { id: 'us-7', at: '2026-09-22T16:20:11.000Z', userId: 'u-analyst', userName: 'Sarah Wanjiku', providerId: 'p-crb', providerName: 'CRB (TransUnion)', checkType: 'CRB Individual Report & Score', costKes: 450, status: 'success', latencyMs: 7980, subjectRef: 'ID 28941042' },
  { id: 'us-8', at: '2026-09-22T14:02:19.000Z', userId: 'u-admin', userName: 'David Mbugua', providerId: 'p-brs', providerName: 'Business Registry (BRS)', checkType: 'Company Registry Search', costKes: 350, status: 'success', latencyMs: 2460, subjectRef: 'REG C-2021-447812' },
];

/* ------------------------------- activities ------------------------------- */

export const recentActivities: ActivityItem[] = [
  { id: 'a1', title: 'Identity Report — John Mwangi Kamau', time: '2m ago', status: 'Completed', type: 'identity', userId: 'u-analyst' },
  { id: 'a2', title: 'M-PESA KYC — Jane Achieng Odede', time: '5 min ago', status: 'Completed', type: 'mpesa', userId: 'u-analyst' },
  { id: 'a3', title: 'CRB Check — Peter Kimani Maina', time: '12 min ago', status: 'Completed', type: 'crb', userId: 'u-officer' },
  { id: 'a4', title: 'KYB Entity Review — Kamtech Solutions Ltd', time: '20 min ago', status: 'Completed', type: 'kyb', userId: 'u-admin' },
  { id: 'a5', title: 'KPLC Address Verification — Daniel Otieno', time: '38 min ago', status: 'Failed', type: 'kplc', userId: 'u-officer' },
];
