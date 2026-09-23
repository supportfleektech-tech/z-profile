/** Formatting, validation and small pure helpers shared across the platform. */

export const KES = (n: number, opts: { decimals?: boolean } = {}): string => {
  const decimals = opts.decimals ?? false;
  const v = Number.isFinite(n) ? n : 0;
  return `KES ${v.toLocaleString('en-KE', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`;
};

export const num = (n: number): string => (Number.isFinite(n) ? n : 0).toLocaleString('en-KE');

export const pct = (n: number, digits = 1): string => `${(Number.isFinite(n) ? n : 0).toFixed(digits)}%`;

export function formatDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return iso;
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------ validation ------------------------------ */

export function normalizeMsisdn(input: string): string | null {
  const digits = input.replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith('7') || digits.startsWith('1')) {
    if (digits.length === 9) return `254${digits}`;
  }
  if (digits.length === 12) return digits;
  return null;
}

export function maskMsisdn(msisdn: string): string {
  const d = msisdn.replace(/[^\d]/g, '');
  if (d.length < 7) return d;
  return `${d.slice(0, 4)} *** ${d.slice(-3)}`;
}

export function luhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export type CardBrand = 'Visa' | 'Mastercard' | 'Amex' | 'UnionPay' | 'Discover' | 'Unknown';

export function cardBrand(cardNumber: string): CardBrand {
  const d = cardNumber.replace(/\D/g, '');
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'Amex';
  if (/^62/.test(d)) return 'UnionPay';
  if (/^6(011|5)/.test(d)) return 'Discover';
  return 'Unknown';
}

export function maskCard(cardNumber: string): string {
  const d = cardNumber.replace(/\D/g, '');
  if (d.length < 4) return d;
  return `**** **** **** ${d.slice(-4)}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim());
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface PasswordStrength {
  score: number; // 0-4
  label: string;
  checks: { label: string; pass: boolean }[];
}

export function scorePassword(pw: string, policy?: {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumber?: boolean;
  requireSymbol?: boolean;
}): PasswordStrength {
  const min = policy?.minLength ?? 8;
  const checks = [
    { label: `At least ${min} characters`, pass: pw.length >= min },
    { label: 'Uppercase letter', pass: policy?.requireUppercase === false ? true : /[A-Z]/.test(pw) },
    { label: 'Lowercase letter', pass: policy?.requireLowercase === false ? true : /[a-z]/.test(pw) },
    { label: 'Number', pass: policy?.requireNumber === false ? true : /\d/.test(pw) },
    { label: 'Symbol', pass: policy?.requireSymbol === false ? true : /[^A-Za-z0-9]/.test(pw) },
  ];
  const passed = checks.filter((c) => c.pass).length;
  const score = Math.max(0, Math.min(4, passed - 1 + (pw.length >= min + 6 ? 1 : 0)));
  const label = ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'][score] ?? 'Very weak';
  return { score, label, checks };
}

/* ------------------------------- misc ---------------------------------- */

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function groupBy<T, K extends string>(items: T[], keyFn: (item: T) => K): Record<K, T[]> {
  return items.reduce((acc, item) => {
    const k = keyFn(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

export function sum<T>(items: T[], fn: (item: T) => number): number {
  return items.reduce((a, b) => a + (Number(fn(b)) || 0), 0);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadText(content: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBlob(new Blob([content], { type: mime }), filename);
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return '';
  const cols = columns ?? Object.keys(rows[0]);
  const esc = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function maskSecret(secret: string, visible = 4): string {
  if (!secret) return '—';
  if (secret.length <= visible) return '•'.repeat(secret.length);
  return `${'•'.repeat(Math.max(4, secret.length - visible))}${secret.slice(-visible)}`;
}

/** Apply the PII masking rules from compliance settings to a value. */
export function maskPii(value: string, mode: 'full' | 'partial' | 'none'): string {
  if (mode === 'none' || !value) return value;
  if (mode === 'full') return '••••••••';
  if (value.length <= 4) return `${value[0]}***`;
  return `${value.slice(0, 2)}${'•'.repeat(Math.max(3, value.length - 4))}${value.slice(-2)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
