import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, Loader2, KeyRound, AlertTriangle, Fingerprint, ArrowRight } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';
import { IprsLogo } from '../common/IprsLogo';
import { demoPersonas, DEMO_PASSWORD } from '../../data/users';
import { TIER_META } from '../../auth/permissions';
import { Button } from '../ui';

interface Screen1LoginProps {
  onLoginSuccess?: () => void;
}

/**
 * Credential-gated sign-in.
 *
 * The three tiers are separate experiences: after authentication the user is routed to
 * their own dashboard and the shell rebuilds its navigation from their permission set.
 */
export const Screen1_Login: React.FC<Screen1LoginProps> = ({ onLoginSuccess }) => {
  const { login, currentUser } = useAppData();
  const { navigate } = useAppRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [persona, setPersona] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) navigate('/dashboard');
  }, [currentUser, navigate]);

  const demoRows = useMemo(
    () =>
      demoPersonas.map((p) => ({
        ...p,
        meta: TIER_META[p.tier],
      })),
    []
  );

  const fill = (p: (typeof demoPersonas)[number]) => {
    setEmail(p.email);
    setPassword(p.password);
    setPersona(p.email);
    setError(null);
    setLocked(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLocked(null);
    if (!email.trim() || !password.trim()) {
      setError('Enter both your work email and password.');
      return;
    }
    setBusy(true);
    const res = await login(email.trim(), password);
    setBusy(false);

    if (res.ok) {
      onLoginSuccess?.();
      navigate('/dashboard');
      return;
    }
    if (res.requiresMfa) {
      setMfaStep(true);
      setPendingEmail(email.trim());
      setMfaCode('');
      return;
    }
    if (res.message?.toLowerCase().includes('lock')) setLocked(res.message);
    else setError(res.message ?? 'Invalid credentials.');
  };

  const submitMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    // Demo MFA: any 6-digit code passes; `000000` is rejected to exercise the failure path.
    if (!/^\d{6}$/.test(mfaCode)) {
      setBusy(false);
      setError('Enter the 6-digit code from your authenticator.');
      return;
    }
    if (mfaCode === '000000') {
      setBusy(false);
      setError('That code was rejected. Try again.');
      return;
    }
    const res = await login(pendingEmail, password);
    setBusy(false);
    if (res.ok) {
      setMfaStep(false);
      onLoginSuccess?.();
      navigate('/dashboard');
    } else {
      setError(res.message ?? 'Verification failed.');
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full flex items-stretch bg-[#050b14] tech-grid overflow-y-auto">
      {/* Marketing / context panel */}
      <aside className="hidden lg:flex flex-col justify-between w-[46%] xl:w-[42%] px-10 xl:px-14 py-10 border-r border-sky-950/70 bg-gradient-to-br from-[#071426] via-[#061020] to-[#050b14]">
        <div>
          <IprsLogo size="lg" showSubtitle />
          <h2 className="mt-8 text-2xl xl:text-[28px] font-black leading-tight text-white">
            Kenya&apos;s Trusted Identity &amp;<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Background Intelligence</span>
          </h2>
          <p className="mt-3 text-sm text-sky-300/70 leading-relaxed max-w-md">
            Civil registry, KRA, M-PESA, CRB, employer and utility verification in a single consented query — with a prepaid
            wallet, full audit trail and role-based access control.
          </p>

          <div className="mt-8 space-y-3">
            {(
              [
                { icon: <Fingerprint size={15} />, t: '12-source dossier', d: 'Personal, financial, connections and event log for every subject.' },
                { icon: <ShieldCheck size={15} />, t: 'Three-tier RBAC', d: 'User, Admin and Super Admin each get their own dashboard, tools and permissions.' },
                { icon: <Lock size={15} />, t: 'Data Protection Act 2019', d: 'Consent capture, PII masking, retention limits and append-only audit.' },
              ] as const
            ).map((f) => (
              <div key={f.t} className="flex items-start gap-3 rounded-xl bg-[#071322]/70 border border-sky-900/50 p-3">
                <span className="mt-0.5 text-cyan-400">{f.icon}</span>
                <span>
                  <span className="block text-xs font-bold text-white">{f.t}</span>
                  <span className="block text-[11px] text-slate-400 leading-snug mt-0.5">{f.d}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-slate-600 font-mono leading-relaxed">
          Demo environment · No live PII is transmitted · All gateway calls are simulated through the service layer
        </p>
      </aside>

      {/* Form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-8 w-full min-w-0">
        <div className="w-full max-w-[440px]">
          <div className="lg:hidden mb-6 flex justify-center">
            <IprsLogo size="md" showSubtitle={false} />
          </div>

          <div className="rounded-2xl border border-sky-900/60 bg-[#071120]/95 shadow-[0_24px_70px_rgba(0,0,0,0.6)] p-5 sm:p-7 backdrop-blur">
            {!mfaStep ? (
              <>
                <h1 className="text-lg sm:text-xl font-bold text-white">Sign in to your workspace</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Your role determines the dashboard, navigation and tools you receive.
                </p>

                <form onSubmit={submit} className="mt-5 space-y-3.5" noValidate>
                  <div>
                    <label htmlFor="login-email" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Work email
                    </label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@iprs.co.ke"
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#050b14] border border-sky-900 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••"
                        className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-[#050b14] border border-sky-900 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-300"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 rounded-lg bg-rose-950/40 border border-rose-800/50 px-3 py-2 text-[11px] text-rose-300">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {locked && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-950/40 border border-amber-700/50 px-3 py-2 text-[11px] text-amber-300">
                      <Lock size={13} className="mt-0.5 shrink-0" />
                      <span>{locked}</span>
                    </div>
                  )}

                  <Button type="submit" variant="primary" loading={busy} className="w-full justify-center py-2.5" icon={<ArrowRight size={14} />}>
                    {busy ? 'Verifying…' : 'Sign in securely'}
                  </Button>
                </form>

                <div className="mt-4 pt-4 border-t border-sky-900/50">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    <KeyRound size={11} /> Demo accounts — one click to fill
                  </div>
                  <div className="grid gap-1.5">
                    {demoRows.map((p) => (
                      <button
                        key={p.email}
                        type="button"
                        onClick={() => fill(p)}
                        className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                          persona === p.email
                            ? 'border-cyan-600/70 bg-cyan-950/40'
                            : 'border-sky-900/60 bg-[#050b14] hover:border-sky-700 hover:bg-sky-950/50'
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold border ${p.meta.badge}`}>
                          {p.name
                            .split(' ')
                            .map((x) => x[0])
                            .slice(0, 2)
                            .join('')}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[11px] font-semibold text-white truncate">{p.label}</span>
                          <span className="block text-[10px] text-slate-500 truncate font-mono">{p.email}</span>
                        </span>
                        <span className="text-[9px] font-mono text-slate-600 hidden sm:inline">{p.tier === 'user' ? 'user' : p.tier}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2.5 text-[10px] text-slate-600 font-mono">
                    Shared demo password: <span className="text-cyan-500/80 select-all">{DEMO_PASSWORD}</span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center text-cyan-300">
                    <ShieldCheck size={18} />
                  </span>
                  <div>
                    <h1 className="text-base font-bold text-white">Two-factor verification</h1>
                    <p className="text-[11px] text-slate-400">{pendingEmail}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  This account has multi-factor authentication enforced by the security policy. Enter the 6-digit code from your
                  authenticator app.
                </p>
                <form onSubmit={submitMfa} className="mt-4 space-y-3">
                  <input
                    autoFocus
                    inputMode="numeric"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 rounded-lg bg-[#050b14] border border-sky-900 text-white placeholder:text-slate-700 focus:outline-none focus:border-cyan-500"
                    aria-label="Two-factor code"
                  />
                  {error && <p className="text-[11px] text-rose-300">{error}</p>}
                  <Button type="submit" variant="primary" loading={busy} className="w-full justify-center" icon={<Lock size={13} />}>
                    Verify &amp; continue
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-center"
                    onClick={() => {
                      setMfaStep(false);
                      setError(null);
                    }}
                  >
                    Back to sign-in
                  </Button>
                </form>
                <p className="mt-3 text-[10px] text-slate-600 flex items-center gap-1.5">
                  {busy ? <Loader2 size={11} className="animate-spin" /> : <AlertTriangle size={11} />}
                  Demo hint: any 6 digits except 000000 are accepted.
                </p>
              </>
            )}
          </div>

          <p className="mt-4 text-center text-[10px] text-slate-600 leading-relaxed">
            Accounts are provisioned by an administrator. Super Admin is a seeded system account and cannot be created through
            the interface.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Screen1_Login;
