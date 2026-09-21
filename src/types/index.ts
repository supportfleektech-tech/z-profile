export type ViewMode = 'blueprint' | 'interactive';

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
  riskLevel: 'Low' | 'Medium' | 'High';
  providers: {
    kra: { verified: boolean; status: string; pin: string; taxCompliance: boolean };
    mpesa: { verified: boolean; status: string; accountName: string; activeSince: string };
    crb: { verified: boolean; status: string; score: number; defaultStatus: string };
    employer: { verified: boolean; status: string; company: string; position: string };
    kplc: { verified: boolean; status: string; meterNumber: string; activeAccount: boolean };
  };
  keyFindings: string[];
}

export interface CaseItem {
  id: string;
  caseId: string;
  subject: string;
  type: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'In Progress' | 'Open' | 'Completed' | 'Closed';
  updated: string;
}

export interface ProviderItem {
  id: string;
  name: string;
  code: string;
  category: string;
  status: 'Active' | 'Degraded' | 'Offline';
  lastSync: string;
  latencyMs: number;
  uptime: string;
  color: string;
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Analyst' | 'Officer' | 'Viewer' | 'Billing';
  status: 'Active' | 'Inactive';
}

export interface InvoiceItem {
  id: string;
  invoiceNo: string;
  date: string;
  amount: string;
  status: 'Paid' | 'Pending' | 'Overdue';
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  category: 'Security' | 'System' | 'Billing' | 'Reports';
  type: 'success' | 'warning' | 'danger' | 'info';
  read: boolean;
}
