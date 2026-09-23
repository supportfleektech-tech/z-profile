import React from 'react';
import { createPortal } from 'react-dom';
import type { Dossier, SystemSettings } from '../../types';
import { formatDate, KES, maskPii } from '../../lib/format';

/**
 * Print-only rendering of the COMPLETE extracted dataset.
 *
 * Mounted into `#print-root`, which is hidden on screen and becomes the only visible
 * content in `@media print` (see index.css). The on-screen app chrome is hidden at the
 * same time, so `window.print()` produces a clean, paginated, light-theme report that
 * contains every field the platform extracted — not the summary card the user sees.
 */

const fmt = (v: string | number | boolean | null | undefined): string =>
  v === null || v === undefined || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);

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
          Composite trust score {dossier.risk.score}/100 ({dossier.risk.band} Risk). {dossier.risk.recommendation} Manual review{' '}
          {dossier.risk.reviewRequired ? 'REQUIRED' : 'not required'}.
        </span>
      </div>

      {/* ------------------------------- report control ------------------------------ */}
      <Section title="Report control">
        <table className="pr-kv">
          <tbody>
            <Row label="Report ID" value={dossier.reportId} mono />
            <Row label="Dossier ID" value={dossier.id} mono />
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
            <Row label="Known aliases" value={s.aliases.length ? s.aliases.join('; ') : 'None on record'} />
            <Row label="Gender" value={s.gender} />
            <Row label="Date of birth" value={`${s.dob} (${s.dobRaw})`} />
            <Row label="Nationality" value={s.nationality} />
            <Row label="National ID" value={m(s.idNumber)} mono />
            <Row label="ID document type" value={s.idType} />
            <Row label="Registration serial" value={m(s.registrationSerial ?? '—')} mono />
            <Row label="Passport" value={m(s.passportNumber ?? '—', 'full')} mono />
            <Row label="KRA PIN" value={m(s.kraPin)} mono />
            <Row label="Primary phone" value={m(s.phone)} mono />
            <Row label="Alternate phones" value={s.altPhones.length ? s.altPhones.map((p) => m(p)).join('; ') : 'None'} mono />
            <Row label="Email" value={m(s.email)} mono />
            <Row label="Marital status" value={s.maritalStatus} />
            <Row label="Next of kin" value={s.nextOfKin} />
            <Row label="County / sub-county" value={`${s.county} / ${s.subCounty}`} />
            <Row label="Constituency / ward" value={`${s.constituency} / ${s.ward}`} />
            <Row label="Biometric photo match" value={`${s.photoMatchScore}%`} />
            <Row label="Deceased registry" value={s.deceased ? 'RECORDED AS DECEASED' : 'Not recorded as deceased'} />
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
        <DataTable
          headers={['Employer', 'Position', 'From', 'To', 'Contract', 'Gross band', 'State']}
          rows={dossier.employment.map((e) => [e.company, e.position, e.startDate, e.endDate ?? 'Present', e.contractType ?? '—', e.monthlyBand ?? '—', STATE[e.verificationState] ?? e.verificationState])}
        />
      </Section>

      <Section title="5. Tax compliance (KRA)">
        <table className="pr-kv">
          <tbody>
            <Row label="KRA PIN" value={m(dossier.tax.pin)} mono />
            <Row label="Status" value={dossier.tax.status} />
            <Row label="Registered on" value={dossier.tax.registeredOn} />
            <Row label="Obligation types" value={dossier.tax.obligationTypes.join(', ')} />
            <Row label="Last return filed" value={dossier.tax.lastReturnFiled} />
            <Row label="Outstanding liability" value={KES(dossier.tax.outstandingKes)} mono />
            <Row label="Good standing" value={dossier.tax.goodStanding ? 'Yes' : 'No'} />
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
            <Row label="Registered name" value={dossier.mobileMoney.accountName} />
            <Row label="MSISDN" value={m(dossier.mobileMoney.msisdn)} mono />
            <Row label="Status" value={dossier.mobileMoney.status} />
            <Row label="Active since" value={dossier.mobileMoney.activeSince} />
            <Row label="KYC tier" value={dossier.mobileMoney.kycTier} />
            <Row label="Daily limit" value={KES(dossier.mobileMoney.dailyLimitKes)} mono />
            <Row label="Single transaction limit" value={KES(dossier.mobileMoney.transactionLimitKes)} mono />
            <Row label="Activity band" value={dossier.mobileMoney.activityBand} />
            <Row label="Avg monthly turnover" value={KES(dossier.mobileMoney.avgMonthlyTurnoverKes)} mono />
            <Row label="SIM swap events (24m)" value={String(dossier.mobileMoney.simSwapEvents)} />
            <Row label="Last active" value={dossier.mobileMoney.lastActive} />
          </tbody>
        </table>
      </Section>

      <Section title="7. Credit bureau record (CRB)">
        <table className="pr-kv">
          <tbody>
            <Row label="Bureau" value={dossier.credit.bureau} />
            <Row label="Credit score" value={`${dossier.credit.score} / 900`} mono />
            <Row label="Score band" value={dossier.credit.scoreBand} />
            <Row label="Listing status" value={dossier.credit.listingStatus} />
            <Row label="Total facilities" value={String(dossier.credit.totalFacilities)} />
            <Row label="Total limit" value={KES(dossier.credit.totalLimitKes)} mono />
            <Row label="Total outstanding" value={KES(dossier.credit.totalOutstandingKes)} mono />
            <Row label="Utilisation" value={`${dossier.credit.utilisationPct}%`} mono />
            <Row label="Oldest facility" value={dossier.credit.oldestFacility} />
            <Row label="Enquiries (12m)" value={String(dossier.credit.enquiries12m)} />
            <Row label="Adverse listings" value={dossier.credit.adverseListings.length ? String(dossier.credit.adverseListings.length) : 'None'} />
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
            <Row label="Provider" value={dossier.utility.provider} />
            <Row label="Meter number" value={m(dossier.utility.meterNumber)} mono />
            <Row label="Account status" value={dossier.utility.accountStatus} />
            <Row label="Connected since" value={dossier.utility.connectedSince} />
            <Row label="Avg monthly bill" value={KES(dossier.utility.avgMonthlyBillKes)} mono />
            <Row label="Arrears" value={KES(dossier.utility.arrearsKes)} mono />
            <Row label="Payment behaviour" value={dossier.utility.paymentBehaviour} />
            <Row label="Last payment" value={dossier.utility.lastPayment} />
          </tbody>
        </table>
      </Section>

      <Section title="9. Business interests (KYB)">
        <table className="pr-kv">
          <tbody>
            <Row label="Registered director" value={dossier.business.isDirector ? 'Yes' : 'No'} />
            <Row label="Beneficial owner" value={dossier.business.isBeneficialOwner ? 'Yes' : 'No'} />
            <Row label="Sole proprietorships" value={String(dossier.business.soleProprietorships)} />
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
            <Row label="PEP status" value={dossier.screening.pep ? 'IDENTIFIED' : 'Not a PEP'} />
            <Row label="PEP detail" value={dossier.screening.pepDetail} />
            <Row label="Sanctions" value={dossier.screening.sanctions ? 'MATCH FOUND' : 'No match'} />
            <Row label="Sanctions detail" value={dossier.screening.sanctionsDetail} />
            <Row label="Adverse media hits" value={String(dossier.screening.adverseMedia)} />
            <Row label="Civil litigation" value={String(dossier.screening.civilLitigation)} />
            <Row label="Insolvency" value={dossier.screening.insolvency ? 'RECORDED' : 'None'} />
            <Row label="Criminal records" value={dossier.screening.criminalRecords.length ? String(dossier.screening.criminalRecords.length) : 'None found'} />
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
                <Row label="State / confidence" value={`${STATE[sec.state] ?? sec.state} · ${sec.confidence}%`} />
                <Row label="Latency / cost" value={`${sec.latencyMs} ms · ${KES(sec.costKes)}`} mono />
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
                f.confidence !== undefined ? `${f.confidence}%` : '—',
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
            `${e.latencyMs} ms`,
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
