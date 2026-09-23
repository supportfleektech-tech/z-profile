import React, { useState } from 'react';
import { IprsLogo } from '../common/IprsLogo';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, CheckCircle2, Shield, Loader2 } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';

interface Screen1LoginProps {
  onLoginSuccess?: () => void;
}

export const Screen1_Login: React.FC<Screen1LoginProps> = ({ onLoginSuccess }) => {
  const { login, isAuthenticated } = useAppData();
  const [email, setEmail] = useState('admin@iprs.co.ke');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loginMessage, setLoginMessage] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoginMessage('');

    if (!email.trim()) {
      setError('Email or username is required');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await login(email.trim(), password);
      if (ok) {
        setLoginMessage('Authentication verified. Access granted.');
        setTimeout(() => onLoginSuccess?.(), 500);
      } else {
        setError('Invalid credentials. Contact your administrator.');
      }
    } catch {
      setError('Authentication service unavailable. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[420px] sm:min-h-[480px] bg-[#071120] rounded-xl overflow-hidden border border-sky-900/40 text-slate-100 flex flex-col md:flex-row shadow-2xl">
      {/* Background */}
      <div className="absolute inset-0 z-0 opacity-25 pointer-events-none">
        <img
          src="/images/nairobi-skyline.jpg"
          alt=""
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#071120] via-[#071120]/85 to-[#071120]/60" />
      </div>

      {/* Left brand column */}
      <div className="relative z-10 w-full md:w-1/2 p-5 sm:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-sky-900/30">
        <div>
          <IprsLogo size="md" showSubtitle={true} />
          <div className="mt-8 sm:mt-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              Better Intelligence.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-300">
                Safer Decisions.
              </span>
            </h2>
            <p className="mt-3 text-sm text-sky-200/70 leading-relaxed max-w-sm">
              Access comprehensive identity and background verification data from trusted Kenyan and global sources via Spin Mobile.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-sky-900/40 flex items-center gap-4 sm:gap-5 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-medium text-sky-300/90">
            <ShieldCheck size={15} className="text-cyan-400" />
            <span>Secure</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-sky-300/90">
            <CheckCircle2 size={15} className="text-emerald-400" />
            <span>Compliant</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-sky-300/90">
            <Shield size={15} className="text-blue-400" />
            <span>Reliable</span>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="relative z-10 w-full md:w-1/2 p-5 sm:p-8 flex flex-col justify-center bg-[#091527]/75 backdrop-blur-sm">
        <div className="max-w-sm w-full mx-auto">
          <h3 className="text-lg sm:text-xl font-bold text-white">
            {isAuthenticated ? 'Session Active' : 'Welcome Back'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Sign in to your IPRS account
          </p>

          <form onSubmit={handleSignIn} className="mt-5 space-y-3.5" noValidate>
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Email or Username
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  className="w-full bg-[#050b14] border border-sky-800/50 rounded-lg py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  placeholder="admin@iprs.co.ke"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full bg-[#050b14] border border-sky-800/50 rounded-lg py-2.5 pl-9 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-sky-900 bg-sky-950 text-cyan-500 focus:ring-cyan-500 w-3.5 h-3.5"
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                className="text-cyan-400 hover:text-cyan-300"
                onClick={() => setLoginMessage('Password reset link sent to your email (demo).')}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-500/30 rounded-lg px-3 py-2" role="alert">
                {error}
              </p>
            )}
            {loginMessage && !error && (
              <p className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 rounded-lg px-3 py-2 animate-fade-in">
                {loginMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-60 text-white font-semibold text-sm shadow-[0_0_18px_rgba(6,182,212,0.35)] transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying…</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>

            <p className="text-[11px] text-center text-slate-400 pt-1">
              Don&apos;t have an account?{' '}
              <span className="text-cyan-400">Contact your administrator</span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
export default Screen1_Login;
