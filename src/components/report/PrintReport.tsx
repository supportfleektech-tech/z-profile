import React from 'react';
import { createPortal } from 'react-dom';
import type { Dossier, SystemSettings } from '../../types';
import { formatDate, KES, maskPii } from '../../lib/format';
import { hasReportSection, reportAmount, reportBoolean, reportConfidence, reportCount, reportDate, reportLatency, reportPercent, reportScore, reportStatus, riskScoreAvailable } from '../../lib/report-values';

/**
 * Print-only rendering of the COMPLETE extracted dataset.
 *
 * Mounted into `#print-root`, which is hidden on screen and becomes the only visible
 * content in `@media print` (see index.css). The on-screen app chrome is hidden at the
 * same time, so `window.print()` produces a clean, paginated, light-theme report that
 * contains every field the platform extracted — not the summary card the user sees.
 */

const fmt = (v: string | number | boolean | null | undefined): string =>
  v === null || v === undefined || v === '' ? 'Not provided' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);

const Row: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <tr className="pr-row">
    <th scope="row">{label}</th>
    <td className={mono ? 'pr-mono' : undefined}>{value}</td>
  </tr>
);

const Section: React.FC<{ title: string; children: React.ReactNode; pageBreak?: boolean }> = ({ title, children, pageBreak }) => (
  <section className={`pr-section${pageBreak ? ' pr-page-break' : ''}`}>
    <h2>{title}</h2>
    {children}
  </section>
);

const DataTable: React.FC<{ headers: string[]; rows: React.ReactNode[][]; narrow?: boolean }> = ({ headers, rows, narrow }) => (
  <table className={`pr-table${narrow ? ' pr-table-narrow' : ''}`}>
    <thead>
      <tr>
        {headers.map((h) => (
          <th key={h} scope="col">{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={i}>
          {r.map((c, j) => (
            <td key={j}>{c}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

const STATE: Record<string, string> = {
  verified: 'VERIFIED',
  partial: 'PARTIAL',
  not_found: 'NO RECORD',
  mismatch: 'MISMATCH',
  insufficient: 'INSUFFICIENT',
};

export const PrintReport: React.FC<{ dossier: Dossier; settings: SystemSettings; mask?: boolean }> = ({
  dossier,
  settings,
  mask = true,
}) => {
  if (typeof document === 'undefined') return null;
  const host = document.getElementById('print-root');
  if (!host) return null;

  const s = dossier.subject;
  const m = (v: string, mode: 'full' | 'partial' = 'partial') => (mask ? maskPii(v, mode) : v);
  const taxAvailable = hasReportSection(dossier, ['kra']);
  const mpesaAvailable = hasReportSection(dossier, ['mpesa']);
  const creditAvailable = hasReportSection(dossier, ['crb', 'credit']);
  const employerAvailable = hasReportSection(dossier, ['employer']);
  const utilityAvailable = hasReportSection(dossier, ['kplc', 'utility']);
  const businessAvailable = hasReportSection(dossier, ['business', 'company']);
  const screeningAvailable = hasReportSection(dossier, ['screening', 'pep', 'sanction', 'criminal']);
  const riskAvailable = riskScoreAvailable(dossier);

  return createPortal(
    <div className="pr-doc" data-report-id={dossier.reportId}>
      {/* ---------------------------------- header --------------------------------- */}
      <header className="pr-header">
        <div>
          <div className="pr-brand">IPRS KENYA</div>
          <div className="pr-org">{settings.org.legalName}</div>
        </div>
        <div className="pr-header-right">
          <div className="pr-classification">{dossier.attestation.classification}</div>
          <div className="pr-report-id">{dossier.reportId}</div>
        </div>
      </header>

      <h1>Identity Verification Report — Full Extracted Record</h1>
      <p className="pr-subtitle">
        {s.fullName} · National ID {m(s.idNumber)} · Generated {formatDate(dossier.generatedAt, true)} EAT · Prepared by{' '}
        {dossier.attestation.preparedBy}
      </p>

      <div className="pr-verdict">
        <strong>{dossier.risk.verdict}</strong>
        <span>
          Composite trust score {riskAvailable ? `${dossier.risk.score}/100` : 'unavailable'} ({riskAvailable ? `${dossier.risk.band} Risk` : 'risk unknown'}). {dossier.risk.recommendation} Manual review{' '}
          {dossier.risk.reviewRequired ? 'REQUIRED' : 'not required'}.
        </span>
      </div>

      {/* ------------------------------- report control ------------------------------ */}
      <Section title="Report control">
        <table className="pr-kv">
          <tbody>
            <Row label="Report ID" value={dossier.reportId} mono />
            <Row label="Dossier ID" value={dossier.id} mono />
            <Row label="Data mode" value={dossier.dataMode === 'simulated' ? 'SIMULATED VERIFICATION — seeded demo data, not a live registry response' : 'Provider response'} />
            <Row label="Generated" value={formatDate(dossier.generatedAt, true)} />
            <Row label="Prepared by" value={`${dossier.attestation.preparedBy} (${dossier.attestation.preparedByTier.replace('_', ' ')})`} />
            <Row label="Sections" value={`${dossier.sections.length} source sections · ${dossier.sections.reduce((a, x) => a + x.fields.length, 0)} extracted fields`} />
            <Row label="Gateway calls" value={`${dossier.events.length} · total cost ${KES(dossier.events.reduce((a, e) => a + e.costKes, 0))}`} />
            <Row label="Consent reference" value={dossier.events[0]?.consentRef ?? '—'} mono />
            <Row label="Retention expiry" value={formatDate(dossier.attestation.retentionExpiry)} />
            <Row label="PII masking" value={mask ? 'Applied per compliance policy' : 'Disabled for this export'} />
          </tbody>
        </table>
      </Section>

      {/* --------------------------------- subject --------------------------------- */}
      <Section title="1. Subject identification">
        <table className="pr-kv">
          <tbody>
            <Row label="Full name" value={s.fullName} />
            <Row label="Given / middle / family" value={[s.firstName, s.middleName, s.lastName].filter(Boolean).join(' / ')} />
            <Row label="Known aliases" value={s.aliases.length ? s.aliases.join('; ') : 'Unavailable'} />
            <Row label="Gender" value={s.gender} />
            <Row label="Date of birth" value={`${s.dob} (${s.dobRaw})`} />
            <Row label="Nationality" value={s.nationality} />
            <Row label="National ID" value={m(s.idNumber)} mono />
            <Row label="ID document type" value={s.idType} />
            <Row label="Registration serial" value={s.registrationSerial ? m(s.registrationSerial) : 'Unavailable'} mono />
            <Row label="Passport" value={s.passportNumber ? m(s.passportNumber, 'full') : 'Unavailable'} mono />
            <Row label="KRA PIN" value={m(s.kraPin)} mono />
            <Row label="Primary phone" value={m(s.phone)} mono />
            <Row label="Alternate phones" value={s.altPhones.length ? s.altPhones.map((p) => m(p)).join('; ') : 'Unavailable'} mono />
            <Row label="Email" value={m(s.email)} mono />
            <Row label="Marital status" value={s.maritalStatus} />
            <Row label="Next of kin" value={s.nextOfKin} />
            <Row label="County / sub-county" value={`${s.county} / ${s.subCounty}`} />
            <Row label="Constituency / ward" value={`${s.constituency} / ${s.ward}`} />
            <Row label="Biometric photo match" value={reportPercent(s.photoMatchScore)} />
            <Row label="Deceased registry" value={s.deceased === null ? 'Unknown' : s.deceased ? 'RECORDED AS DECEASED' : 'No deceased record reported'} />
          </tbody>
        </table>
      </Section>

      <Section title="2. Addresses on record">
        <DataTable
          headers={['Type', 'Status', 'Address', 'County', 'Postal', 'Since', 'Confirmed by']}
          rows={dossier.addresses.map((a) => [a.type, a.current ? 'Current' : 'Historical', `${a.line}, ${a.city}`, a.county, a.postalCode ?? '—', a.since ?? '—', a.confirmedBy ?? '—'])}
        />
      </Section>

      <Section title="3. Documents on file">
        <DataTable
          headers={['Document', 'Number', 'Issued by', 'Issued', 'Expires', 'Status']}
          rows={dossier.documents.map((d) => [d.type, m(d.number), d.issuedBy, d.issuedOn, d.expiresOn ?? 'No expiry', d.status])}
        />
      </Section>

      <Section title="4. Employment history">
        {employerAvailable ? (
          <DataTable
            headers={['Employer', 'Position', 'From', 'To', 'Contract', 'Gross band', 'State']}
            rows={dossier.employment.map((e) => [e.company, e.position, e.startDate, e.endDate ?? 'Present', e.contractType ?? '—', e.monthlyBand ?? '—', STATE[e.verificationState] ?? e.verificationState])}
          />
        ) : (
          <p className="pr-note">Employment data unavailable.</p>
        )}
      </Section>

      <Section title="5. Tax compliance (KRA)">
        <table className="pr-kv">
          <tbody>
            <Row label="KRA PIN" value={taxAvailable && dossier.tax.pin ? m(dossier.tax.pin) : 'Unavailable'} mono />
            <Row label="Status" value={reportStatus(dossier.tax.status, taxAvailable)} />
            <Row label="Registered on" value={reportDate(dossier.tax.registeredOn, taxAvailable)} />
            <Row label="Obligation types" value={taxAvailable && dossier.tax.obligationTypes.length ? dossier.tax.obligationTypes.join(', ') : 'Unavailable'} />
            <Row label="Last return filed" value={reportDate(dossier.tax.lastReturnFiled, taxAvailable)} />
            <Row label="Outstanding liability" value={reportAmount(dossier.tax.outstandingKes, taxAvailable)} mono />
            <Row label="Good standing" value={reportBoolean(dossier.tax.goodStanding, taxAvailable)} />
          </tbody>
        </table>
        <DataTable
          headers={['Tax year', 'Return', 'Payment', 'Outstanding']}
          rows={dossier.tax.complianceYears.map((y) => [y.year, y.returnsFiled ? 'Filed' : 'NOT FILED', y.paid ? 'Paid' : 'OUTSTANDING', KES(y.outstandingKes)])}
        />
      </Section>

      <Section title="6. Mobile money (M-PESA)">
        <table className="pr-kv">
          <tbody>
            <Row label="Registered name" value={mpesaAvailable && dossier.mobileMoney.accountName ? dossier.mobileMoney.accountName : 'Unavailable'} />
            <Row label="MSISDN" value={mpesaAvailable && dossier.mobileMoney.msisdn ? m(dossier.mobileMoney.msisdn) : 'Unavailable'} mono />
            <Row label="Status" value={reportStatus(dossier.mobileMoney.status, mpesaAvailable)} />
            <Row label="Active since" value={reportDate(dossier.mobileMoney.activeSince, mpesaAvailable)} />
            <Row label="KYC tier" value={mpesaAvailable ? dossier.mobileMoney.kycTier : 'Unavailable'} />
            <Row label="Daily limit" value={reportAmount(dossier.mobileMoney.dailyLimitKes, mpesaAvailable)} mono />
            <Row label="Single transaction limit" value={reportAmount(dossier.mobileMoney.transactionLimitKes, mpesaAvailable)} mono />
            <Row label="Activity band" value={mpesaAvailable ? dossier.mobileMoney.activityBand : 'Unavailable'} />
            <Row label="Avg monthly turnover" value={reportAmount(dossier.mobileMoney.avgMonthlyTurnoverKes, mpesaAvailable)} mono />
            <Row label="SIM swap events (24m)" value={reportCount(dossier.mobileMoney.simSwapEvents, mpesaAvailable)} />
            <Row label="Last active" value={reportDate(dossier.mobileMoney.lastActive, mpesaAvailable)} />
          </tbody>
        </table>
      </Section>

      <Section title="7. Credit bureau record (CRB)">
        <table className="pr-kv">
          <tbody>
            <Row label="Bureau" value={creditAvailable ? dossier.credit.bureau : 'Unavailable'} />
            <Row label="Credit score" value={reportScore(dossier.credit.score, creditAvailable, 900)} mono />
            <Row label="Score band" value={reportStatus(dossier.credit.scoreBand, creditAvailable)} />
            <Row label="Listing status" value={reportStatus(dossier.credit.listingStatus, creditAvailable)} />
            <Row label="Total facilities" value={reportCount(dossier.credit.totalFacilities, creditAvailable)} />
            <Row label="Total limit" value={reportAmount(dossier.credit.totalLimitKes, creditAvailable)} mono />
            <Row label="Total outstanding" value={reportAmount(dossier.credit.totalOutstandingKes, creditAvailable)} mono />
            <Row label="Utilisation" value={reportPercent(dossier.credit.utilisationPct, creditAvailable)} mono />
            <Row label="Oldest facility" value={reportDate(dossier.credit.oldestFacility, creditAvailable)} />
            <Row label="Enquiries (12m)" value={reportCount(dossier.credit.enquiries12m, creditAvailable)} />
            <Row label="Adverse listings" value={creditAvailable ? (dossier.credit.adverseListings.length ? String(dossier.credit.adverseListings.length) : 'None reported') : 'Unavailable'} />
          </tbody>
        </table>
        <DataTable
          headers={['Institution', 'Facility type', 'Opened', 'Limit', 'Outstanding', 'Status', 'Arrears']}
          rows={dossier.credit.facilities.map((f) => [f.institution, f.type, f.openedOn, KES(f.limit), KES(f.outstanding), f.status, f.arrears ? KES(f.arrears) : 'None'])}
        />
        {dossier.credit.adverseListings.length > 0 && (
          <DataTable
            headers={['Institution', 'Listing type', 'Amount', 'Listed on']}
            rows={dossier.credit.adverseListings.map((l) => [l.institution, l.type, KES(l.amountKes), l.listedOn])}
          />
        )}
      </Section>

      <Section title="8. Utility & address corroboration">
        <table className="pr-kv">
          <tbody>
            <Row label="Provider" value={utilityAvailable ? dossier.utility.provider : 'Unavailable'} />
            <Row label="Meter number" value={utilityAvailable && dossier.utility.meterNumber ? m(dossier.utility.meterNumber) : 'Unavailable'} mono />
            <Row label="Account status" value={reportStatus(dossier.utility.accountStatus, utilityAvailable)} />
            <Row label="Connected since" value={reportDate(dossier.utility.connectedSince, utilityAvailable)} />
            <Row label="Avg monthly bill" value={reportAmount(dossier.utility.avgMonthlyBillKes, utilityAvailable)} mono />
            <Row label="Arrears" value={reportAmount(dossier.utility.arrearsKes, utilityAvailable)} mono />
            <Row label="Payment behaviour" value={utilityAvailable ? dossier.utility.paymentBehaviour : 'Unavailable'} />
            <Row label="Last payment" value={reportDate(dossier.utility.lastPayment, utilityAvailable)} />
          </tbody>
        </table>
      </Section>

      <Section title="9. Business interests (KYB)">
        <table className="pr-kv">
          <tbody>
            <Row label="Registered director" value={reportBoolean(dossier.business.isDirector, businessAvailable)} />
            <Row label="Beneficial owner" value={reportBoolean(dossier.business.isBeneficialOwner, businessAvailable)} />
            <Row label="Sole proprietorships" value={reportCount(dossier.business.soleProprietorships, businessAvailable)} />
          </tbody>
        </table>
        <DataTable
          headers={['Entity', 'Registration', 'Role', 'Holding', 'Status', 'Incorporated', 'Source']}
          rows={dossier.business.links.map((b) => [b.companyName, b.registrationNo, b.role, b.shareholdingPct !== undefined ? `${b.shareholdingPct}%` : '—', b.status, b.incorporatedOn ?? '—', b.verifiedBy])}
        />
      </Section>

      <Section title="10. PEP, sanctions & adverse media">
        <table className="pr-kv">
          <tbody>
            <Row label="PEP status" value={screeningAvailable ? (dossier.screening.pep === null ? 'Unknown' : dossier.screening.pep ? 'IDENTIFIED' : 'No PEP reported') : 'Unavailable'} />
            <Row label="PEP detail" value={screeningAvailable ? dossier.screening.pepDetail : 'Unavailable'} />
            <Row label="Sanctions" value={screeningAvailable ? (dossier.screening.sanctions === null ? 'Unknown' : dossier.screening.sanctions ? 'MATCH FOUND' : 'No match reported') : 'Unavailable'} />
            <Row label="Sanctions detail" value={screeningAvailable ? dossier.screening.sanctionsDetail : 'Unavailable'} />
            <Row label="Adverse media hits" value={reportCount(dossier.screening.adverseMedia, screeningAvailable)} />
            <Row label="Civil litigation" value={reportCount(dossier.screening.civilLitigation, screeningAvailable)} />
            <Row label="Insolvency" value={screeningAvailable ? (dossier.screening.insolvency === null ? 'Unknown' : dossier.screening.insolvency ? 'RECORDED' : 'No record reported') : 'Unavailable'} />
            <Row label="Criminal records" value={screeningAvailable ? (dossier.screening.criminalRecords.length ? String(dossier.screening.criminalRecords.length) : 'No records reported') : 'Unavailable'} />
          </tbody>
        </table>
      </Section>

      <Section title="11. Connections & relationships">
        <DataTable
          headers={['Name', 'Relation', 'Link type', 'Strength', 'Evidence', 'PEP', 'Sanctions']}
          rows={dossier.relationships.map((r) => [r.name, r.relation, r.linkType, r.strength, r.evidence, r.pep ? 'PEP' : '—', r.sanctioned ? 'SANCTIONED' : '—'])}
        />
      </Section>

      {/* ----------------------- every source section, every field ---------------------- */}
      <Section title="Appendix A — Complete extracted data by source" pageBreak>
        <p className="pr-note">
          Every field returned by each registry, with the source system, retrieval timestamp, match confidence and the rule applied.
        </p>
        {dossier.sections.map((sec, i) => (
          <div key={sec.id} className="pr-subsection">
            <h3>
              A{i + 1}. {sec.title}
            </h3>
            <p className="pr-note">{sec.summary}</p>
            <table className="pr-kv pr-kv-compact">
              <tbody>
                <Row label="Source system" value={sec.provider} />
                <Row label="Retrieved" value={formatDate(sec.retrievedAt, true)} />
                 <Row label="State / confidence" value={`${STATE[sec.state] ?? sec.state} · ${reportConfidence(sec.confidence)}`} />
                <Row label="Latency / cost" value={`${reportLatency(sec.latencyMs)} · ${KES(sec.costKes)}`} mono />
              </tbody>
            </table>
            <DataTable
              narrow
              headers={['Field', 'Extracted value', 'Source', 'Retrieved', 'Confidence', 'Match rule']}
              rows={sec.fields.map((f) => [
                f.label,
                f.masked && mask ? m(String(f.value)) : fmt(f.value),
                f.source ?? '—',
                f.retrievedAt ? formatDate(f.retrievedAt, true) : '—',
                f.confidence !== undefined ? `${f.confidence}%` : 'Not provided',
                f.matchRule ?? '—',
              ])}
            />
            {sec.flags?.map((f, k) => (
              <p key={k} className={`pr-flag pr-flag-${f.level}`}>
                <strong>{f.level.toUpperCase()}:</strong> {f.text}
              </p>
            ))}
            {sec.rawResponse && (
              <>
                <h4>Raw gateway response (masked)</h4>
                <pre className="pr-raw">{JSON.stringify(sec.rawResponse, null, 2)}</pre>
              </>
            )}
          </div>
        ))}
      </Section>

      <Section title="Appendix B — Verification event log" pageBreak>
        <DataTable
          narrow
          headers={['Timestamp', 'Actor', 'Provider', 'Endpoint', 'HTTP', 'Latency', 'Cost', 'Outcome', 'Consent ref']}
          rows={dossier.events.map((e) => [
            formatDate(e.at, true),
            e.actor,
            e.provider,
            e.endpoint,
            String(e.responseCode),
            reportLatency(e.latencyMs),
            KES(e.costKes),
            STATE[e.outcome] ?? e.outcome,
            e.consentRef,
          ])}
        />
        <table className="pr-kv">
          <tbody>
            <Row label="Fields requested" value={String(dossier.events.reduce((a, e) => a + e.fieldsRequested.length, 0))} />
            <Row label="Gateway calls" value={String(dossier.events.length)} />
            <Row label="Successful" value={String(dossier.events.filter((e) => e.responseCode === 200).length)} />
            <Row label="Total cost" value={KES(dossier.events.reduce((a, e) => a + e.costKes, 0))} mono />
            <Row label="Lawful basis" value={settings.compliance.lawfulBasisRegister} />
          </tbody>
        </table>
      </Section>

      <Section title="Appendix C — Sources, attestation & disclaimer" pageBreak>
        <h3>Data sources queried</h3>
        <ul className="pr-list">
          {dossier.attestation.sources.map((src) => (
            <li key={src}>{src}</li>
          ))}
        </ul>
        <h3>Data protection</h3>
        <table className="pr-kv">
          <tbody>
            <Row label="Framework" value={settings.compliance.framework} />
            <Row label="Data Protection Officer" value={`${settings.compliance.dpoName} · ${settings.compliance.dpoEmail} · ${settings.compliance.dpoPhone}`} />
            <Row label="Consent capture" value={settings.compliance.consentCapture} />
            <Row label="Purpose limitation" value={settings.compliance.purposeLimitationText} />
            <Row label="Cross-border transfer" value={settings.compliance.crossBorderTransfer ? 'Permitted' : 'Not permitted'} />
          </tbody>
        </table>
        <h3>Attestation</h3>
        <p className="pr-note">
          This report was generated automatically by the IPRS Kenya platform from live registry queries executed on{' '}
          {formatDate(dossier.generatedAt, true)} EAT. The values reproduced above are the values returned by the source registries at
          those timestamps. No manual alteration has been made to the extracted data.
        </p>
        <table className="pr-kv pr-sign">
          <tbody>
            <Row label="Prepared by" value={dossier.attestation.preparedBy} />
            <Row label="Role" value={dossier.attestation.preparedByTier.replace('_', ' ')} />
            <Row label="Signature" value="_______________________________" />
            <Row label="Date" value={formatDate(dossier.generatedAt)} />
            <Row label="Reviewed by" value={dossier.risk.reviewRequired ? 'Pending manual review' : 'Not required'} />
          </tbody>
        </table>
        <div className="pr-disclaimer">
          <strong>Disclaimer.</strong> {settings.branding.reportDisclaimer || dossier.attestation.disclaimer}
        </div>
        <div className="pr-footer-note">{settings.branding.reportFooter}</div>
        <div className="pr-end">END OF REPORT</div>
      </Section>
    </div>,
    host
  );
};

export default PrintReport;
