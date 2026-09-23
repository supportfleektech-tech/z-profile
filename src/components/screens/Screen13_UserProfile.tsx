import React, { useState } from 'react';
import { UserCog, ShieldCheck, CheckCircle2, Lock, LogOut, Save } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';

export const Screen13_UserProfile: React.FC = () => {
  const { currentUser, pushToast, logout } = useAppData();
  const { navigate } = useAppRouter();
  const [activeTab, setActiveTab] = useState<'Profile' | 'Security' | 'Notifications' | 'Appearance'>('Profile');
  const [name, setName] = useState(currentUser?.name || 'John Kamau');
  const [email, setEmail] = useState(currentUser?.email || 'john@iprs.co.ke');
  const [phone, setPhone] = useState('+254 712 345 678');
  const [department, setDepartment] = useState('Operations');

  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(true);
  const [twoFactor, setTwoFactor] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      pushToast({ title: 'Profile saved', description: 'Your details were updated', type: 'success' });
    }, 600);
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass && newPass !== confirmPass) {
      pushToast({ title: 'Passwords do not match', type: 'error' });
      return;
    }
    if (newPass && newPass.length < 8) {
      pushToast({ title: 'Password too short', description: 'Use at least 8 characters', type: 'warning' });
      return;
    }
    pushToast({ title: 'Password updated', description: 'Credentials rotated successfully', type: 'success' });
    setCurrentPass('');
    setNewPass('');
    setConfirmPass('');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-full h-full min-h-[420px] bg-[#071120] text-slate-100 rounded-xl overflow-hidden border border-sky-900/40 flex flex-col text-xs">
      <div className="px-3 sm:px-4 py-2.5 bg-[#091629] border-b border-sky-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog size={15} className="text-cyan-400" />
          <h2 className="text-xs sm:text-sm font-bold text-white">My Profile</h2>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-950/40 text-[10px] font-medium transition-colors"
        >
          <LogOut size={12} />
          Sign Out
        </button>
      </div>

      <div className="px-3 sm:px-4 py-3 bg-[#081527] border-b border-sky-900/40 flex items-center gap-3">
        <div className="relative">
          <img
            src="/images/avatar-john.jpg"
            alt={name}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-cyan-500/50"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[#081527]" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white text-sm">{name}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
              <CheckCircle2 size={9} /> {currentUser?.role || 'Super Admin'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{email}</span>
        </div>
      </div>

      <div className="px-3 sm:px-4 py-1.5 bg-[#06101c] border-b border-sky-900/40 flex items-center gap-2 overflow-x-auto">
        {(['Profile', 'Security', 'Notifications', 'Appearance'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap ${
              activeTab === tab ? 'bg-sky-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-sky-950/40'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-3 overflow-y-auto">
        <div className="md:col-span-6 bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 space-y-3">
          <h3 className="text-xs font-semibold text-white pb-1.5 border-b border-sky-900/30">Personal Information</h3>

          <div className="space-y-2.5 text-[11px]">
            <div>
              <label className="block text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#050b14] border border-sky-900/60 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Official Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#050b14] border border-sky-900/60 rounded-lg py-2 px-3 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-400 mb-1">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#050b14] border border-sky-900/60 rounded-lg py-2 px-3 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-[#050b14] border border-sky-900/60 rounded-lg py-2 px-3 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-sky-900/30">
            <span className="text-[10px] font-semibold text-white block mb-2">Preferences</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {[
                { label: 'Email notifications', val: emailNotif, set: setEmailNotif },
                { label: 'SMS notifications', val: smsNotif, set: setSmsNotif },
                { label: 'Two-factor auth', val: twoFactor, set: setTwoFactor },
                { label: 'Login alerts', val: loginAlerts, set: setLoginAlerts },
              ].map((pref) => (
                <label key={pref.label} className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white p-2 rounded-lg hover:bg-sky-950/40">
                  <input
                    type="checkbox"
                    checked={pref.val}
                    onChange={(e) => {
                      pref.set(e.target.checked);
                      pushToast({
                        title: e.target.checked ? 'Enabled' : 'Disabled',
                        description: pref.label,
                        type: 'info',
                      });
                    }}
                    className="rounded border-sky-900 bg-sky-950 text-cyan-500 w-3.5 h-3.5"
                  />
                  <span>{pref.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(2,132,199,0.3)] transition-all disabled:opacity-60"
          >
            <Save size={13} />
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>

        <div className="md:col-span-6 bg-[#091629] p-3 sm:p-4 rounded-xl border border-sky-900/40 flex flex-col justify-between">
          <form onSubmit={handleUpdatePassword} className="space-y-2.5">
            <h3 className="text-xs font-semibold text-white pb-1.5 border-b border-sky-900/30 flex items-center justify-between">
              <span>Change Password</span>
              <Lock size={12} className="text-cyan-400" />
            </h3>

            <div className="space-y-2 text-[11px]">
              <div>
                <label className="block text-slate-400 mb-1">Current password</label>
                <input
                  type="password"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#050b14] border border-sky-900/60 rounded-lg py-2 px-3 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">New password</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-[#050b14] border border-sky-900/60 rounded-lg py-2 px-3 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Confirm password</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-[#050b14] border border-sky-900/60 rounded-lg py-2 px-3 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all mt-2"
            >
              Update Password
            </button>
          </form>

          <div className="mt-3 text-[9px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-emerald-400" />
            <span>FIPS 140-2 Level 3 compliant credentials</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Screen13_UserProfile;
