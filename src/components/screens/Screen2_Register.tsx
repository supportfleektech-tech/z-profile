import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, FileUp, LogIn, ShieldCheck, UserRound } from 'lucide-react';
import { useAppRouter } from '../../context/RouterContext';
import { IprsLogo } from '../common/IprsLogo';
import { Button } from '../ui';
import { MAX_REG_FILE_BYTES, registrationService, type RegistrationInput } from '../../services/registration.service';

const KENYA_COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo',
  'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui',
  'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori',
  'Mombasa', 'Murang\'a', 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri',
  'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans Nzoia', 'Turkana',
  'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot',
];

const inputClass =
  'w-full pl-3 pr-3 py-2.5 rounded-lg bg-[#050b14] border border-sky-900 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40';

const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5';

const panelTitleClass = 'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300/80 mb-3';

/**
 * Public organisation registration — mirrors the Screen1_Login two-panel
 * layout (marketing/context panel + form panel). The form itself is split
 * into two panels: LEFT = organisation (company, county, certificate of
 * incorporation, corporate tax certificate); RIGHT = contact person (first
 * name, last name, phone, email, terms consent, Register + Back to Login).
 * Files are converted to base64 dataURLs with a 2 MB per-file cap; the
 * request lands in the Super Admin's Pending Approvals queue.
 */
export const Screen2_Register: React.FC = () => {
  const { navigate } = useAppRouter();
  const [form, setForm] = useState({ company: '', county: '', firstName: '', lastName: '', contactEmail: '', contactPhone: '' });
  const [cert, setCert] = useState('');
  const [taxCert, setTaxCert] = useState('');
  const [certName, setCertName] = useState('');
  const [taxCertName, setTaxCertName] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const readFile = (file: File | undefined, apply: (dataUrl: string, name: string) => void) => {
    if (!file) return;
    if (file.size > MAX_REG_FILE_BYTES) {
      setError(`"${file.name}" exceeds the 2 MB limit — attach a smaller file.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      apply(String(reader.result ?? ''), file.name);
    };
    reader.onerror = () => {
      setError(`"${file.name}" could not be read — try again.`);
    };
    reader.readAsDataURL(file);
  };

  const fileRow = (
    label: string, required: boolean, fileName: string,
    onPick: (f: File | undefined) => void, testId: string
  ) => (
    <div>
      <span className={labelClass}>
        {label} {required ? <span className="text-rose-400">*</span> : <span className="text-slate-600 normal-case">(optional)</span>}
      </span>
      <label
        className="flex items-center gap-2.5 rounded-lg bg-[#050b14] border border-dashed border-sky-800 px-3 py-2.5 cursor-pointer hover:border-cyan-600 transition-colors"
      >
        <FileUp size={14} className="text-cyan-400 shrink-0" />
        <span className="text-[11px] text-slate-300 truncate flex-1">{fileName || 'Choose a file (PDF, JPG or PNG · max 2 MB)'}</span>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="sr-only"
          data-testid={testId}
          onChange={(e) => {
            onPick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const input: RegistrationInput = {
      company: form.company,
      county: form.county,
      firstName: form.firstName,
      lastName: form.lastName,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      certOfIncorporation: cert,
      kraPinCert: taxCert || undefined,
      termsAccepted: terms,
    };
    const res = await registrationService.submit(input);
    setBusy(false);
    if (res.ok) setPendingId(res.pendingId ?? 'pending');
    else setError(res.message ?? 'Registration could not be submitted.');
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full flex items-stretch bg-[#050b14] tech-grid overflow-y-auto">
      {/* Marketing / context panel */}
      <aside className="hidden lg:flex flex-col justify-between w-[38%] xl:w-[34%] px-10 xl:px-14 py-10 border-r border-sky-950/70 bg-gradient-to-br from-[#071426] via-[#061020] to-[#050b14]">
        <div>
          <IprsLogo size="lg" showSubtitle />
          <h2 className="mt-8 text-2xl xl:text-[28px] font-black leading-tight text-white">
            One workspace for<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">every verification</span>
          </h2>
          <p className="mt-3 text-sm text-sky-300/70 leading-relaxed max-w-md">
            Register your organisation and a Super Admin will review the submission. On approval you receive a
            User-tier workspace with its own prepaid wallet.
          </p>

          <div className="mt-8 space-y-3">
            {(
              [
                { icon: <Building2 size={15} />, t: 'What you need', d: 'Company name, county and your certificate of incorporation.' },
                { icon: <ShieldCheck size={15} />, t: 'Reviewed by a human', d: 'Every registration is verified by a platform Super Admin before activation.' },
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
          Fleek IPRS · Data Protection Act 2019 — your documents are used only for account verification
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-8 w-full min-w-0">
        <div className="w-full max-w-[720px]">
          <div className="lg:hidden mb-6 flex justify-center">
            <IprsLogo size="md" showSubtitle={false} />
          </div>

          <div className="rounded-2xl border border-sky-900/60 bg-[#071120]/95 shadow-[0_24px_70px_rgba(0,0,0,0.6)] p-5 sm:p-7 backdrop-blur">
            {pendingId ? (
              <div className="text-center py-4">
                <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
                <h1 className="mt-3 text-lg font-bold text-white">Registration received</h1>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Your request for <span className="text-white font-semibold">{form.company}</span> is awaiting
                  Super Admin review. Watch <span className="text-white font-mono">{form.contactEmail}</span> for
                  your credentials email once approved.
                </p>
                <p className="mt-2 text-[10px] text-slate-600 font-mono">Reference: {pendingId}</p>
                <Button variant="ghost" className="mt-5 w-full justify-center" icon={<LogIn size={13} />} onClick={() => navigate('/login')}>
                  Back to Login
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-lg sm:text-xl font-bold text-white">Register your organisation</h1>
                <p className="text-xs text-slate-400 mt-1">
                  A Super Admin reviews every request before a workspace is created.
                </p>

                <form onSubmit={submit} className="mt-5" noValidate>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* LEFT panel — organisation */}
                    <section aria-label="Organisation details">
                      <p className={panelTitleClass}><Building2 size={12} /> Organisation</p>
                      <div className="space-y-3.5">
                        <div>
                          <label htmlFor="reg-company" className={labelClass}>
                            Company name <span className="text-rose-400">*</span>
                          </label>
                          <input id="reg-company" value={form.company} onChange={set('company')} placeholder="Acme Kenya Ltd" className={inputClass} autoComplete="organization" />
                        </div>

                        <div>
                          <label htmlFor="reg-county" className={labelClass}>
                            County <span className="text-rose-400">*</span>
                          </label>
                          <select id="reg-county" value={form.county} onChange={set('county')} className={`${inputClass} ${form.county ? '' : 'text-slate-600'}`}>
                            <option value="">Select county…</option>
                            {KENYA_COUNTIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        {fileRow('Certificate of incorporation', true, certName, (f) => readFile(f, (d, n) => { setCert(d); setCertName(n); }), 'reg-cert')}
                        {fileRow('Corporate Tax Certificate', false, taxCertName, (f) => readFile(f, (d, n) => { setTaxCert(d); setTaxCertName(n); }), 'reg-kra-cert')}
                      </div>
                    </section>

                    {/* RIGHT panel — contact person */}
                    <section aria-label="Contact person">
                      <p className={panelTitleClass}><UserRound size={12} /> Contact person</p>
                      <div className="space-y-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="reg-first-name" className={labelClass}>
                              First name <span className="text-rose-400">*</span>
                            </label>
                            <input id="reg-first-name" value={form.firstName} onChange={set('firstName')} placeholder="Jane" className={inputClass} autoComplete="given-name" />
                          </div>
                          <div>
                            <label htmlFor="reg-last-name" className={labelClass}>
                              Last name <span className="text-rose-400">*</span>
                            </label>
                            <input id="reg-last-name" value={form.lastName} onChange={set('lastName')} placeholder="Wanjiku" className={inputClass} autoComplete="family-name" />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="reg-phone" className={labelClass}>
                            Phone <span className="text-rose-400">*</span>
                          </label>
                          <input id="reg-phone" value={form.contactPhone} onChange={set('contactPhone')} placeholder="0712 345 678" className={inputClass} autoComplete="tel" />
                        </div>

                        <div>
                          <label htmlFor="reg-email" className={labelClass}>
                            Email <span className="text-rose-400">*</span>
                          </label>
                          <input id="reg-email" type="email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="you@company.co.ke" className={inputClass} autoComplete="email" />
                        </div>

                        <label className="flex items-start gap-2.5 rounded-lg bg-[#050b14] border border-sky-900/60 px-3 py-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={terms}
                            onChange={(e) => setTerms(e.target.checked)}
                            className="mt-0.5 accent-cyan-500"
                          />
                          <span className="text-[11px] text-slate-400 leading-snug">
                            I accept the <span className="text-cyan-300">Terms of Service</span> and consent to Fleek IPRS
                            processing these documents for account verification under the Data Protection Act 2019.
                          </span>
                        </label>
                      </div>
                    </section>
                  </div>

                  {error && (
                    <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-950/40 border border-rose-800/50 px-3 py-2 text-[11px] text-rose-300">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="mt-5 space-y-2">
                    <Button type="submit" variant="primary" loading={busy} className="w-full justify-center py-2.5" icon={<ArrowRight size={14} />}>
                      {busy ? 'Submitting…' : 'Register'}
                    </Button>

                    <Button type="button" variant="ghost" className="w-full justify-center" icon={<LogIn size={13} />} onClick={() => navigate('/login')}>
                      Back to Login
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Screen2_Register;
