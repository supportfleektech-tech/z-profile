import React, { useMemo, useState } from 'react';
import {
  UserCheck, ShieldCheck, Network, ScrollText, Printer, Download, Eye, EyeOff,
  FileText, Briefcase, Landmark, Zap, Building2, AlertTriangle, CheckCircle2, MinusCircle, Gauge,
  Fingerprint, MapPin, Calendar, Phone, Mail, ChevronRight,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { useAppRouter } from '../../context/RouterContext';
import { Badge, Button, Callout, EmptyState, Panel, ProgressBar, ResponsiveTable, Tabs, type Column } from '../ui';
import { buildFullReportPdf } from '../../lib/reports';
import { downloadBlob, formatDate, KES, maskPii, timeAgo } from '../../lib/format';
import { averageReportConfidence, hasReportSection, reportAmount, reportBoolean, reportConfidence, reportCount, reportDate, reportLatency, reportPercent, reportScore, reportStatus, riskScoreAvailable } from '../../lib/report-values';
import { getSnapshot } from '../../services/db';
import type {
  AddressRecord, BusinessLink, CreditFacility, DocumentRecord, Dossier, DossierSection,
  EmploymentRecord, ExtractedField, RelationshipLink, VerificationEvent, VerificationState,
} from '../../types';

interface Props {
  onViewDetailedReport?: () => void;
}

const stateTone = (s: VerificationState): 'success' | 'warning' | 'danger' | 'info' | 'neutral' =>
  s === 'verified' ? 'success' : s === 'partial' ? 'warning' : s === 'not_found' ? 'neutral' : s === 'mismatch' ? 'danger' : 'info';

const stateLabel = (s: VerificationState): string =>
  s === 'verified' ? 'Verified' : s === 'partial' ? 'Partial' : s === 'not_found' ? 'Not found' : s === 'mismatch' ? 'Mismatch' : 'Insufficient';

const riskTone = (band: Dossier['risk']['band']): 'success' | 'warning' | 'danger' | 'neutral' =>
  band === 'Low' ? 'success' : band === 'Medium' ? 'warning' : band === 'High' ? 'danger' : 'neutral';

/** Label → value grid that collapses to one column on phones. */
const FactGrid: React.FC<{ items: { label: string; value: React.ReactNode; mono?: boolean; span?: boolean }[]; columns?: 2 | 3 }> = ({
  items,
  columns = 3,
}) => (
  <dl
    className={`grid gap-x-4 gap-y-3 ${columns === 3 ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'} ${
      items.length ? '' : ''
    }`}
  >
    {items.map((it, i) => (
      <div key={`${it.label}-${i}`} className={`min-w-0 ${it.span ? 'sm:col-span-2 xl:col-span-3' : ''}`}>
        <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{it.label}</dt>
        <dd className={`text-xs text-slate-100 mt-0.5 break-words ${it.mono ? 'font-mono' : ''}`}>{it.value ?? '—'}</dd>
      </div>
    ))}
  </dl>
);

const StateIcon: React.FC<{ state: VerificationState }> = ({ state }) => {
  if (state === 'verified') return <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />;
  if (state === 'mismatch') return <AlertTriangle size={13} className="text-rose-400 shrink-0" />;
  if (state === 'partial' || state === 'insufficient') return <MinusCircle size={13} className="text-amber-400 shrink-0" />;
  return <MinusCircle size={13} className="text-slate-500 shrink-0" />;
};

/**
 * Identity Profile — the results view.
 *
 * Every tab renders the *same* underlying dossier, but grouped the way an investigator
 * reads it. Tables use `ResponsiveTable` so they become labelled cards below `md` instead
 * of overflowing the viewport.
 */
export const Screen4_IdentityProfile: React.FC<Props> = ({ onViewDetailedReport }) => {
  const { activeDossier, settings, can, pushToast, currentUser } = useAppData();
  const { navigate } = useAppRouter();
  const [tab, setTab] = useState('Overview');
  const [masked, setMasked] = useState(true);

  const d = activeDossier;
  const maskMode = masked ? 'partial' : 'none';
  const m = (v: string) => maskPii(v, maskMode);
  const taxAvailable = hasReportSection(d, ['kra']);
  const mpesaAvailable = hasReportSection(d, ['mpesa']);
  const creditAvailable = hasReportSection(d, ['crb', 'credit']);
  const employerAvailable = hasReportSection(d, ['employer']);
  const utilityAvailable = hasReportSection(d, ['kplc', 'utility']);
  const screeningAvailable = hasReportSection(d, ['screening', 'pep', 'sanction', 'criminal']);
  const businessAvailable = hasReportSection(d, ['business', 'company']);
  const riskAvailable = riskScoreAvailable(d);
  const photoAvailable = d.subject.photoMatchScore !== null && d.subject.photoMatchScore !== undefined;

  const cached = useMemo(() => Object.values(getSnapshot().dossierCache), []);

  const TABS = useMemo(
    () =>
      [
        'Overview',
        'Personal',
        'Financial',
        'Connections',
        'Logs',
      ] as const,
    []
  );

  const sectionBy = (id: string) => d.sections.filter((s) => s.id === id);
  const sectionFields = (id: string): ExtractedField[] => d.sections.find((s) => s.id === id)?.fields ?? [];

  /* ------------------------------- tables ------------------------------- */

  const addressCols: Column<AddressRecord>[] = [
    { key: 'type', header: 'Type', render: (r) => <span className="font-medium text-slate-200">{r.type}</span>, sortValue: (r) => r.type },
    { key: 'line', header: 'Address', render: (r) => <span className="block truncate">{masked ? r.line : r.line}</span>, mobilePrimary: true, sortValue: (r) => r.line },
    { key: 'city', header: 'City / County', render: (r) => `${r.city}, ${r.county}`, sortValue: (r) => r.city },
    { key: 'postal', header: 'Postal', render: (r) => <span className="font-mono">{r.postalCode ?? '—'}</span>, className: 'hidden lg:table-cell' },
    { key: 'since', header: 'Since', render: (r) => r.since ?? '—', className: 'hidden xl:table-cell', sortValue: (r) => r.since ?? '' },
    {
      key: 'confirmed',
      header: 'Confirmed by',
      render: (r) => (
        <span className="flex items-center gap-1.5">
          {r.current ? <Badge tone="success">Current</Badge> : <Badge tone="neutral">Historic</Badge>}
          <span className="text-[10px] text-slate-500 truncate">{r.confirmedBy ?? '—'}</span>
        </span>
      ),
      renderMobile: (r) => (
        <span className="flex items-center gap-1.5">
          {r.current ? <Badge tone="success">Current</Badge> : <Badge tone="neutral">Historic</Badge>}
          <span className="text-[10px] text-slate-500">{r.confirmedBy ?? '—'}</span>
        </span>
      ),
    },
  ];

  const docCols: Column<DocumentRecord>[] = [
    { key: 'type', header: 'Document', render: (r) => <span className="font-medium text-slate-200">{r.type}</span>, mobilePrimary: true, sortValue: (r) => r.type },
    { key: 'number', header: 'Number', render: (r) => <span className="font-mono text-cyan-300">{masked ? m(r.number) : r.number}</span>, sortValue: (r) => r.number },
    { key: 'issuedBy', header: 'Issued by', render: (r) => r.issuedBy, sortValue: (r) => r.issuedBy },
    { key: 'issuedOn', header: 'Issued', render: (r) => formatDate(r.issuedOn), className: 'hidden sm:table-cell', sortValue: (r) => r.issuedOn },
    { key: 'expiresOn', header: 'Expires', render: (r) => (r.expiresOn ? formatDate(r.expiresOn) : '—'), className: 'hidden lg:table-cell', sortValue: (r) => r.expiresOn ?? '' },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={r.status === 'Valid' ? 'success' : r.status === 'Expired' ? 'danger' : 'warning'}>{r.status}</Badge>,
      sortValue: (r) => r.status,
    },
  ];

  const empCols: Column<EmploymentRecord>[] = [
    { key: 'company', header: 'Employer', render: (r) => <span className="font-medium text-slate-200">{r.company}</span>, mobilePrimary: true, sortValue: (r) => r.company },
    { key: 'position', header: 'Position', render: (r) => r.position, sortValue: (r) => r.position },
    {
      key: 'period',
      header: 'Period',
      render: (r) => (
        <span className="font-mono text-[10px]">
          {formatDate(r.startDate)} → {r.endDate ? formatDate(r.endDate) : 'Present'}
        </span>
      ),
      sortValue: (r) => r.startDate,
    },
    { key: 'band', header: 'Monthly band', render: (r) => <span className="font-mono">{r.monthlyBand ?? '—'}</span>, className: 'hidden lg:table-cell' },
    { key: 'contract', header: 'Contract', render: (r) => r.contractType ?? '—', className: 'hidden xl:table-cell' },
    {
      key: 'state',
      header: 'Verification',
      render: (r) => (
        <span className="flex items-center gap-1.5">
          <StateIcon state={r.verificationState} />
          <Badge tone={stateTone(r.verificationState)}>{stateLabel(r.verificationState)}</Badge>
        </span>
      ),
      renderMobile: (r) => (
        <span className="text-[10px] text-slate-400">
          {stateLabel(r.verificationState)} · {r.verifiedBy}
        </span>
      ),
      sortValue: (r) => r.verificationState,
    },
  ];

  const facilityCols: Column<CreditFacility>[] = [
    { key: 'institution', header: 'Institution', render: (r) => <span className="font-medium text-slate-200">{r.institution}</span>, mobilePrimary: true, sortValue: (r) => r.institution },
    { key: 'type', header: 'Facility', render: (r) => r.type, sortValue: (r) => r.type },
    { key: 'opened', header: 'Opened', render: (r) => formatDate(r.openedOn), className: 'hidden lg:table-cell', sortValue: (r) => r.openedOn },
    { key: 'limit', header: 'Limit', render: (r) => <span className="font-mono">{KES(r.limit, { decimals: false })}</span>, align: 'right', sortValue: (r) => r.limit },
    { key: 'outstanding', header: 'Outstanding', render: (r) => <span className="font-mono">{KES(r.outstanding, { decimals: false })}</span>, align: 'right', sortValue: (r) => r.outstanding },
    { key: 'arrears', header: 'Arrears', render: (r) => <span className={`font-mono ${r.arrears > 0 ? 'text-rose-300' : 'text-slate-500'}`}>{r.arrears > 0 ? KES(r.arrears, { decimals: false }) : '—'}</span>, align: 'right', className: 'hidden sm:table-cell', sortValue: (r) => r.arrears },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={r.status === 'Current' ? 'success' : r.status === 'Closed' ? 'neutral' : r.status === 'Watch' ? 'warning' : 'danger'}>{r.status}</Badge>,
      sortValue: (r) => r.status,
    },
  ];

  const linkCols: Column<RelationshipLink>[] = [
    { key: 'name', header: 'Person / Entity', render: (r) => <span className="font-medium text-slate-200">{r.name}</span>, mobilePrimary: true, sortValue: (r) => r.name },
    { key: 'relation', header: 'Relationship', render: (r) => r.relation, sortValue: (r) => r.relation },
    {
      key: 'linkType',
      header: 'Link',
      render: (r) => (
        <Badge tone={r.linkType === 'Family' ? 'accent' : r.linkType === 'Business' ? 'info' : r.linkType === 'Financial' ? 'warning' : 'neutral'}>
          {r.linkType}
        </Badge>
      ),
      sortValue: (r) => r.linkType,
    },
    {
      key: 'strength',
      header: 'Strength',
      render: (r) => (
        <span className="flex items-center gap-1.5 min-w-[92px]">
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`w-1.5 h-3 rounded-sm ${
                  (r.strength === 'Strong' && i < 3) || (r.strength === 'Moderate' && i < 2) || (r.strength === 'Weak' && i < 1)
                    ? 'bg-cyan-400'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </span>
          <span className="text-[10px] text-slate-400">{r.strength}</span>
        </span>
      ),
      sortValue: (r) => r.strength,
    },
    { key: 'evidence', header: 'Evidence', render: (r) => <span className="text-[10px] text-slate-400 line-clamp-2">{r.evidence}</span> },
    {
      key: 'flags',
      header: 'Flags',
      render: (r) => (
        <span className="flex flex-wrap gap-1">
          {r.pep && <Badge tone="warning">PEP</Badge>}
          {r.sanctioned && <Badge tone="danger">Sanctioned</Badge>}
          {!r.pep && !r.sanctioned && <Badge tone="success">Clear</Badge>}
        </span>
      ),
      sortValue: (r) => (r.pep ? 2 : r.sanctioned ? 1 : 0),
    },
  ];

  const bizCols: Column<BusinessLink>[] = [
    { key: 'company', header: 'Company', render: (r) => <span className="font-medium text-slate-200">{r.companyName}</span>, mobilePrimary: true, sortValue: (r) => r.companyName },
    { key: 'reg', header: 'Registration', render: (r) => <span className="font-mono text-cyan-300">{r.registrationNo}</span>, sortValue: (r) => r.registrationNo },
    { key: 'role', header: 'Role', render: (r) => r.role, sortValue: (r) => r.role },
    {
      key: 'share',
      header: 'Shareholding',
      render: (r) => (r.shareholdingPct != null ? <span className="font-mono">{r.shareholdingPct}%</span> : '—'),
      align: 'right',
      sortValue: (r) => r.shareholdingPct ?? -1,
    },
    { key: 'inc', header: 'Incorporated', render: (r) => (r.incorporatedOn ? formatDate(r.incorporatedOn) : '—'), className: 'hidden lg:table-cell', sortValue: (r) => r.incorporatedOn ?? '' },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Badge tone={r.status === 'Active' ? 'success' : r.status === 'Dormant' ? 'warning' : 'neutral'}>{r.status}</Badge>,
      sortValue: (r) => r.status,
    },
    { key: 'verifiedBy', header: 'Source', render: (r) => <span className="text-[10px] text-slate-500">{r.verifiedBy}</span>, className: 'hidden xl:table-cell' },
  ];

  const eventCols: Column<VerificationEvent>[] = [
    {
      key: 'at',
      header: 'When',
      render: (r) => (
        <span className="font-mono text-[10px] text-slate-300">
          {formatDate(r.at, true)}
          <span className="block text-slate-600">{timeAgo(r.at)}</span>
        </span>
      ),
      sortValue: (r) => r.at,
      mobilePrimary: true,
    },
    { key: 'provider', header: 'Provider', render: (r) => <span className="font-medium text-slate-200">{r.provider}</span>, sortValue: (r) => r.provider },
    { key: 'endpoint', header: 'Endpoint', render: (r) => <span className="font-mono text-[10px] text-cyan-400/80 break-all">{r.endpoint}</span>, className: 'hidden sm:table-cell' },
    {
      key: 'fields',
      header: 'Fields',
      render: (r) => <span className="text-[10px] text-slate-400">{r.fieldsRequested.join(', ')}</span>,
      renderMobile: (r) => <span className="text-[10px] text-slate-500">{r.fieldsRequested.length} fields requested</span>,
      className: 'hidden xl:table-cell',
    },
    {
      key: 'code',
      header: 'HTTP',
      render: (r) => (
        <Badge tone={r.responseCode < 300 ? 'success' : r.responseCode < 500 ? 'warning' : 'danger'}>{r.responseCode}</Badge>
      ),
      align: 'center',
      sortValue: (r) => r.responseCode,
    },
    { key: 'latency', header: 'Latency', render: (r) => <span className="font-mono">{reportLatency(r.latencyMs)}</span>, align: 'right', className: 'hidden lg:table-cell', sortValue: (r) => r.latencyMs ?? -1 },
    { key: 'cost', header: 'Cost', render: (r) => <span className="font-mono">{KES(r.costKes)}</span>, align: 'right', sortValue: (r) => r.costKes },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (r) => (
        <span className="flex items-center gap-1.5">
          <StateIcon state={r.outcome} />
          <Badge tone={stateTone(r.outcome)}>{stateLabel(r.outcome)}</Badge>
        </span>
      ),
      sortValue: (r) => r.outcome,
    },
    { key: 'actor', header: 'Actor', render: (r) => <span className="text-[10px] text-slate-400">{r.actor}</span>, className: 'hidden xl:table-cell' },
    { key: 'consent', header: 'Consent ref', render: (r) => <span className="font-mono text-[9px] text-slate-500">{r.consentRef}</span>, className: 'hidden xl:table-cell' },
  ];

  const sectionCols: Column<DossierSection>[] = [
    { key: 'title', header: 'Data section', render: (r) => <span className="font-medium text-slate-200">{r.title}</span>, mobilePrimary: true, sortValue: (r) => r.title },
    { key: 'provider', header: 'Source', render: (r) => <span className="text-[11px] text-cyan-400/90">{r.provider}</span>, sortValue: (r) => r.provider },
    {
      key: 'state',
      header: 'State',
      render: (r) => (
        <span className="flex items-center gap-1.5">
          <StateIcon state={r.state} />
          <Badge tone={stateTone(r.state)}>{stateLabel(r.state)}</Badge>
        </span>
      ),
      sortValue: (r) => r.state,
    },
    {
      key: 'confidence',
      header: 'Confidence',
      render: (r) => (
        <span className="flex items-center gap-2 min-w-[110px]">
          {r.confidence === null || r.confidence === undefined ? <span className="text-[10px] text-slate-500">Unavailable</span> : <ProgressBar value={r.confidence} max={100} height={5} className="flex-1" />}
          <span className="text-[10px] font-mono text-slate-400 w-12 text-right">{reportConfidence(r.confidence)}</span>
        </span>
      ),
      sortValue: (r) => r.confidence ?? -1,
    },
    { key: 'fields', header: 'Fields', render: (r) => <span className="font-mono text-[11px]">{r.fields.length}</span>, align: 'right', sortValue: (r) => r.fields.length },
    { key: 'latency', header: 'Latency', render: (r) => <span className="font-mono text-[11px]">{reportLatency(r.latencyMs)}</span>, align: 'right', className: 'hidden lg:table-cell', sortValue: (r) => r.latencyMs ?? -1 },
    { key: 'cost', header: 'Cost', render: (r) => <span className="font-mono text-[11px]">{KES(r.costKes)}</span>, align: 'right', className: 'hidden sm:table-cell', sortValue: (r) => r.costKes },
    { key: 'retrieved', header: 'Retrieved', render: (r) => <span className="text-[10px] text-slate-500">{timeAgo(r.retrievedAt)}</span>, className: 'hidden xl:table-cell', sortValue: (r) => r.retrievedAt },
  ];

  /* ------------------------------ actions ------------------------------ */

  const doPrint = () => {
    pushToast({ title: 'Preparing print', description: 'Full extracted dataset renders in the print preview', type: 'info' });
    setTimeout(() => window.print(), 250);
  };

  const doDownload = () => {
    if (!can('report.export')) {
      pushToast({ title: 'Export not permitted', description: 'Your role does not include report.export', type: 'error' });
      return;
    }
    const doc = buildFullReportPdf(d, settings, { maskPii: masked });
    downloadBlob(doc.toBlob(), `IPRS_${d.subject.idNumber}_${d.reportId}.pdf`);
    pushToast({ title: 'PDF downloaded', description: `${d.reportId} — full dossier`, type: 'success' });
  };

  const totalCost = d.sections.reduce((a, s) => a + s.costKes, 0);
  const avgConfidence = averageReportConfidence(d);
  const confidenceAvailable = avgConfidence !== null;
  const verifiedCount = d.sections.filter((s) => s.state === 'verified').length;

  /* -------------------------------- render -------------------------------- */

  return (
    <div className="w-full text-xs text-slate-200">
      {d.dataMode === 'simulated' && (
        <Callout tone="warning" title="SIMULATED VERIFICATION">
          This result uses seeded demo data and does not represent a live registry response.
        </Callout>
      )}
      {/* ---------------- subject banner ---------------- */}
      <div className="relative overflow-hidden border-b border-sky-900/50 bg-gradient-to-br from-[#08172b] via-[#071120] to-[#071120]">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #22d3ee 1px, transparent 0)', backgroundSize: '22px 22px' }} />
        <div className="relative p-3 sm:p-5 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="relative shrink-0">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-800 ring-2 ring-cyan-500/40 flex items-center justify-center text-lg font-black text-white shadow-lg">
                  {d.subject.firstName[0]}
                  {d.subject.lastName[0]}
                </div>
                <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-[#071120] ${d.risk.band === 'Low' ? 'bg-emerald-500 text-emerald-950' : d.risk.band === 'Medium' ? 'bg-amber-500 text-amber-950' : d.risk.band === 'High' ? 'bg-rose-500 text-white' : 'bg-slate-600 text-white'}`}>
                  <ShieldCheck size={11} />
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base sm:text-xl font-black text-white tracking-tight truncate">{d.subject.fullName}</h1>
                  {d.subject.deceased && <Badge tone="danger">Deceased record</Badge>}
                  {d.subject.aliases.length > 0 && <Badge tone="neutral">{d.subject.aliases.length} alias{d.subject.aliases.length > 1 ? 'es' : ''}</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 font-mono text-cyan-300">
                    <Fingerprint size={11} /> ID {masked ? m(d.subject.idNumber) : d.subject.idNumber}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone size={11} /> {masked ? m(d.subject.phone) : d.subject.phone}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail size={11} /> {masked ? m(d.subject.email) : d.subject.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={11} /> {d.subject.county}
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <Calendar size={11} /> DOB {d.subject.dob}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                   <Badge tone={riskTone(d.risk.band)}>Risk {riskAvailable ? `${d.risk.score}/100` : 'unavailable'} · {riskAvailable ? d.risk.band : 'Unknown'}</Badge>
                   <Badge tone="info">Photo match {photoAvailable ? `${d.subject.photoMatchScore}%` : 'unavailable'}</Badge>
                  <Badge tone="neutral">{verifiedCount}/{d.sections.length} sections verified</Badge>
                   <Badge tone="neutral">Confidence {confidenceAvailable ? `${avgConfidence}%` : 'Unavailable'}</Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 lg:justify-end">
              <Button size="sm" variant="secondary" icon={masked ? <Eye size={13} /> : <EyeOff size={13} />} onClick={() => setMasked((v) => !v)}>
                {masked ? 'Unmask PII' : 'Mask PII'}
              </Button>
              <Button size="sm" variant="secondary" icon={<Printer size={13} />} onClick={doPrint}>
                Print
              </Button>
              <Button size="sm" variant="secondary" icon={<Download size={13} />} onClick={doDownload} disabled={!can('report.export')}>
                PDF
              </Button>
              <Button size="sm" variant="primary" icon={<FileText size={13} />} onClick={() => onViewDetailedReport?.() ?? navigate('/report')}>
                Full report
              </Button>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { label: 'Report ID', value: d.reportId, icon: <FileText size={12} />, mono: true },
              { label: 'Generated', value: formatDate(d.generatedAt, true), icon: <Calendar size={12} /> },
              { label: 'Data sections', value: String(d.sections.length), icon: <Network size={12} /> },
              { label: 'Verification events', value: String(d.events.length), icon: <ScrollText size={12} /> },
              { label: 'Query cost', value: KES(totalCost, { decimals: false }), icon: <Gauge size={12} />, mono: true },
              { label: 'Retention until', value: formatDate(d.attestation.retentionExpiry), icon: <ShieldCheck size={12} /> },
            ].map((k) => (
              <div key={k.label} className="rounded-lg bg-[#061020]/80 border border-sky-900/50 px-2.5 py-2 min-w-0">
                <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-500 font-bold truncate">
                  <span className="text-cyan-500/70">{k.icon}</span>
                  {k.label}
                </div>
                <div className={`text-[11px] font-semibold text-white mt-0.5 truncate ${k.mono ? 'font-mono' : ''}`} title={k.value}>
                  {k.value}
                </div>
              </div>
            ))}
          </div>

          {cached.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Recent subjects</span>
              {cached.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate('/identity-profile')}
                  className={`px-2 py-1 rounded-lg border text-[10px] transition-colors ${
                    c.id === d.id ? 'border-cyan-600/70 bg-cyan-950/40 text-cyan-200' : 'border-sky-900/60 bg-[#061020] text-slate-400 hover:text-white'
                  }`}
                  title={`${c.subject.fullName} · ${c.subject.idNumber}`}
                >
                  {c.subject.fullName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- tabs ---------------- */}
      <div className="px-2 sm:px-4 pt-3">
        <Tabs tabs={TABS} active={tab} onChange={setTab} badges={{ Logs: d.events.length, Connections: d.relationships.length + d.business.links.length }} />
      </div>

      <div className="p-2 sm:p-4 space-y-4">
        {/* ----------------------------- OVERVIEW ----------------------------- */}
        {tab === 'Overview' && (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Risk assessment" icon={<ShieldCheck size={14} className="text-cyan-400" />} className="lg:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="shrink-0 flex items-center gap-3">
                    <div className="relative w-20 h-20">
                      <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#0b1c33" strokeWidth="3.4" />
                        <circle
                          cx="18"
                          cy="18"
                          r="15.9"
                          fill="none"
                           stroke={d.risk.band === 'Low' ? '#34d399' : d.risk.band === 'Medium' ? '#fbbf24' : d.risk.band === 'High' ? '#fb7185' : '#475569'}
                          strokeWidth="3.4"
                          strokeLinecap="round"
                           strokeDasharray={`${riskAvailable ? d.risk.score : 0} 100`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                         <span className="text-lg font-black text-white">{riskAvailable ? d.risk.score : 'Unavailable'}</span>
                         <span className="text-[8px] uppercase tracking-wider text-slate-500">{riskAvailable ? 'of 100' : 'Risk unknown'}</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                       <Badge tone={riskTone(d.risk.band)}>{riskAvailable ? `${d.risk.band} risk` : 'Risk unknown'}</Badge>
                      <p className="text-[11px] text-slate-300 mt-1.5 leading-snug">{d.risk.verdict}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{d.risk.recommendation}</p>
                      {d.risk.reviewRequired && (
                        <p className="mt-1.5 text-[10px] text-amber-300 flex items-center gap-1">
                          <AlertTriangle size={11} /> Manual review required
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Score drivers</div>
                    {d.risk.drivers.map((dr) => (
                      <div key={dr.factor} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 w-32 sm:w-40 truncate shrink-0" title={dr.factor}>
                          {dr.factor}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-[#0b1c33] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${dr.direction === 'positive' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(100, Math.abs(dr.contribution) * 6)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-mono w-12 text-right shrink-0 ${dr.direction === 'positive' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {dr.direction === 'positive' ? '−' : '+'}
                          {Math.abs(dr.contribution)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel title="Screening outcome" icon={<AlertTriangle size={14} className="text-amber-400" />}>
                <div className="space-y-2">
                  {[
                    { label: 'Politically exposed', hit: screeningAvailable ? d.screening.pep : null, detail: screeningAvailable ? d.screening.pepDetail : 'Unavailable' },
                    { label: 'Sanctions / watchlist', hit: screeningAvailable ? d.screening.sanctions : null, detail: screeningAvailable ? d.screening.sanctionsDetail : 'Unavailable' },
                    { label: 'Insolvency', hit: screeningAvailable ? d.screening.insolvency : null, detail: !screeningAvailable ? 'Unavailable' : d.screening.insolvency == null ? 'Unknown' : d.screening.insolvency ? 'Active insolvency proceedings' : 'No filings reported' },
                    { label: 'Adverse media', hit: screeningAvailable && d.screening.adverseMedia !== null ? d.screening.adverseMedia > 0 : null, detail: reportCount(d.screening.adverseMedia, screeningAvailable) === 'Unavailable' ? 'Unavailable' : `${reportCount(d.screening.adverseMedia, screeningAvailable)} item(s) found` },
                    { label: 'Criminal records', hit: screeningAvailable ? d.screening.criminalRecords.length > 0 : null, detail: screeningAvailable ? `${d.screening.criminalRecords.length} record(s)` : 'Unavailable' },
                    { label: 'Civil litigation', hit: screeningAvailable && d.screening.civilLitigation !== null ? d.screening.civilLitigation > 0 : null, detail: reportCount(d.screening.civilLitigation, screeningAvailable) === 'Unavailable' ? 'Unavailable' : `${reportCount(d.screening.civilLitigation, screeningAvailable)} case(s)` },
                  ].map((row) => (
                    <div key={row.label} className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${row.hit === true ? 'border-amber-800/50 bg-amber-950/25' : row.hit === false ? 'border-emerald-900/50 bg-emerald-950/20' : 'border-sky-900/50 bg-[#061020]'}`}>
                      {row.hit === null ? <MinusCircle size={12} className="text-slate-500 mt-0.5 shrink-0" /> : row.hit ? <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" /> : <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />}
                      <div className="min-w-0">
                        <div className={`text-[11px] font-semibold ${row.hit === null ? 'text-slate-400' : row.hit ? 'text-amber-200' : 'text-slate-300'}`}>{row.label}</div>
                        <div className="text-[10px] text-slate-500 truncate">{row.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <Panel title="Data sections retrieved" subtitle="Every source queried, its state, confidence, latency and cost" icon={<Network size={14} className="text-cyan-400" />}>
              <ResponsiveTable columns={sectionCols} rows={d.sections} rowKey={(r) => r.id} dense initialSort={{ key: 'confidence', dir: 'desc' }} />
            </Panel>
          </>
        )}

        {/* ----------------------------- PERSONAL ----------------------------- */}
        {tab === 'Personal' && (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Civil registration" subtitle={sectionBy('sec-civil')[0]?.provider ?? 'IPRS Civil Registration'} icon={<UserCheck size={14} className="text-cyan-400" />}>
                <FactGrid
                  items={[
                    { label: 'Full legal name', value: d.subject.fullName },
                    { label: 'First name', value: d.subject.firstName },
                    { label: 'Middle name', value: d.subject.middleName ?? '—' },
                    { label: 'Last name / surname', value: d.subject.lastName },
                    { label: 'Aliases / other names', value: d.subject.aliases.length ? d.subject.aliases.join(' · ') : 'None recorded', span: true },
                    { label: 'Gender', value: d.subject.gender },
                    { label: 'Date of birth', value: `${d.subject.dob} (${d.subject.dobRaw})` },
                    { label: 'Nationality', value: d.subject.nationality },
                    { label: 'ID number', value: masked ? m(d.subject.idNumber) : d.subject.idNumber, mono: true },
                    { label: 'ID type', value: d.subject.idType },
                    { label: 'Passport number', value: d.subject.passportNumber ? (masked ? m(d.subject.passportNumber) : d.subject.passportNumber) : '—', mono: true },
                    { label: 'KRA PIN', value: masked ? m(d.subject.kraPin) : d.subject.kraPin, mono: true },
                    { label: 'Registration serial', value: d.subject.registrationSerial ?? '—', mono: true },
                    { label: 'Marital status', value: d.subject.maritalStatus },
                    { label: 'Next of kin', value: masked ? m(d.subject.nextOfKin) : d.subject.nextOfKin },
                    { label: 'Deceased flag', value: d.subject.deceased == null ? 'Unknown' : d.subject.deceased ? 'YES' : 'No' },
                    { label: 'Biometric photo match', value: reportPercent(d.subject.photoMatchScore) },
                  ]}
                />
              </Panel>

              <Panel title="Contact & location" subtitle="Primary and alternate contacts with administrative geography" icon={<MapPin size={14} className="text-cyan-400" />}>
                <FactGrid
                  items={[
                    { label: 'Primary phone', value: masked ? m(d.subject.phone) : d.subject.phone, mono: true },
                    { label: 'Alternate phones', value: d.subject.altPhones.length ? d.subject.altPhones.map((p) => (masked ? m(p) : p)).join(' · ') : 'None', mono: true },
                    { label: 'Email', value: masked ? m(d.subject.email) : d.subject.email, span: true },
                    { label: 'County', value: d.subject.county },
                    { label: 'Sub-county', value: d.subject.subCounty },
                    { label: 'Constituency', value: d.subject.constituency },
                    { label: 'Ward', value: d.subject.ward },
                  ]}
                />
                <div className="mt-4">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Extracted civil fields (raw)</div>
                  <div className="rounded-lg border border-sky-900/50 bg-[#050b14] divide-y divide-sky-950/70 max-h-64 overflow-y-auto">
                    {sectionFields('sec-civil').length === 0 ? (
                      <p className="p-3 text-[10px] text-slate-600">No raw field list for this source.</p>
                    ) : (
                      sectionFields('sec-civil').map((f, i) => (
                        <div key={`${f.label}-${i}`} className="flex items-start justify-between gap-3 px-2.5 py-1.5">
                          <span className="text-[10px] text-slate-500 shrink-0">{f.label}</span>
                          <span className="text-[10px] text-slate-200 font-mono text-right break-all min-w-0">
                            {masked && typeof f.value === 'string' && f.masked !== false ? m(f.value) : String(f.value ?? '—')}
                            {f.confidence != null && <span className="ml-1.5 text-emerald-500/70">({f.confidence}%)</span>}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Panel>
            </div>

            <Panel title="Address history" subtitle={`${d.addresses.length} record(s) across postal, physical and utility-confirmed sources`} icon={<MapPin size={14} className="text-cyan-400" />}>
              <ResponsiveTable columns={addressCols} rows={d.addresses} rowKey={(r) => r.id} dense emptyTitle="No address records" />
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Identity documents" icon={<FileText size={14} className="text-cyan-400" />}>
                <ResponsiveTable columns={docCols} rows={d.documents} rowKey={(r) => r.id} dense emptyTitle="No documents on file" />
              </Panel>
              <Panel title="Employment history" icon={<Briefcase size={14} className="text-cyan-400" />}>
                 <ResponsiveTable columns={empCols} rows={d.employment} rowKey={(r) => r.id} dense emptyTitle={employerAvailable ? 'No employment records returned' : 'Employment data unavailable'} />
              </Panel>
            </div>
          </>
        )}

        {/* ----------------------------- FINANCIAL ----------------------------- */}
        {tab === 'Financial' && (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Tax standing — KRA" icon={<Landmark size={14} className="text-emerald-400" />} className="lg:col-span-2">
                <FactGrid
                  items={[
                     { label: 'PIN', value: taxAvailable && d.tax.pin ? (masked ? m(d.tax.pin) : d.tax.pin) : 'Unavailable', mono: true },
                     { label: 'Status', value: <Badge tone={d.tax.goodStanding === true ? 'success' : d.tax.goodStanding === false ? 'danger' : 'neutral'}>{reportStatus(d.tax.status, taxAvailable)}</Badge> },
                     { label: 'Registered on', value: reportDate(d.tax.registeredOn, taxAvailable) },
                     { label: 'Obligation types', value: taxAvailable && d.tax.obligationTypes.length ? d.tax.obligationTypes.join(', ') : 'Unavailable', span: true },
                     { label: 'Last return filed', value: reportDate(d.tax.lastReturnFiled, taxAvailable) },
                     { label: 'Outstanding liability', value: <span className={!taxAvailable || d.tax.outstandingKes === null ? 'text-slate-400 font-mono' : d.tax.outstandingKes > 0 ? 'text-rose-300 font-mono' : 'text-emerald-300 font-mono'}>{reportAmount(d.tax.outstandingKes, taxAvailable)}</span> },
                     { label: 'Good standing', value: reportBoolean(d.tax.goodStanding, taxAvailable) },
                  ]}
                />
                <div className="mt-4">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Compliance years</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {d.tax.complianceYears.map((y) => (
                      <div key={y.year} className={`rounded-lg border px-2.5 py-2 ${y.returnsFiled && y.paid ? 'border-emerald-900/60 bg-emerald-950/25' : 'border-rose-900/50 bg-rose-950/20'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-white">{y.year}</span>
                          {y.returnsFiled && y.paid ? <CheckCircle2 size={12} className="text-emerald-400" /> : <AlertTriangle size={12} className="text-rose-400" />}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5">
                          Return {y.returnsFiled ? 'filed' : 'missing'} · {y.paid ? 'paid' : 'unpaid'}
                        </div>
                        {y.outstandingKes > 0 && <div className="text-[10px] font-mono text-rose-300 mt-0.5">{KES(y.outstandingKes, { decimals: false })}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel title="Mobile money — M-PESA" icon={<Zap size={14} className="text-emerald-400" />}>
                <FactGrid
                  columns={2}
                  items={[
                     { label: 'Registered name', value: mpesaAvailable && d.mobileMoney.accountName ? (masked ? m(d.mobileMoney.accountName) : d.mobileMoney.accountName) : 'Unavailable' },
                     { label: 'MSISDN', value: mpesaAvailable && d.mobileMoney.msisdn ? (masked ? m(d.mobileMoney.msisdn) : d.mobileMoney.msisdn) : 'Unavailable', mono: true },
                     { label: 'Status', value: <Badge tone={d.mobileMoney.status === 'Active' && mpesaAvailable ? 'success' : 'neutral'}>{reportStatus(d.mobileMoney.status, mpesaAvailable)}</Badge> },
                     { label: 'Active since', value: reportDate(d.mobileMoney.activeSince, mpesaAvailable) },
                     { label: 'KYC tier', value: mpesaAvailable ? d.mobileMoney.kycTier : 'Unavailable' },
                     { label: 'Activity band', value: reportStatus(d.mobileMoney.activityBand, mpesaAvailable) },
                     { label: 'Daily limit', value: reportAmount(d.mobileMoney.dailyLimitKes, mpesaAvailable), mono: true },
                     { label: 'Txn limit', value: reportAmount(d.mobileMoney.transactionLimitKes, mpesaAvailable), mono: true },
                     { label: 'Avg monthly turnover', value: reportAmount(d.mobileMoney.avgMonthlyTurnoverKes, mpesaAvailable), mono: true },
                     { label: 'SIM swap events', value: <span className={mpesaAvailable && d.mobileMoney.simSwapEvents !== null && d.mobileMoney.simSwapEvents > 0 ? 'text-amber-300 font-mono' : 'font-mono'}>{reportCount(d.mobileMoney.simSwapEvents, mpesaAvailable)}</span> },
                     { label: 'Last active', value: reportDate(d.mobileMoney.lastActive, mpesaAvailable) },
                  ]}
                />
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Credit bureau" subtitle={`${d.credit.bureau} — score, exposure and utilisation`} icon={<Gauge size={14} className="text-cyan-400" />} className="lg:col-span-2">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                     { label: 'Credit score', value: reportScore(d.credit.score, creditAvailable, 900), sub: reportStatus(d.credit.scoreBand, creditAvailable) },
                     { label: 'Listing status', value: reportStatus(d.credit.listingStatus, creditAvailable), sub: `${reportCount(d.credit.totalFacilities, creditAvailable)} facilities` },
                     { label: 'Total outstanding', value: reportAmount(d.credit.totalOutstandingKes, creditAvailable), sub: `limit ${reportAmount(d.credit.totalLimitKes, creditAvailable)}` },
                     { label: 'Utilisation', value: reportPercent(d.credit.utilisationPct, creditAvailable), sub: `${reportCount(d.credit.enquiries12m, creditAvailable)} enquiries / 12m` },
                  ].map((k) => (
                    <div key={k.label} className="rounded-lg bg-[#061020] border border-sky-900/50 px-3 py-2.5">
                      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{k.label}</div>
                      <div className="text-sm font-black text-white mt-0.5 font-mono">{k.value}</div>
                      <div className="text-[10px] text-slate-500 truncate">{k.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                   <ProgressBar value={creditAvailable && d.credit.utilisationPct !== null ? d.credit.utilisationPct : 0} max={100} label="Portfolio utilisation" right={reportPercent(d.credit.utilisationPct, creditAvailable)} warning={70} danger={90} />
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] text-slate-400">
                     <div>Oldest facility: <span className="text-slate-200 font-mono">{reportDate(d.credit.oldestFacility, creditAvailable)}</span></div>
                     <div>Days since last enquiry: <span className="text-slate-200 font-mono">{reportCount(d.credit.daysSinceLastEnquiry, creditAvailable)}</span></div>
                     <div>Enquiries (12m): <span className="text-slate-200 font-mono">{reportCount(d.credit.enquiries12m, creditAvailable)}</span></div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2">Credit facilities ({d.credit.facilities.length})</div>
                   <ResponsiveTable columns={facilityCols} rows={d.credit.facilities} rowKey={(r) => r.id} dense initialSort={{ key: 'outstanding', dir: 'desc' }} emptyTitle={creditAvailable ? 'No facilities returned' : 'Credit data unavailable'} />
                </div>

                {d.credit.adverseListings.length > 0 && (
                  <Callout tone="danger" title={`Adverse listings (${d.credit.adverseListings.length})`} className="mt-3">
                    <ul className="space-y-1">
                      {d.credit.adverseListings.map((a) => (
                        <li key={a.id} className="text-[11px] text-slate-300">
                          <span className="font-semibold">{a.institution}</span> — {a.type} · {KES(a.amountKes, { decimals: false })} · listed {formatDate(a.listedOn)}
                        </li>
                      ))}
                    </ul>
                  </Callout>
                )}
              </Panel>

              <Panel title="Utility account" icon={<Zap size={14} className="text-amber-400" />}>
                <FactGrid
                  columns={2}
                  items={[
                     { label: 'Provider', value: utilityAvailable ? d.utility.provider : 'Unavailable' },
                     { label: 'Meter number', value: utilityAvailable && d.utility.meterNumber ? (masked ? m(d.utility.meterNumber) : d.utility.meterNumber) : 'Unavailable', mono: true },
                     { label: 'Account status', value: <Badge tone={d.utility.accountStatus === 'Active' && utilityAvailable ? 'success' : 'neutral'}>{reportStatus(d.utility.accountStatus, utilityAvailable)}</Badge> },
                     { label: 'Connected since', value: reportDate(d.utility.connectedSince, utilityAvailable) },
                     { label: 'Avg monthly bill', value: reportAmount(d.utility.avgMonthlyBillKes, utilityAvailable), mono: true },
                     { label: 'Arrears', value: <span className={!utilityAvailable || d.utility.arrearsKes === null ? 'text-slate-400 font-mono' : d.utility.arrearsKes > 0 ? 'text-rose-300 font-mono' : 'text-emerald-300 font-mono'}>{reportAmount(d.utility.arrearsKes, utilityAvailable)}</span> },
                     { label: 'Payment behaviour', value: reportStatus(d.utility.paymentBehaviour, utilityAvailable) },
                     { label: 'Last payment', value: reportDate(d.utility.lastPayment, utilityAvailable) },
                  ]}
                />
                <div className="mt-3 text-[10px] text-slate-500 leading-relaxed">
                  Utility confirmation is used as secondary address evidence. A settled arrears balance and a long connection
                  history raise the address confidence score.
                </div>
              </Panel>
            </div>
          </>
        )}

        {/* ----------------------------- CONNECTIONS ----------------------------- */}
        {tab === 'Connections' && (
          <>
            <div className="grid gap-4 lg:grid-cols-5">
              {/* Relationship graph */}
              <Panel
                title="Relationship graph"
                subtitle={`${d.relationships.length} link(s) — subject at the centre, coloured by link type`}
                icon={<Network size={14} className="text-cyan-400" />}
                className="lg:col-span-2"
              >
                {d.relationships.length === 0 ? (
                  <EmptyState title="No relationships detected" description="No family, business or financial links were returned." />
                ) : (
                  <RelationshipGraph links={d.relationships} subject={d.subject.fullName} />
                )}
              </Panel>

              <Panel title="Relationship detail" icon={<Network size={14} className="text-cyan-400" />} className="lg:col-span-3">
                <ResponsiveTable columns={linkCols} rows={d.relationships} rowKey={(r) => r.id} dense emptyTitle="No relationship links" />
              </Panel>
            </div>

            <Panel
              title="Business & beneficial ownership"
               subtitle={`${d.business.links.length} company link(s) · director: ${reportBoolean(d.business.isDirector, businessAvailable)} · beneficial owner: ${reportBoolean(d.business.isBeneficialOwner, businessAvailable)} · sole proprietorships: ${reportCount(d.business.soleProprietorships, businessAvailable)}`}
              icon={<Building2 size={14} className="text-cyan-400" />}
            >
               <ResponsiveTable columns={bizCols} rows={d.business.links} rowKey={(r) => r.id} dense emptyTitle={businessAvailable ? 'No business links returned' : 'Business data unavailable'} />
            </Panel>

            {(d.screening.criminalRecords.length > 0 || (d.screening.civilLitigation !== null && d.screening.civilLitigation > 0) || d.screening.pep || d.screening.sanctions) && (
              <Callout tone="warning" title="Screening hits requiring attention">
                <div className="grid gap-2 sm:grid-cols-2">
                  {d.screening.criminalRecords.map((c) => (
                    <div key={c.id} className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-2.5 py-2 text-[11px]">
                      <div className="font-semibold text-amber-200">{c.charge}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {c.caseNo} · {c.court} · filed {formatDate(c.filedOn)}
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5">Outcome: {c.outcome}</div>
                    </div>
                  ))}
                  {d.screening.pep && (
                    <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-2.5 py-2 text-[11px]">
                      <div className="font-semibold text-amber-200">Politically exposed person</div>
                      <div className="text-[10px] text-slate-400">{d.screening.pepDetail}</div>
                    </div>
                  )}
                  {d.screening.sanctions && (
                    <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-2.5 py-2 text-[11px]">
                      <div className="font-semibold text-rose-200">Sanctions / watchlist match</div>
                      <div className="text-[10px] text-slate-400">{d.screening.sanctionsDetail}</div>
                    </div>
                  )}
                </div>
              </Callout>
            )}
          </>
        )}

        {/* ----------------------------- LOGS ----------------------------- */}
        {tab === 'Logs' && (
          <>
            <Panel
              title="Verification event log"
              subtitle={`${d.events.length} gateway call(s) recorded against this dossier · total cost ${KES(d.events.reduce((a, e) => a + e.costKes, 0))}`}
              icon={<ScrollText size={14} className="text-cyan-400" />}
              actions={
                <Button size="xs" variant="ghost" icon={<Download size={12} />} onClick={() => {
                  const rows = d.events.map((e) => ({
                    at: e.at,
                    provider: e.provider,
                    endpoint: e.endpoint,
                    fields: e.fieldsRequested.join('|'),
                    http: e.responseCode,
                    latencyMs: e.latencyMs ?? 'Not provided',
                    costKes: e.costKes,
                    consentRef: e.consentRef,
                    outcome: e.outcome,
                    actor: e.actor,
                    ip: e.ip,
                  }));
                  const csv = ['at,provider,endpoint,fields,http,latencyMs,costKes,consentRef,outcome,actor,ip', ...rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
                  downloadBlob(new Blob([csv], { type: 'text/csv' }), `${d.reportId}_events.csv`);
                  pushToast({ title: 'Event log exported', description: 'CSV downloaded', type: 'success' });
                }}>
                  CSV
                </Button>
              }
            >
              <ResponsiveTable columns={eventCols} rows={d.events} rowKey={(r) => r.id} dense initialSort={{ key: 'at', dir: 'desc' }} emptyTitle="No events recorded" />
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Attestation" icon={<ShieldCheck size={14} className="text-cyan-400" />}>
                <FactGrid
                  columns={2}
                  items={[
                    { label: 'Prepared by', value: `${d.attestation.preparedBy} (${d.attestation.preparedByTier})` },
                    { label: 'Classification', value: d.attestation.classification },
                    { label: 'Retention expiry', value: formatDate(d.attestation.retentionExpiry) },
                    { label: 'Framework', value: settings.compliance.framework },
                    { label: 'Sources', value: d.attestation.sources.join(', '), span: true },
                  ]}
                />
                <p className="mt-3 text-[10px] text-slate-500 leading-relaxed">{d.attestation.disclaimer}</p>
              </Panel>

              <Panel title="Raw gateway responses" subtitle="Masked payloads as returned by each source" icon={<ScrollText size={14} className="text-cyan-400" />}>
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {d.sections.filter((s) => s.rawResponse).map((s) => (
                    <details key={s.id} className="rounded-lg border border-sky-900/50 bg-[#050b14] overflow-hidden">
                      <summary className="cursor-pointer px-2.5 py-2 flex items-center gap-2 hover:bg-sky-950/40">
                        <ChevronRight size={12} className="text-slate-600" />
                        <span className="text-[11px] font-semibold text-slate-200 flex-1 truncate">{s.title}</span>
                        <Badge tone={stateTone(s.state)}>{stateLabel(s.state)}</Badge>
                      </summary>
                      <pre className="px-2.5 pb-2.5 text-[10px] font-mono text-emerald-300/80 overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(
                          Object.fromEntries(
                            Object.entries(s.rawResponse ?? {}).map(([k, v]) => [k, masked && typeof v === 'string' && v.length > 4 ? m(v) : v])
                          ),
                          null,
                          2
                        )}
                      </pre>
                    </details>
                  ))}
                  {d.sections.filter((s) => s.rawResponse).length === 0 && <EmptyState title="No raw payloads stored" />}
                </div>
              </Panel>
            </div>

            {d.sections.some((s) => s.flags?.length) && (
              <Panel title="Section flags" icon={<AlertTriangle size={14} className="text-amber-400" />}>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {d.sections.flatMap((s) => (s.flags ?? []).map((f, i) => ({ ...f, section: s.title, key: `${s.id}-${i}` }))).map((f) => (
                    <div
                      key={f.key}
                      className={`rounded-lg border px-2.5 py-2 ${
                        f.level === 'danger' ? 'border-rose-900/50 bg-rose-950/20' : f.level === 'warning' ? 'border-amber-900/50 bg-amber-950/20' : 'border-sky-900/50 bg-[#061020]'
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{f.section}</div>
                      <div className="text-[11px] text-slate-200 mt-0.5">{f.text}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </>
        )}

        <p className="text-[10px] text-slate-600 text-center pb-2">
          Signed in as {currentUser?.name ?? '—'} · PII masking {masked ? 'ON' : 'OFF'} · Data classification{' '}
          {d.attestation.classification}
        </p>
      </div>
    </div>
  );
};

/** Simple radial relationship graph rendered as SVG — no chart dependency. */
const RelationshipGraph: React.FC<{ links: RelationshipLink[]; subject: string }> = ({ links, subject }) => {
  const COLOR: Record<RelationshipLink['linkType'], string> = {
    Family: '#f472b6',
    Business: '#22d3ee',
    Financial: '#fbbf24',
    Address: '#34d399',
    Phone: '#a78bfa',
    Employment: '#60a5fa',
  };
  const R = 118;
  const size = 300;
  const c = size / 2;
  const nodes = links.map((l, i) => {
    const angle = (i / Math.max(1, links.length)) * Math.PI * 2 - Math.PI / 2;
    return { ...l, x: c + Math.cos(angle) * R, y: c + Math.sin(angle) * R };
  });

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[340px] mx-auto" role="img" aria-label={`Relationship graph for ${subject}`}>
        {nodes.map((n) => (
          <g key={`e-${n.id}`}>
            <line
              x1={c}
              y1={c}
              x2={n.x}
              y2={n.y}
              stroke={COLOR[n.linkType]}
              strokeWidth={n.strength === 'Strong' ? 2.2 : n.strength === 'Moderate' ? 1.4 : 0.8}
              strokeOpacity={0.55}
              strokeDasharray={n.strength === 'Weak' ? '3 3' : undefined}
            />
          </g>
        ))}
        <circle cx={c} cy={c} r="26" fill="#0b2438" stroke="#22d3ee" strokeWidth="1.5" />
        <text x={c} y={c - 2} textAnchor="middle" fill="#e2e8f0" fontSize="8" fontWeight="700">
          {subject.split(' ')[0]}
        </text>
        <text x={c} y={c + 8} textAnchor="middle" fill="#67e8f9" fontSize="7">
          SUBJECT
        </text>
        {nodes.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r="15" fill="#071120" stroke={COLOR[n.linkType]} strokeWidth="1.2" />
            <text x={n.x} y={n.y + 2.5} textAnchor="middle" fill="#cbd5e1" fontSize="6.5" fontWeight="600">
              {n.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
            </text>
            <text x={n.x} y={n.y + 25} textAnchor="middle" fill="#64748b" fontSize="5.5">
              {n.relation.length > 16 ? `${n.relation.slice(0, 15)}…` : n.relation}
            </text>
            {(n.pep || n.sanctioned) && <circle cx={n.x + 11} cy={n.y - 11} r="3" fill={n.sanctioned ? '#fb7185' : '#fbbf24'} />}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
        {Object.entries(COLOR).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1 text-[9px] text-slate-500">
            <span className="w-2 h-2 rounded-full" style={{ background: v }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Screen4_IdentityProfile;
