import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Clock3, Inbox, ShieldCheck, XCircle } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useDb } from '../../services/db';
import { registrationService } from '../../services/registration.service';
import type { PendingRegistration, RegistrationStatus } from '../../types';
import { Badge, Button, Panel } from '../ui';

const FILTERS: { id: RegistrationStatus | 'all'; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

const toneFor = (s: RegistrationStatus) => (s === 'pending' ? 'warning' : s === 'approved' ? 'success' : 'danger');

/**
 * Super Admin review queue for public registration requests.
 *
 * Approve mints a `user`-tier Active account (username + temp password go out
 * through the `fleek-iprs-registration-approved` email); reject records a
 * reason the reviewer can quote back to the applicant.
 */
export const Screen15_PendingApprovals: React.FC = () => {
  const { currentUser, pushToast } = useAppData();
  const { pendingRegistrations } = useDb();
  const [filter, setFilter] = useState<RegistrationStatus | 'all'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [lastCreds, setLastCreds] = useState<{ username: string; tempPassword: string; email: string } | null>(null);

  useEffect(() => {
    void registrationService.refresh(currentUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = pendingRegistrations.filter((r) => filter === 'all' || r.status === filter);
  const pendingCount = pendingRegistrations.filter((r) => r.status === 'pending').length;

  const approve = async (reg: PendingRegistration) => {
    setBusyId(reg.id);
    const res = await registrationService.approve(currentUser, reg.id);
    setBusyId(null);
    if (res.ok) {
      setLastCreds({ username: res.username ?? '', tempPassword: res.tempPassword ?? '', email: reg.contactEmail });
      pushToast({ title: 'Registration approved', description: `${reg.company} — credentials emailed to ${reg.contactEmail}`, type: 'success' });
    } else {
      pushToast({ title: 'Approval failed', description: res.message, type: 'error' });
    }
  };

  const reject = async (reg: PendingRegistration) => {
    if (!reason.trim()) {
      pushToast({ title: 'Reason required', description: 'Give a reason — the applicant sees it.', type: 'warning' });
      return;
    }
    setBusyId(reg.id);
    const res = await registrationService.reject(currentUser, reg.id, reason.trim());
    setBusyId(null);
    if (res.ok) {
      setRejectId(null);
      setReason('');
      pushToast({ title: 'Registration rejected', description: `${reg.company} — decision recorded`, type: 'warning' });
    } else {
      pushToast({ title: 'Rejection failed', description: res.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Pending Approvals"
        subtitle={`${pendingCount} request${pendingCount === 1 ? '' : 's'} awaiting review — approval creates a User-tier workspace and emails the credentials`}
        icon={<ShieldCheck size={14} />}
        actions={
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                  filter === f.id
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                    : 'bg-[#050b14] text-slate-400 border-sky-900/60 hover:border-sky-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        {lastCreds && (
          <div className="mb-3 rounded-lg bg-emerald-950/40 border border-emerald-800/50 px-3 py-2.5 text-[11px] text-emerald-200">
            <span className="font-bold">Account created for {lastCreds.email}.</span>{' '}
            Username <span className="font-mono select-all">{lastCreds.username}</span> · temporary password{' '}
            <span className="font-mono select-all">{lastCreds.tempPassword}</span> — also emailed to the applicant.
          </div>
        )}

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-500">
            <Inbox size={28} />
            <p className="text-xs">
              {filter === 'pending' ? 'Review queue is clear — no organisation is waiting.' : `No ${filter} requests.`}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {visible.map((reg) => (
              <article key={reg.id} className="rounded-xl bg-[#050b14] border border-sky-900/60 p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-9 h-9 rounded-lg bg-sky-950/60 border border-sky-800/50 flex items-center justify-center text-cyan-300 shrink-0">
                      <Building2 size={16} />
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-[13px] font-bold text-white truncate">{reg.company}</h4>
                      <p className="text-[11px] text-slate-400 truncate">
                        {reg.contactName} · <span className="font-mono">{reg.contactEmail}</span> · {reg.contactPhone} · {reg.county}
                        {reg.kraPin ? ` · PIN ${reg.kraPin}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                        Requested {new Date(reg.createdAt).toLocaleString('en-KE')}
                        {reg.decidedAt ? ` · decided ${new Date(reg.decidedAt).toLocaleString('en-KE')} by ${reg.decidedBy ?? '—'}` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge tone={toneFor(reg.status)} dot>
                    {reg.status === 'pending' ? 'Awaiting review' : reg.status === 'approved' ? 'Approved' : 'Rejected'}
                  </Badge>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-mono">
                  <span className={reg.certOfIncorporation ? 'text-emerald-400' : 'text-rose-400'}>
                    {reg.certOfIncorporation ? '●' : '○'} certificate of incorporation
                  </span>
                  <span className={reg.kraPinCert ? 'text-emerald-400' : ''}>{reg.kraPinCert ? '●' : '○'} KRA PIN cert</span>
                  <span className={reg.idCopy ? 'text-emerald-400' : ''}>{reg.idCopy ? '●' : '○'} ID copy</span>
                  {reg.rejectionReason && <span className="text-rose-300">Reason: {reg.rejectionReason}</span>}
                  {reg.createdUserId && <span className="text-emerald-300">Account: {reg.createdUserId}</span>}
                </div>

                {reg.status === 'pending' && (
                  <div className="mt-3">
                    {rejectId === reg.id ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          autoFocus
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Rejection reason (shared with the applicant)…"
                          className="flex-1 px-3 py-2 rounded-lg bg-[#071120] border border-sky-900 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                        />
                        <div className="flex gap-2">
                          <Button variant="danger" size="sm" loading={busyId === reg.id} icon={<XCircle size={13} />} onClick={() => reject(reg)}>
                            Confirm reject
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setRejectId(null); setReason(''); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="success" size="sm" loading={busyId === reg.id} icon={<CheckCircle2 size={13} />} onClick={() => approve(reg)}>
                          Approve &amp; create account
                        </Button>
                        <Button variant="outline" size="sm" icon={<XCircle size={13} />} onClick={() => { setRejectId(reg.id); setReason(''); }}>
                          Reject with reason
                        </Button>
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                          <Clock3 size={11} /> approval emails the username + temporary password
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
};

export default Screen15_PendingApprovals;
