import React from 'react';
import { ShieldAlert, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';
import { TIER_DASHBOARDS } from '../../auth/permissions';
import { Button } from '../ui';

/** Shown when a signed-in account deep-links to a route its tier cannot open. */
export const AccessDenied: React.FC<{ path: string }> = ({ path }) => {
  const { currentUser, roleLabel, logout } = useAppData();
  const { navigate } = useAppRouter();

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-tech-grid">
      <div className="max-w-md w-full bg-[#071120] border border-rose-500/25 rounded-2xl p-6 sm:p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
          <ShieldAlert size={26} />
        </div>
        <h1 className="text-lg font-bold text-white">Access denied</h1>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          Your account is signed in as <span className="text-cyan-300 font-semibold">{roleLabel}</span>, which does not include
          access to <span className="font-mono text-slate-300">{path}</span>.
        </p>

        <div className="mt-5 grid gap-2 text-left">
          <div className="rounded-xl bg-[#091629] border border-sky-900/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Your dashboard</p>
            <p className="text-xs text-white font-semibold mt-0.5">
              {currentUser ? TIER_DASHBOARDS[currentUser.tier] : '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
              Each role tier gets its own dashboard, navigation and tools. Sign in with an account that holds this permission to
              reach the page above.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
          <Button variant="primary" onClick={() => navigate('/dashboard')} icon={<LayoutDashboard size={13} />}>
            Go to my dashboard
          </Button>
          <Button variant="secondary" onClick={() => navigate('/login')} icon={<ArrowLeft size={13} />}>
            Switch account
          </Button>
          <Button variant="ghost" onClick={() => logout('Switching account')}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
