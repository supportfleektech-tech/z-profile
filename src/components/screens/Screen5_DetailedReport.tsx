import React, { useMemo, useState } from 'react';
import {
  FileBarChart2, Printer, Download, Eye, EyeOff, ShieldCheck, AlertTriangle, CheckCircle2, ScrollText,
  Network, Landmark, Zap, Briefcase, Building2, UserCheck, Gauge, Layers, FileText, Table2,
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { Badge, Button, Callout, EmptyState, Panel, ProgressBar, ResponsiveTable, SegmentedControl } from '../ui';
import { buildFullReportPdf, buildSummaryPdf } from '../../lib/reports';
import { downloadBlob, downloadText, formatDate, KES, maskPii, toCsv } from '../../lib/format';
import { averageReportConfidence, hasReportSection, reportAmount, reportBoolean, reportConfidence, reportCount, reportLatency, reportPercent, reportScore, reportStatus, riskScoreAvailable } from '../../lib/report-values';
import type { DossierSection, ExtractedField, VerificationState } from '../../types';

type View = 'Summary' | 'Full Report';

const tone = (s: VerificationState): 'success' | 'warning' | 'danger' | 'info' | 'neutral' =>
  s === 'verified' ? 'success' : s === 'partial' ? 'warning' : s === 'not_found' ? 'neutral' : s === 'mismatch' ? 'danger' : 'info';
const label = (s: VerificationState): string =>
  s === 'verified' ? 'Verified' : s === 'partial' ? 'Partial' : s === 'not_found' ? 'Not found' : s === 'mismatch' ? 'Mismatch' : 'Insufficient';

const SECTION_ICON: Record<string, React.ReactNode> = {
  'sec-civil': <UserCheck size={13} className="text-cyan-400" />,
  'sec-kra': <Landmark size={13} className="text-emerald-400" />,
  'sec-mpesa': <Zap size={13} className="text-emerald-400" />,
  'sec-crb': <Gauge size={13} className="text-cyan-400" />,
  'sec-employer': <Briefcase size={13} className="text-blue-400" />,
  'sec-utility': <Zap size={13} className="text-amber-400" />,
  'sec-business': <Building2 size={13} className="text-violet-400" />,
  'sec-connections': <Network size={13} className="text-pink-400" />,
  'sec-screening': <ShieldCheck size={13} className="text-amber-400" />,
  'sec-criminal': <AlertTriangle size={13} className="text-rose-400" />,
  'sec-financial': <Landmark size={13} className="text-emerald-400" />,
  'sec-risk': <Gauge size={13} className="text-cyan-400" />,
};

/** One extracted field rendered with its provenance. */
const FieldRow: React.FC<{ f: ExtractedField; masked: boolean; mask: (v: string) => string }> = ({ f, masked, mask }) => {
  const raw = f.value === null || f.value === undefined || f.value === '' ? '—' : String(f.value);
  const shown = masked && typeof f.value === 'string' && f.masked !== false ? mask(raw) : raw;
  return (
    <tr className="border-b border-sky-950/60 last:border-0 align-top">
      <td className="py-1.5 pr-2 text-[10px] text-slate-500 w-[38%] sm:w-[30%]">{f.label}</td>
      <td className="py-1.5 pr-2 text-[11px] text-slate-100 font-mono break-all">{shown}</td>
      <td className="py-1.5 pr-2 text-[10px] text-slate-500 hidden sm:table-cell">{f.source ?? '—'}</td>
      <td className="py-1.5 pr-2 hidden lg:table-cell">
        {f.confidence != null ? (
          <span className="flex items-center gap-1.5 min-w-[86px]">
            <ProgressBar value={f.confidence} max={100} height={4} className="flex-1" />
            <span className="text-[9px] font-mono text-slate-400 w-7 text-right">{f.confidence}%</span>
          </span>
        ) : (
          <span className="text-[10px] text-slate-600">—</span>
        )}
      </td>
      <td className="py-1.5 text-[9px] text-slate-600 hidden xl:table-cell font-mono">{f.matchRule ?? '—'}</td>
    </tr>
  );
};

/**
 * Detailed Report.
 *
 * The two views are deliberately different: **Summary** is a one-page executive brief,
 * **Full Report** renders every field extracted from every gateway, with provenance,
 * confidence, match rule and the masked raw payload. Print and PDF both emit the FULL
 * dataset regardless of which view is on screen.
 */
export const Screen5_DetailedReport: React.FC = () => {
  const { activeDossier: d, settings, can, pushToast, currentUser } = useAppData();
  const taxAvailable = hasReportSection(d, ['kra']);
  const mpesaAvailable = hasReportSection(d, ['mpesa']);
  const creditAvailable = hasReportSection(d, ['crb', 'credit']);
  const employerAvailable = hasReportSection(d, ['employer']);
  const utilityAvailable = hasReportSection(d, ['kplc', 'utility']);
  const screeningAvailable = hasReportSection(d, ['screening', 'pep', 'sanction', 'criminal']);
  const riskAvailable = riskScoreAvailable(d);
  const [view, setView] = useState<View>('Summary');
  const [masked, setMasked] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const mask = (v: string) => maskPii(v, masked ? 'partial' : 'none');

  const totalCost = d.sections.reduce((a, s) => a + s.costKes, 0);
  const totalFields = d.sections.reduce((a, s) => a + s.fields.length, 0);
  const avgConfidence = averageReportConfidence(d);
  const verifiedCount = d.sections.filter((s) => s.state === 'verified').length;

  const keyFindings = useMemo(() => {
    const out: { level: 'danger' | 'warning' | 'success'; text: string }[] = [];
    if (d.subject.deceased) out.push({ level: 'danger', text: 'Registry marks this identity as deceased.' });
    if (d.screening.pep) out.push({ level: 'warning', text: `Politically exposed person — ${d.screening.pepDetail}` });
    if (d.screening.sanctions) out.push({ level: 'danger', text: `Sanctions / watchlist match — ${d.screening.sanctionsDetail}` });
    d.screening.criminalRecords.forEach((c) => out.push({ level: 'warning', text: `Criminal record ${c.caseNo} (${c.court}) — ${c.charge}; outcome: ${c.outcome}` }));
    d.credit.adverseListings.forEach((a) => out.push({ level: 'danger', text: `Adverse listing: ${a.institution} — ${a.type}, ${KES(a.amountKes, { decimals: false })}` }));
    if (d.tax.outstandingKes !== null && d.tax.outstandingKes > 0) out.push({ level: 'warning', text: `Outstanding KRA liability of ${KES(d.tax.outstandingKes, { decimals: false })}.` });
    if (d.tax.goodStanding === false) out.push({ level: 'warning', text: 'KRA tax compliance certificate is not in good standing.' });
    if (d.utility.arrearsKes !== null && d.utility.arrearsKes > 0) out.push({ level: 'warning', text: `Utility arrears of ${KES(d.utility.arrearsKes, { decimals: false })} at ${d.utility.provider}.` });
    if (d.credit.utilisationPct !== null && d.credit.utilisationPct > 80) out.push({ level: 'warning', text: `Credit utilisation is high at ${d.credit.utilisationPct}%.` });
    if (d.mobileMoney.simSwapEvents !== null && d.mobileMoney.simSwapEvents > 0) out.push({ level: 'warning', text: `${d.mobileMoney.simSwapEvents} SIM swap event(s) on the M-PESA line.` });
    d.documents.filter((x) => x.status === 'Expired').forEach((x) => out.push({ level: 'warning', text: `${x.type} expired on ${x.expiresOn ?? 'unknown date'}.` }));
    if (out.length === 0) {
      if (!screeningAvailable) out.push({ level: 'warning', text: 'Screening data unavailable.' });
      else if (d.screening.pep === null && d.screening.sanctions === null) out.push({ level: 'warning', text: 'Screening provider did not return conclusive PEP or sanctions values.' });
      else out.push({ level: 'success', text: 'No adverse findings were reported by the queried providers.' });
    }
    return out;
  }, [d]);

  const toggleSection = (id: string) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  const expandAll = () => setOpenSections(Object.fromEntries(d.sections.map((s) => [s.id, true])));
  const collapseAll = () => setOpenSections({});

  const doPrint = () => {
    pushToast({ title: 'Sending full report to print', description: `${d.sections.length} sections · ${totalFields} fields · ${d.events.length} events`, type: 'info' });
    setTimeout(() => window.print(), 220);
  };

  const doDownload = async (kind: 'full' | 'summary') => {
    if (!can('report.export')) {
      pushToast({ title: 'Export blocked', description: 'Your role does not include report.export', type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const doc = kind === 'full' ? buildFullReportPdf(d, settings, { maskPii: masked }) : buildSummaryPdf(d, settings);
      const blob = doc.toBlob();
      const name = kind === 'full' ? `IPRS_${d.subject.idNumber}_FULL_${d.reportId}.pdf` : `IPRS_${d.subject.idNumber}_SUMMARY_${d.reportId}.pdf`;
      downloadBlob(blob, name);
      pushToast({
        title: 'PDF downloaded',
        description: `${name} · ${(blob.size / 1024).toFixed(1)} KB`,
        type: 'success',
      });
    } catch (err) {
      pushToast({ title: 'PDF generation failed', description: String(err), type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const doExportFields = () => {
    const rows = d.sections.flatMap((s) =>
      s.fields.map((f) => ({
        reportId: d.reportId,
        section: s.title,
        provider: s.provider,
        field: f.label,
        value: masked && typeof f.value === 'string' && f.masked !== false ? mask(f.value) : String(f.value ?? ''),
        source: f.source ?? '',
        confidence: f.confidence ?? '',
        matchRule: f.matchRule ?? '',
        retrievedAt: f.retrievedAt ?? s.retrievedAt,
      }))
    );
    downloadText(toCsv(rows), `${d.reportId}_fields.csv`, 'text/csv;charset=utf-8');
    pushToast({ title: 'Field export ready', description: `${rows.length} fields written to CSV`, type: 'success' });
  };


  return (
    <div className="w-full text-xs text-slate-200">
      {d.dataMode === 'simulated' && (
        <Callout tone="warning" title="SIMULATED VERIFICATION">
          This report uses seeded demo data and does not represent a live registry response.
        </Callout>
      )}
      {/* -------- toolbar -------- */}
      <div className="sticky top-0 z-20 bg-[#071120]/97 backdrop-blur border-b border-sky-900/50 px-2 sm:px-4 py-2.5 flex flex-col lg:flex-row lg:items-center gap-2.5 no-print">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileBarChart2 size={16} className="text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white truncate">
              {view === 'Summary' ? 'Executive summary' : 'Complete verification report'}
            </h2>
            <p className="text-[10px] text-slate-500 truncate font-mono">
              {d.reportId} · {d.subject.fullName} · generated {formatDate(d.generatedAt, true)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <SegmentedControl
            options={[
              { value: 'Summary', label: 'Summary' },
              { value: 'Full Report', label: `Full Report · ${totalFields} fields` },
            ]}
            value={view}
            onChange={(v) => setView(v as View)}
            size="sm"
          />
          {view === 'Full Report' && (
            <>
              <Button size="xs" variant="ghost" onClick={expandAll}>Expand all</Button>
              <Button size="xs" variant="ghost" onClick={collapseAll}>Collapse</Button>
            </>
          )}
          <Button size="xs" variant="secondary" icon={masked ? <Eye size={12} /> : <EyeOff size={12} />} onClick={() => setMasked((v) => !v)}>
            {masked ? 'Unmask' : 'Mask'}
          </Button>
          <Button size="xs" variant="secondary" icon={<Table2 size={12} />} onClick={doExportFields} disabled={!can('report.export')}>
            CSV
          </Button>
          <Button size="xs" variant="secondary" icon={<Printer size={12} />} onClick={doPrint}>
            Print
          </Button>
          <Button size="xs" variant="secondary" loading={busy} icon={<Download size={12} />} onClick={() => doDownload('summary')} disabled={!can('report.export')}>
            Summary PDF
          </Button>
          <Button size="xs" variant="primary" loading={busy} icon={<Download size={12} />} onClick={() => doDownload('full')} disabled={!can('report.export')}>
            Download PDF
          </Button>
        </div>
      </div>

      <div className="p-2 sm:p-4 space-y-4">
        {view === 'Summary' ? (
          /* =============================== SUMMARY =============================== */
          <>
            <Callout tone="info" title="Summary ≠ Full Report">
              This is the one-page executive brief. Switch to <strong>Full Report</strong> above to see every field extracted from
              every gateway — {d.sections.length} sources, {totalFields} fields and {d.events.length} verification events. Print and
              PDF always emit the complete dataset.
            </Callout>

            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Subject" icon={<UserCheck size={14} className="text-cyan-400" />}>
                <div className="space-y-2 text-[11px]">
                  <div className="text-base font-black text-white">{d.subject.fullName}</div>
                  {[
                    ['National ID', masked ? mask(d.subject.idNumber) : d.subject.idNumber],
                    ['Date of birth', `${d.subject.dob} (${d.subject.gender})`],
                     ['KRA PIN', taxAvailable && d.subject.kraPin ? (masked ? mask(d.subject.kraPin) : d.subject.kraPin) : 'Unavailable'],
                     ['Phone', masked ? mask(d.subject.phone) : d.subject.phone],
                     ['County', `${d.subject.county} · ${d.subject.subCounty}`],
                     ['Employer', employerAvailable ? (d.employment.find((e) => e.current)?.company ?? 'Unavailable') : 'Unavailable'],
                     ['M-PESA name', mpesaAvailable && d.mobileMoney.accountName ? (masked ? mask(d.mobileMoney.accountName) : d.mobileMoney.accountName) : 'Unavailable'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-2 border-b border-sky-950/60 pb-1.5 last:border-0">
                      <span className="text-slate-500 shrink-0">{k}</span>
                      <span className="text-slate-100 font-mono text-right break-all">{v}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Risk verdict" icon={<ShieldCheck size={14} className="text-cyan-400" />}>
                <div className="flex items-center gap-3">
                  <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center border ${
                    d.risk.band === 'Low' ? 'bg-emerald-950/50 border-emerald-800/50' : d.risk.band === 'Medium' ? 'bg-amber-950/50 border-amber-800/50' : d.risk.band === 'High' ? 'bg-rose-950/50 border-rose-800/50' : 'bg-slate-950/50 border-slate-700/50'
                  }`}>
                     <span className="text-lg font-black text-white">{riskAvailable ? d.risk.score : 'Unavailable'}</span>
                     <span className="text-[8px] uppercase text-slate-400">{riskAvailable ? d.risk.band : 'Unknown'}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-300 leading-snug">{d.risk.verdict}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{d.risk.recommendation}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {d.risk.drivers.slice(0, 5).map((dr) => (
                    <div key={dr.factor} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 w-28 truncate">{dr.factor}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-[#0b1c33] overflow-hidden">
                        <div className={`h-full ${dr.direction === 'positive' ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, Math.abs(dr.contribution) * 6)}%` }} />
                      </div>
                      <span className={`text-[9px] font-mono w-8 text-right ${dr.direction === 'positive' ? 'text-emerald-400' : 'text-rose-400'}`}>{dr.contribution}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    ['Sections', `${verifiedCount}/${d.sections.length}`],
                     ['Confidence', reportConfidence(avgConfidence)],
                    ['Cost', KES(totalCost, { decimals: false })],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-[#061020] border border-sky-900/50 py-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{k}</div>
                      <div className="text-[11px] font-bold text-white font-mono">{v}</div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Key findings" icon={<AlertTriangle size={14} className="text-amber-400" />}>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                  {keyFindings.map((f, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 ${
                      f.level === 'danger' ? 'border-rose-900/50 bg-rose-950/20' : f.level === 'warning' ? 'border-amber-900/50 bg-amber-950/20' : 'border-emerald-900/50 bg-emerald-950/20'
                    }`}>
                      {f.level === 'success' ? <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" /> : <AlertTriangle size={12} className={f.level === 'danger' ? 'text-rose-400 mt-0.5 shrink-0' : 'text-amber-400 mt-0.5 shrink-0'} />}
                      <span className="text-[11px] text-slate-300 leading-snug">{f.text}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <Panel title="Financial snapshot" icon={<Landmark size={14} className="text-emerald-400" />}>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
                {[
                   ['Credit score', reportScore(d.credit.score, creditAvailable, 900), reportStatus(d.credit.scoreBand, creditAvailable)],
                   ['Outstanding credit', reportAmount(d.credit.totalOutstandingKes, creditAvailable), `${reportCount(d.credit.totalFacilities, creditAvailable)} facilities`],
                   ['Utilisation', reportPercent(d.credit.utilisationPct, creditAvailable), `${reportCount(d.credit.enquiries12m, creditAvailable)} enquiries/12m`],
                   ['KRA outstanding', reportAmount(d.tax.outstandingKes, taxAvailable), reportBoolean(d.tax.goodStanding, taxAvailable)],
                   ['M-PESA turnover', reportAmount(d.mobileMoney.avgMonthlyTurnoverKes, mpesaAvailable), reportStatus(d.mobileMoney.activityBand, mpesaAvailable)],
                   ['Utility bill', reportAmount(d.utility.avgMonthlyBillKes, utilityAvailable), reportStatus(d.utility.paymentBehaviour, utilityAvailable)],
                ].map(([k, v, s]) => (
                  <div key={k} className="rounded-lg bg-[#061020] border border-sky-900/50 px-2.5 py-2">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold truncate">{k}</div>
                    <div className="text-sm font-black text-white font-mono truncate">{v}</div>
                    <div className="text-[9px] text-slate-500 truncate">{s}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Sources queried" icon={<Network size={14} className="text-cyan-400" />}>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {d.sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setView('Full Report'); setOpenSections((p) => ({ ...p, [s.id]: true })); }}
                    className="text-left rounded-lg border border-sky-900/50 bg-[#061020] hover:border-cyan-800/60 hover:bg-sky-950/40 transition-colors px-2.5 py-2"
                  >
                    <div className="flex items-center gap-1.5">
                      {SECTION_ICON[s.id] ?? <Layers size={13} className="text-slate-500" />}
                      <span className="text-[11px] font-semibold text-white truncate flex-1">{s.title}</span>
                      <Badge tone={tone(s.state)}>{label(s.state)}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[9px] text-slate-500">
                      <span className="truncate">{s.provider}</span>
                       <span className="ml-auto font-mono shrink-0">{s.fields.length} fields · {reportLatency(s.latencyMs)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
          </>
        ) : (
          /* ============================= FULL REPORT ============================= */
          <>
            <Callout tone="accent" title={`Complete extracted dataset — ${d.sections.length} sources, ${totalFields} fields`}>
              Nothing is aggregated or hidden here. Every field carries its source, retrieval time, confidence and match rule, and
              every gateway response is available (masked unless you unmask PII). This is exactly what prints and what the PDF
              contains.
            </Callout>

            {/* Cover block */}
            <Panel title="Report identification" icon={<FileText size={14} className="text-cyan-400" />}>
              <div className="grid gap-x-4 gap-y-2.5 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                {[
                  ['Report ID', d.reportId],
                  ['Dossier ID', d.id],
                  ['Generated at', formatDate(d.generatedAt, true)],
                  ['Prepared by', `${d.attestation.preparedBy} (${d.attestation.preparedByTier})`],
                  ['Classification', d.attestation.classification],
                  ['Retention expiry', formatDate(d.attestation.retentionExpiry)],
                  ['Framework', settings.compliance.framework],
                  ['Consent model', settings.compliance.consentCapture],
                  ['Total query cost', KES(totalCost)],
                   ['Average confidence', reportConfidence(avgConfidence)],
                  ['Sections verified', `${verifiedCount} / ${d.sections.length}`],
                  ['Events logged', String(d.events.length)],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{k}</div>
                    <div className="text-[11px] text-slate-100 mt-0.5 break-words">{v}</div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Every section, every field */}
            {d.sections.map((sec: DossierSection) => {
              const open = openSections[sec.id] ?? true;
              return (
                <Panel
                  key={sec.id}
                  title={
                    <span className="flex items-center gap-2 min-w-0">
                      {SECTION_ICON[sec.id] ?? <Layers size={13} className="text-slate-500" />}
                      <span className="truncate">{sec.title}</span>
                      <Badge tone={tone(sec.state)}>{label(sec.state)}</Badge>
                    </span>
                  }
                  subtitle={
                    <span className="font-mono text-[10px]">
                       {sec.provider} · {sec.fields.length} fields · {reportConfidence(sec.confidence)} confidence · {reportLatency(sec.latencyMs)} ·{' '}
                      {KES(sec.costKes)} · {formatDate(sec.retrievedAt, true)}
                    </span>
                  }
                  actions={
                    <Button size="xs" variant="ghost" onClick={() => toggleSection(sec.id)}>
                      {open ? 'Collapse' : 'Expand'}
                    </Button>
                  }
                >
                  {open && (
                    <div className="space-y-3">
                      <p className="text-[11px] text-slate-400 leading-relaxed">{sec.summary}</p>

                      {sec.flags && sec.flags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {sec.flags.map((f, i) => (
                            <Badge key={i} tone={f.level === 'danger' ? 'danger' : f.level === 'warning' ? 'warning' : 'info'}>
                              {f.text}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="overflow-x-auto rounded-lg border border-sky-900/50 bg-[#050b14]">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-[#08172b] text-[9px] uppercase tracking-wider text-slate-500">
                              <th className="text-left px-2 py-1.5 font-bold">Field</th>
                              <th className="text-left px-2 py-1.5 font-bold">Extracted value</th>
                              <th className="text-left px-2 py-1.5 font-bold hidden sm:table-cell">Source</th>
                              <th className="text-left px-2 py-1.5 font-bold hidden lg:table-cell">Confidence</th>
                              <th className="text-left px-2 py-1.5 font-bold hidden xl:table-cell">Match rule</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sec.fields.map((f, i) => (
                              <FieldRow key={`${sec.id}-${i}`} f={f} masked={masked} mask={mask} />
                            ))}
                            {sec.fields.length === 0 && (
                              <tr>
                                <td colSpan={5} className="p-3 text-center text-[10px] text-slate-600">No fields extracted from this source.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {sec.rawResponse && (
                        <details className="rounded-lg border border-sky-900/50 bg-[#050b14] overflow-hidden">
                          <summary className="cursor-pointer px-2.5 py-2 text-[10px] font-semibold text-slate-400 hover:bg-sky-950/40 flex items-center gap-1.5">
                            <ScrollText size={11} /> Raw gateway response ({Object.keys(sec.rawResponse).length} keys)
                          </summary>
                          <pre className="px-2.5 pb-2.5 text-[10px] font-mono text-emerald-300/80 overflow-x-auto whitespace-pre-wrap break-all">
                            {JSON.stringify(
                              Object.fromEntries(Object.entries(sec.rawResponse).map(([k, v]) => [k, masked && typeof v === 'string' && v.length > 4 ? mask(v) : v])),
                              null,
                              2
                            )}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </Panel>
              );
            })}

            {/* Consolidated records */}
            <Panel title="Appendix — consolidated records" subtitle="All structured collections returned by the sources" icon={<Layers size={14} className="text-cyan-400" />}>
              <div className="space-y-4">
                <SubTable title={`Addresses (${d.addresses.length})`} headers={['Type', 'Address', 'City', 'County', 'Postal', 'Since', 'Confirmed by', 'Current']}
                  rows={d.addresses.map((r) => [r.type, r.line, r.city, r.county, r.postalCode ?? '—', r.since ?? '—', r.confirmedBy ?? '—', r.current ? 'Yes' : 'No'])} />

                <SubTable title={`Documents (${d.documents.length})`} headers={['Type', 'Number', 'Issued by', 'Issued', 'Expires', 'Status']}
                  rows={d.documents.map((r) => [r.type, masked ? mask(r.number) : r.number, r.issuedBy, r.issuedOn, r.expiresOn ?? '—', r.status])} />

                <SubTable title={`Employment (${d.employment.length})`} headers={['Employer', 'Position', 'Start', 'End', 'Band', 'Contract', 'Verified by', 'State']}
                  rows={d.employment.map((r) => [r.company, r.position, r.startDate, r.endDate ?? 'Present', r.monthlyBand ?? '—', r.contractType ?? '—', r.verifiedBy, label(r.verificationState)])} />

                <SubTable title={`KRA compliance years (${d.tax.complianceYears.length})`} headers={['Year', 'Return filed', 'Paid', 'Outstanding']}
                  rows={d.tax.complianceYears.map((y) => [y.year, y.returnsFiled ? 'Yes' : 'No', y.paid ? 'Yes' : 'No', KES(y.outstandingKes)])} />

                <SubTable title={`Credit facilities (${d.credit.facilities.length})`} headers={['Institution', 'Type', 'Opened', 'Limit', 'Outstanding', 'Arrears', 'Status']}
                  rows={d.credit.facilities.map((f) => [f.institution, f.type, f.openedOn, KES(f.limit, { decimals: false }), KES(f.outstanding, { decimals: false }), KES(f.arrears, { decimals: false }), f.status])} />

                <SubTable title={`Adverse listings (${d.credit.adverseListings.length})`} headers={['Institution', 'Type', 'Amount', 'Listed on']}
                  rows={d.credit.adverseListings.map((a) => [a.institution, a.type, KES(a.amountKes, { decimals: false }), a.listedOn])} />

                <SubTable title={`Business links (${d.business.links.length})`} headers={['Company', 'Registration', 'Role', 'Shareholding', 'Incorporated', 'Status', 'Source']}
                  rows={d.business.links.map((b) => [b.companyName, b.registrationNo, b.role, b.shareholdingPct != null ? `${b.shareholdingPct}%` : '—', b.incorporatedOn ?? '—', b.status, b.verifiedBy])} />

                <SubTable title={`Criminal records (${d.screening.criminalRecords.length})`} headers={['Case no.', 'Court', 'Charge', 'Filed', 'Outcome']}
                  rows={d.screening.criminalRecords.map((c) => [c.caseNo, c.court, c.charge, c.filedOn, c.outcome])} />

                <SubTable title={`Relationships (${d.relationships.length})`} headers={['Name', 'Relation', 'Link type', 'Strength', 'Evidence', 'PEP', 'Sanctioned']}
                  rows={d.relationships.map((r) => [r.name, r.relation, r.linkType, r.strength, r.evidence, r.pep ? 'Yes' : 'No', r.sanctioned ? 'Yes' : 'No'])} />

                <SubTable title={`Risk drivers (${d.risk.drivers.length})`} headers={['Factor', 'Weight', 'Contribution', 'Direction']}
                  rows={d.risk.drivers.map((dr) => [dr.factor, String(dr.weight), String(dr.contribution), dr.direction])} />
              </div>
            </Panel>

            <Panel title={`Appendix — verification event log (${d.events.length})`} icon={<ScrollText size={14} className="text-cyan-400" />}>
              {d.events.length === 0 ? (
                <EmptyState title="No events" />
              ) : (
                <ResponsiveTable
                  dense
                  rowKey={(r) => r.id}
                  rows={d.events}
                  columns={[
                    { key: 'at', header: 'Timestamp', render: (r) => <span className="font-mono text-[10px]">{formatDate(r.at, true)}</span>, mobilePrimary: true, sortValue: (r) => r.at },
                    { key: 'provider', header: 'Provider', render: (r) => r.provider, sortValue: (r) => r.provider },
                    { key: 'endpoint', header: 'Endpoint', render: (r) => <span className="font-mono text-[10px] break-all">{r.endpoint}</span>, className: 'hidden sm:table-cell' },
                    { key: 'fields', header: 'Fields', render: (r) => <span className="text-[10px]">{r.fieldsRequested.join(', ')}</span>, className: 'hidden xl:table-cell' },
                    { key: 'code', header: 'HTTP', render: (r) => <Badge tone={r.responseCode < 300 ? 'success' : 'danger'}>{r.responseCode}</Badge>, align: 'center', sortValue: (r) => r.responseCode },
                     { key: 'lat', header: 'ms', render: (r) => <span className="font-mono">{reportLatency(r.latencyMs)}</span>, align: 'right', className: 'hidden lg:table-cell', sortValue: (r) => r.latencyMs ?? -1 },
                    { key: 'cost', header: 'Cost', render: (r) => <span className="font-mono">{KES(r.costKes)}</span>, align: 'right', sortValue: (r) => r.costKes },
                    { key: 'consent', header: 'Consent', render: (r) => <span className="font-mono text-[9px] text-slate-500">{r.consentRef}</span>, className: 'hidden xl:table-cell' },
                    { key: 'outcome', header: 'Outcome', render: (r) => <Badge tone={tone(r.outcome)}>{label(r.outcome)}</Badge>, sortValue: (r) => r.outcome },
                    { key: 'actor', header: 'Actor', render: (r) => <span className="text-[10px]">{r.actor}</span>, className: 'hidden lg:table-cell' },
                    { key: 'ip', header: 'IP', render: (r) => <span className="font-mono text-[10px] text-slate-500">{r.ip}</span>, className: 'hidden xl:table-cell' },
                  ]}
                  initialSort={{ key: 'at', dir: 'desc' }}
                />
              )}
            </Panel>

            <Panel title="Appendix — attestation & disclaimer" icon={<ShieldCheck size={14} className="text-cyan-400" />}>
              <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed">
                <p>
                  This report was generated automatically by the IPRS Kenya verification platform on{' '}
                  <strong>{formatDate(d.generatedAt, true)}</strong> by <strong>{d.attestation.preparedBy}</strong> (
                  {d.attestation.preparedByTier}). It aggregates responses from {d.attestation.sources.length} authoritative sources:{' '}
                  {d.attestation.sources.join(', ')}.
                </p>
                <p className="text-slate-400">{d.attestation.disclaimer}</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Classification: {d.attestation.classification} · Retention until {formatDate(d.attestation.retentionExpiry)} ·{' '}
                  Framework: {settings.compliance.framework} · DPO: {settings.compliance.dpoName} ({settings.compliance.dpoEmail})
                </p>
                <p className="text-[10px] text-slate-600">
                  Viewed by {currentUser?.name ?? '—'} · PII masking {masked ? 'enabled' : 'disabled'} ·{' '}
                  {settings.branding.reportFooter}
                </p>
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
};

const SubTable: React.FC<{ title: string; headers: string[]; rows: (string | number)[][] }> = ({ title, headers, rows }) => (
  <div>
    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{title}</div>
    {rows.length === 0 ? (
      <p className="text-[10px] text-slate-600 italic">No records.</p>
    ) : (
      <div className="overflow-x-auto rounded-lg border border-sky-900/50 bg-[#050b14]">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-[#08172b] text-slate-500 uppercase tracking-wider text-[9px]">
              {headers.map((h) => (
                <th key={h} className="text-left px-2 py-1.5 font-bold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-sky-950/60">
                {r.map((cell, j) => (
                  <td key={j} className="px-2 py-1.5 text-slate-300 align-top break-words max-w-[280px]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default Screen5_DetailedReport;
