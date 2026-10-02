import React from 'react';
import { ArrowRight, Building2, CalendarClock, ClipboardCheck, Fingerprint, LogIn, MailCheck, ShieldCheck } from 'lucide-react';
import { useAppRouter } from '../../context/RouterContext';
import { IprsLogo } from '../common/IprsLogo';
import { Button } from '../ui';

/** Sales inbox for demo requests — kept as a `mailto:` CTA per the brief. */
export const SALES_EMAIL = 'sales@fleek-iprs.co.ke';

/**
 * Public onboarding explainer — the front door for organisations that do not
 * have a workspace yet. Lays out the three steps (register → Super Admin
 * review → credentials by email) and routes into `/register` or `/login`.
 */
export const Screen0_GetStarted: React.FC = () => {
  const { navigate } = useAppRouter();

  const steps = [
    {
      icon: <Building2 size={15} />,
      t: '1 · Register your organisation',
      d: 'Company name, county, contact details and your certificate of incorporation (max 2 MB per file).',
    },
    {
      icon: <ClipboardCheck size={15} />,
      t: '2 · Super Admin review',
      d: 'A platform Super Admin verifies the submission — usually within one business day.',
    },
    {
      icon: <MailCheck size={15} />,
      t: '3 · Credentials by email',
      d: 'Approval creates a User-tier workspace and emails your username plus a temporary password.',
    },
  ];

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
          Fleek IPRS · Identity verification for Kenya · Demo environment, no live PII is transmitted
        </p>
      </aside>

      {/* Steps panel */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-8 w-full min-w-0">
        <div className="w-full max-w-[440px]">
          <div className="lg:hidden mb-6 flex justify-center">
            <IprsLogo size="md" showSubtitle={false} />
          </div>

          <div className="rounded-2xl border border-sky-900/60 bg-[#071120]/95 shadow-[0_24px_70px_rgba(0,0,0,0.6)] p-5 sm:p-7 backdrop-blur">
            <h1 className="text-lg sm:text-xl font-bold text-white">Get started with Fleek IPRS</h1>
            <p className="text-xs text-slate-400 mt-1">
              New here? Three steps stand between you and your verification workspace.
            </p>

            <div className="mt-5 space-y-3">
              {steps.map((s) => (
                <div key={s.t} className="flex items-start gap-3 rounded-xl bg-[#050b14] border border-sky-900/60 p-3">
                  <span className="mt-0.5 text-cyan-400">{s.icon}</span>
                  <span>
                    <span className="block text-xs font-bold text-white">{s.t}</span>
                    <span className="block text-[11px] text-slate-400 leading-snug mt-0.5">{s.d}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2">
              <Button variant="primary" className="w-full justify-center py-2.5" icon={<ArrowRight size={14} />} onClick={() => navigate('/register')}>
                Get Started / Register
              </Button>
              <a
                href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent('Fleek IPRS demo request')}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all active:scale-[0.97] whitespace-nowrap w-full px-3.5 py-2 text-xs bg-transparent hover:bg-sky-950/60 text-cyan-300 border border-cyan-500/40"
              >
                <CalendarClock size={14} /> Book Demo
              </a>
              <p className="text-center text-[10px] text-slate-600">
                Prefer a walkthrough first? Email us at <span className="font-mono text-slate-500">{SALES_EMAIL}</span>.
              </p>
              <Button variant="ghost" className="w-full justify-center" icon={<LogIn size={13} />} onClick={() => navigate('/login')}>
                Back to sign-in
              </Button>
            </div>
          </div>

          <p className="mt-4 text-center text-[10px] text-slate-600 leading-relaxed">
            Already approved? Your credentials arrive by email from Fleek IPRS — then sign in.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Screen0_GetStarted;
