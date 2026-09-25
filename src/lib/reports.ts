import type { AuditEntry, Dossier, InvoiceItem, PaymentRecord, PricingCatalog, SystemSettings, Wallet, WalletTransaction } from '../types';
import { COLORS, PdfDocument, severityColor } from './pdf';
import { formatDate, KES, maskPii, num } from './format';
import { hasReportSection, reportAmount, reportBoolean, reportConfidence, reportCount, reportDate, reportLatency, reportPercent, reportScore, reportStatus, riskScoreAvailable } from './report-values';

/**
 * Document generators.
 *
 * These build the *complete* extracted dataset — not a summary — so "Download PDF" and
 * "Print" both deliver the full report the user expects. The same section list drives the
 * on-screen Full Report view and the print stylesheet, so screen, print and PDF agree.
 */

const fmt = (v: string | number | boolean | null | undefined): string =>
  v === null || v === undefined || v === '' ? 'Not provided' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);

const stateLabel = (s: string): string =>
  ({ verified: 'VERIFIED', partial: 'PARTIAL', not_found: 'NO RECORD', mismatch: 'MISMATCH', insufficient: 'INSUFFICIENT' }[s] ?? s.toUpperCase());

/* ============================ FULL IDENTITY REPORT ============================ */

export function buildFullReportPdf(dossier: Dossier, settings: SystemSettings, opts: { maskPii?: boolean } = {}): PdfDocument {
  const shouldMask = opts.maskPii ?? true;
  const mask = (v: string | number | boolean | null | undefined, mode: 'full' | 'partial' = 'partial'): string =>
    shouldMask ? maskPii(fmt(v), mode) : fmt(v);

  const s = dossier.subject;
  const taxAvailable = hasReportSection(dossier, ['kra']);
  const mpesaAvailable = hasReportSection(dossier, ['mpesa']);
  const creditAvailable = hasReportSection(dossier, ['crb', 'credit']);
  const utilityAvailable = hasReportSection(dossier, ['kplc', 'utility']);
  const businessAvailable = hasReportSection(dossier, ['business', 'company']);
  const screeningAvailable = hasReportSection(dossier, ['screening', 'pep', 'sanction', 'criminal']);
  const riskAvailable = riskScoreAvailable(dossier);
  const doc = new PdfDocument({
    title: `Identity Verification Report — ${s.fullName}`,
    author: 'IPRS Kenya',
    subject: `${s.fullName} · ID ${s.idNumber} · ${dossier.reportId}`,
    keywords: 'KYC, KYB, identity verification, background check, Kenya, IPRS',
    headerLeft: 'IPRS Kenya — Identity Verification Report',
    headerRight: dossier.reportId,
    footerLeft: `Generated ${formatDate(dossier.generatedAt, true)} EAT · Prepared by ${dossier.attestation.preparedBy}`,
    classification: dossier.attestation.classification,
  });

  /* ------------------------------- cover summary ------------------------------- */
  doc.heading('Identity Verification Report', 1);
  doc.text(`${s.fullName} · National ID ${mask(s.idNumber)} · Report ${dossier.reportId}`, { size: 10, color: COLORS.slate });
  doc.spacer(4);
  if (dossier.dataMode === 'simulated') {
    doc.callout('SIMULATED VERIFICATION', 'Seeded demo data — this document does not represent a live registry response.', { accent: COLORS.amber });
  }

  doc.callout(
    `Determination — ${dossier.risk.verdict}`,
    `Composite trust score ${riskAvailable ? `${dossier.risk.score}/100` : 'unavailable'} (${riskAvailable ? `${dossier.risk.band} Risk` : 'risk unknown'}). ${dossier.risk.recommendation} Manual review ${dossier.risk.reviewRequired ? 'REQUIRED' : 'not required'}.`,
     { accent: dossier.risk.band === 'Low' ? COLORS.green : dossier.risk.band === 'Medium' ? COLORS.amber : dossier.risk.band === 'High' ? COLORS.red : COLORS.slate }
  );

  doc.heading('Report Control', 2);
  doc.keyValue([
    ['Report ID', dossier.reportId],
    ['Dossier ID', dossier.id],
    ['Generated', formatDate(dossier.generatedAt, true)],
    ['Prepared by', `${dossier.attestation.preparedBy} (${dossier.attestation.preparedByTier.replace('_', ' ')})`],
    ['Data sources queried', String(dossier.attestation.sources.length)],
    ['Sections in report', String(dossier.sections.length)],
    ['Verification events logged', String(dossier.events.length)],
    ['Total gateway cost', KES(dossier.events.reduce((a, e) => a + e.costKes, 0))],
    ['Classification', dossier.attestation.classification],
    ['Retention expiry', formatDate(dossier.attestation.retentionExpiry)],
    ['Consent reference', dossier.events[0]?.consentRef ?? '—'],
  ]);

  /* --------------------------------- subject --------------------------------- */
  doc.heading('1. Subject Identification', 2);
  doc.keyValue([
    ['Full name', s.fullName],
    ['Given / middle / family', [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' / ')],
    ['Known aliases', s.aliases.length ? s.aliases.join('; ') : 'Unavailable'],
    ['Gender', s.gender],
    ['Date of birth', `${s.dob} (${s.dobRaw})`],
    ['Nationality', s.nationality],
    ['National ID number', mask(s.idNumber)],
    ['ID document type', s.idType],
    ['Registration serial', s.registrationSerial ? mask(s.registrationSerial) : 'Unavailable'],
    ['Passport number', s.passportNumber ? mask(s.passportNumber, 'full') : 'Unavailable'],
    ['KRA PIN', mask(s.kraPin)],
    ['Primary phone', mask(s.phone)],
    ['Alternate phone(s)', s.altPhones.length ? s.altPhones.map((p) => mask(p)).join('; ') : 'Unavailable'],
    ['Email address', mask(s.email)],
    ['Marital status', s.maritalStatus],
    ['Next of kin', s.nextOfKin],
    ['County / sub-county', `${s.county} / ${s.subCounty}`],
    ['Constituency / ward', `${s.constituency} / ${s.ward}`],
    ['Biometric photo match', reportPercent(s.photoMatchScore)],
    ['Deceased registry flag', s.deceased === null ? 'Unknown' : s.deceased ? 'RECORDED AS DECEASED' : 'No deceased record reported'],
  ]);

  /* -------------------------------- addresses -------------------------------- */
  doc.heading('2. Addresses on Record', 2);
  doc.table(
    dossier.addresses.map((a) => ({
      cells: [a.type, a.current ? 'Current' : 'Historical', `${a.line}, ${a.city}`, a.county, a.postalCode ?? '—', a.since ?? '—', a.confirmedBy ?? '—'],
    })),
    { headers: ['Type', 'Status', 'Address', 'County', 'Postal', 'Since', 'Confirmed by'], widths: [1.4, 1, 3, 1.2, 0.8, 1, 2.2], fontSize: 8.5 }
  );

  /* -------------------------------- documents -------------------------------- */
  doc.heading('3. Documents on File', 2);
  doc.table(
    dossier.documents.map((d) => ({
      cells: [d.type, mask(d.number), d.issuedBy, d.issuedOn, d.expiresOn ?? 'No expiry', d.status],
      color: d.status === 'Valid' ? COLORS.black : d.status === 'Expired' ? COLORS.red : COLORS.amber,
    })),
    { headers: ['Document', 'Number', 'Issued by', 'Issued', 'Expires', 'Status'], widths: [2.4, 1.8, 2.2, 1.2, 1.2, 1], fontSize: 8.5 }
  );

  /* -------------------------------- employment -------------------------------- */
  doc.heading('4. Employment History', 2);
  doc.table(
    dossier.employment.map((e) => ({
      cells: [e.company, e.position, e.startDate, e.endDate ?? 'Present', e.contractType ?? '—', e.monthlyBand ?? '—', e.verificationState.toUpperCase()],
    })),
    { headers: ['Employer', 'Position', 'From', 'To', 'Contract', 'Gross band', 'State'], widths: [2.6, 2.4, 1.1, 1.1, 1.6, 1.5, 1.1], fontSize: 8.5 }
  );

  /* ----------------------------------- tax ----------------------------------- */
  doc.heading('5. Tax Compliance (KRA)', 2);
  doc.keyValue([
    ['KRA PIN', taxAvailable && dossier.tax.pin ? mask(dossier.tax.pin) : 'Unavailable'],
    ['Status', reportStatus(dossier.tax.status, taxAvailable)],
    ['Registered on', reportDate(dossier.tax.registeredOn, taxAvailable)],
    ['Obligation types', taxAvailable && dossier.tax.obligationTypes.length ? dossier.tax.obligationTypes.join(', ') : 'Unavailable'],
    ['Last return filed', reportDate(dossier.tax.lastReturnFiled, taxAvailable)],
    ['Outstanding liability', reportAmount(dossier.tax.outstandingKes, taxAvailable)],
    ['Good standing', reportBoolean(dossier.tax.goodStanding, taxAvailable)],
  ]);
  doc.spacer(2);
  doc.table(
    dossier.tax.complianceYears.map((y) => ({
      cells: [y.year, y.returnsFiled ? 'Filed' : 'NOT FILED', y.paid ? 'Paid' : 'OUTSTANDING', KES(y.outstandingKes)],
      color: y.returnsFiled && y.paid ? COLORS.black : COLORS.red,
    })),
    { headers: ['Tax year', 'Return', 'Payment', 'Outstanding'], widths: [1, 1.4, 1.4, 1.6], fontSize: 8.5 }
  );

  /* ------------------------------- mobile money ------------------------------- */
  doc.heading('6. Mobile Money (M-PESA)', 2);
  const mm = dossier.mobileMoney;
  doc.keyValue([
    ['Registered account name', mpesaAvailable && mm.accountName ? mm.accountName : 'Unavailable'],
    ['MSISDN', mpesaAvailable && mm.msisdn ? mask(mm.msisdn) : 'Unavailable'],
    ['Account status', reportStatus(mm.status, mpesaAvailable)],
    ['Active since', reportDate(mm.activeSince, mpesaAvailable)],
    ['KYC tier', mpesaAvailable ? mm.kycTier : 'Unavailable'],
    ['Daily transaction limit', reportAmount(mm.dailyLimitKes, mpesaAvailable)],
    ['Single transaction limit', reportAmount(mm.transactionLimitKes, mpesaAvailable)],
    ['Activity band', mpesaAvailable ? mm.activityBand : 'Unavailable'],
    ['Average monthly turnover', reportAmount(mm.avgMonthlyTurnoverKes, mpesaAvailable)],
    ['SIM swap events (24 months)', reportCount(mm.simSwapEvents, mpesaAvailable)],
    ['Last active', reportDate(mm.lastActive, mpesaAvailable)],
  ]);

  /* ---------------------------------- credit ---------------------------------- */
  doc.heading('7. Credit Bureau Record (CRB)', 2);
  const cr = dossier.credit;
  doc.keyValue([
    ['Bureau', creditAvailable ? cr.bureau : 'Unavailable'],
    ['Credit score', reportScore(cr.score, creditAvailable, 900)],
    ['Score band', reportStatus(cr.scoreBand, creditAvailable)],
    ['Listing status', reportStatus(cr.listingStatus, creditAvailable)],
    ['Total facilities', creditAvailable && cr.totalFacilities !== null && cr.totalFacilities !== undefined ? `${cr.totalFacilities} (open and closed)` : 'Unavailable'],
    ['Total credit limit', reportAmount(cr.totalLimitKes, creditAvailable)],
    ['Total outstanding', reportAmount(cr.totalOutstandingKes, creditAvailable)],
    ['Utilisation', reportPercent(cr.utilisationPct, creditAvailable)],
    ['Oldest facility', reportDate(cr.oldestFacility, creditAvailable)],
    ['Enquiries (12 months)', reportCount(cr.enquiries12m, creditAvailable)],
    ['Days since last enquiry', reportCount(cr.daysSinceLastEnquiry, creditAvailable)],
    ['Adverse listings', creditAvailable ? (cr.adverseListings.length ? String(cr.adverseListings.length) : 'None reported') : 'Unavailable'],
  ]);
  doc.spacer(2);
  doc.table(
    cr.facilities.map((f) => ({
      cells: [f.institution, f.type, f.openedOn, KES(f.limit), KES(f.outstanding), f.status, f.arrears ? KES(f.arrears) : 'None'],
      color: severityColor(f.status === 'Current' ? 'success' : f.status === 'Closed' ? 'neutral' : 'error'),
    })),
    { headers: ['Institution', 'Facility type', 'Opened', 'Limit', 'Outstanding', 'Status', 'Arrears'], widths: [2.4, 1.8, 1.2, 1.4, 1.4, 1, 1.2], fontSize: 8.5 }
  );
  if (cr.adverseListings.length) {
    doc.spacer(4);
    doc.table(
      cr.adverseListings.map((l) => ({ cells: [l.institution, l.type, KES(l.amountKes), l.listedOn], color: COLORS.red })),
      { headers: ['Institution', 'Listing type', 'Amount', 'Listed on'], widths: [2.4, 3, 1.4, 1.4], fontSize: 8.5, headerBg: [1, 0.92, 0.92] }
    );
  }

  /* ---------------------------------- utility ---------------------------------- */
  doc.heading('8. Utility & Address Corroboration', 2);
  const u = dossier.utility;
  doc.keyValue([
    ['Provider', utilityAvailable ? u.provider : 'Unavailable'],
    ['Meter / account number', utilityAvailable && u.meterNumber ? mask(u.meterNumber) : 'Unavailable'],
    ['Account status', reportStatus(u.accountStatus, utilityAvailable)],
    ['Connected since', reportDate(u.connectedSince, utilityAvailable)],
    ['Average monthly bill', reportAmount(u.avgMonthlyBillKes, utilityAvailable)],
    ['Arrears', reportAmount(u.arrearsKes, utilityAvailable)],
    ['Payment behaviour', utilityAvailable ? u.paymentBehaviour : 'Unavailable'],
    ['Last payment', reportDate(u.lastPayment, utilityAvailable)],
  ]);

  /* ---------------------------------- business --------------------------------- */
  doc.heading('9. Business Interests (KYB)', 2);
  doc.keyValue([
    ['Registered director', reportBoolean(dossier.business.isDirector, businessAvailable)],
    ['Beneficial owner', reportBoolean(dossier.business.isBeneficialOwner, businessAvailable)],
    ['Sole proprietorships', reportCount(dossier.business.soleProprietorships, businessAvailable)],
  ]);
  doc.spacer(2);
  doc.table(
    dossier.business.links.map((b) => ({
      cells: [b.companyName, b.registrationNo, b.role, b.shareholdingPct !== undefined ? `${b.shareholdingPct}%` : '—', b.status, b.incorporatedOn ?? '—', b.verifiedBy],
    })),
    { headers: ['Entity', 'Registration', 'Role', 'Holding', 'Status', 'Incorporated', 'Source'], widths: [2.6, 1.5, 1.6, 0.9, 1, 1.2, 1.2], fontSize: 8.5 }
  );

  /* --------------------------------- screening -------------------------------- */
  doc.heading('10. PEP, Sanctions & Adverse Media Screening', 2);
  const sc = dossier.screening;
  doc.keyValue([
    ['PEP status', screeningAvailable ? (sc.pep === null ? 'Unknown' : sc.pep ? 'IDENTIFIED' : 'No PEP reported') : 'Unavailable'],
    ['PEP detail', screeningAvailable ? sc.pepDetail : 'Unavailable'],
    ['Sanctions', screeningAvailable ? (sc.sanctions === null ? 'Unknown' : sc.sanctions ? 'MATCH FOUND' : 'No match reported') : 'Unavailable'],
    ['Sanctions detail', screeningAvailable ? sc.sanctionsDetail : 'Unavailable'],
    ['Adverse media hits', reportCount(sc.adverseMedia, screeningAvailable)],
    ['Civil litigation records', reportCount(sc.civilLitigation, screeningAvailable)],
    ['Insolvency / bankruptcy', screeningAvailable ? (sc.insolvency === null ? 'Unknown' : sc.insolvency ? 'RECORDED' : 'No record reported') : 'Unavailable'],
    ['Criminal records', screeningAvailable ? (sc.criminalRecords.length ? String(sc.criminalRecords.length) : 'No records reported') : 'Unavailable'],
  ]);
  if (sc.criminalRecords.length) {
    doc.spacer(2);
    doc.table(
      sc.criminalRecords.map((c) => ({ cells: [c.caseNo, c.court, c.charge, c.filedOn, c.outcome], color: COLORS.red })),
      { headers: ['Case no.', 'Court', 'Charge', 'Filed', 'Outcome'], widths: [1.4, 1.8, 2.6, 1.1, 1.6], fontSize: 8.5 }
    );
  }

  /* -------------------------------- connections ------------------------------- */
  doc.heading('11. Connections & Relationships', 2);
  doc.table(
    dossier.relationships.map((r) => ({
      cells: [r.name, r.relation, r.linkType, r.strength, r.evidence, r.pep ? 'PEP' : '—', r.sanctioned ? 'SANCTIONED' : '—'],
      color: r.pep || r.sanctioned ? COLORS.red : COLORS.black,
    })),
    { headers: ['Name', 'Relation', 'Link type', 'Strength', 'Evidence', 'PEP', 'Sanctions'], widths: [2, 1.2, 1.1, 1, 3.4, 0.6, 0.9], fontSize: 8.5 }
  );

  /* ----------------------------- financial analysis ---------------------------- */
  const financial = dossier.sections.find((x) => x.id === 'sec-financial');
  if (financial) {
    doc.heading('12. Financial Analysis', 2);
    doc.text(financial.summary, { size: 9.5, color: COLORS.slate });
    doc.spacer(2);
    doc.keyValue(financial.fields.map((f) => [f.label, fmt(f.value)] as [string, string]));
  }

  /* -------------------------------- risk engine ------------------------------- */
  doc.heading('13. Risk Determination & Score Drivers', 2);
  doc.text(dossier.risk.recommendation, { size: 9.5, color: COLORS.slate });
  doc.spacer(2);
  doc.table(
    dossier.risk.drivers.map((d) => ({
      cells: [d.factor, String(d.weight), `${d.contribution >= 0 ? '+' : ''}${d.contribution}`, d.direction === 'positive' ? 'Positive' : 'Adverse'],
      color: d.direction === 'positive' ? COLORS.black : COLORS.red,
    })),
    { headers: ['Scoring factor', 'Weight', 'Contribution', 'Direction'], widths: [4, 1, 1.4, 1.4], aligns: ['left', 'right', 'right', 'center'], fontSize: 8.5 }
  );
  doc.spacer(4);
  doc.keyValue([
     ['Composite score', riskAvailable ? `${dossier.risk.score} / 100` : 'Unavailable'],
     ['Risk band', riskAvailable ? `${dossier.risk.band} Risk` : 'Unknown'],
    ['Model version', settings.risk.modelVersion],
    ['Band thresholds', `Low >= ${settings.risk.lowThreshold}, High < ${settings.risk.highThreshold}`],
    ['Manual review', dossier.risk.reviewRequired ? 'Required' : 'Not required'],
  ]);

  /* ------------------------- every section, every field ------------------------ */
  doc.pageBreak();
  doc.heading('Appendix A — Complete Extracted Data by Source', 1);
  doc.text(
    'Every field returned by each registry, with the source system, retrieval timestamp, match confidence and the rule applied. This is the complete dataset behind the report.',
    { size: 9.5, color: COLORS.slate }
  );

  dossier.sections.forEach((section, idx) => {
    doc.heading(`A${idx + 1}. ${section.title}`, 2);
    doc.text(section.summary, { size: 9, color: COLORS.slate });
    doc.spacer(2);
    doc.table(
      [
        { cells: ['Source system', section.provider, 'Retrieved', formatDate(section.retrievedAt, true)], bold: true },
        { cells: ['Verification state', stateLabel(section.state), 'Confidence', reportConfidence(section.confidence)], bold: true },
        { cells: ['Gateway latency', reportLatency(section.latencyMs), 'Cost', KES(section.costKes)], bold: true },
      ],
      { widths: [1.6, 2.6, 1.2, 2.2], fontSize: 8.5, zebra: false }
    );
    doc.spacer(3);
    doc.table(
      section.fields.map((f) => ({
        cells: [
          f.label,
          f.masked && shouldMask ? mask(String(f.value)) : fmt(f.value),
          f.source ?? '—',
          f.retrievedAt ? formatDate(f.retrievedAt, true) : '—',
          f.confidence !== undefined ? `${f.confidence}%` : 'Not provided',
          f.matchRule ?? '—',
        ],
        color: severityColor(section.state === 'verified' ? 'success' : section.state === 'mismatch' ? 'error' : 'warning'),
      })),
      { headers: ['Field', 'Extracted value', 'Source', 'Retrieved', 'Conf.', 'Match rule'], widths: [2.1, 3, 1.5, 1.5, 0.6, 1.4], fontSize: 8.2 }
    );

    if (section.flags?.length) {
      doc.spacer(3);
      section.flags.forEach((f) => {
        doc.callout(`Flag — ${f.level.toUpperCase()}`, f.text, { accent: severityColor(f.level) });
      });
    }

    if (section.rawResponse) {
      doc.spacer(3);
      doc.heading('Raw gateway response (masked)', 3);
      doc.table(
        Object.entries(section.rawResponse).map(([k, v]) => ({ cells: [k, fmt(v)] })),
        { widths: [2, 4], fontSize: 8, headerBg: COLORS.panelBg }
      );
    }
  });

  /* ------------------------------- audit chain ------------------------------- */
  doc.pageBreak();
  doc.heading('Appendix B — Verification Event Log', 1);
  doc.text('Immutable record of every gateway call made while compiling this dossier.', { size: 9.5, color: COLORS.slate });
  doc.spacer(3);
  doc.table(
    dossier.events.map((e) => ({
      cells: [
        formatDate(e.at, true),
        e.actor,
        e.provider,
        e.endpoint,
        String(e.responseCode),
        reportLatency(e.latencyMs),
        KES(e.costKes),
        stateLabel(e.outcome),
        e.consentRef,
      ],
    })),
    {
      headers: ['Timestamp', 'Actor', 'Provider', 'Endpoint', 'HTTP', 'Latency', 'Cost', 'Outcome', 'Consent ref'],
      widths: [1.5, 1.2, 1.5, 2, 0.6, 0.8, 0.9, 1, 1.3],
      fontSize: 7.8,
    }
  );
  doc.spacer(4);
  doc.keyValue([
    ['Fields requested (total)', String(dossier.events.reduce((a, e) => a + e.fieldsRequested.length, 0))],
    ['Gateway calls', String(dossier.events.length)],
    ['Successful calls', String(dossier.events.filter((e) => e.responseCode === 200).length)],
    ['Total cost', KES(dossier.events.reduce((a, e) => a + e.costKes, 0))],
    ['Consent reference', dossier.events[0]?.consentRef ?? '—'],
    ['Lawful basis', settings.compliance.lawfulBasisRegister],
  ]);

  /* -------------------------------- attestation ------------------------------- */
  doc.pageBreak();
  doc.heading('Appendix C — Sources, Attestation & Disclaimer', 1);
  doc.heading('Data sources queried', 2);
  doc.bullets(dossier.attestation.sources);

  doc.heading('Data protection', 2);
  doc.keyValue([
    ['Framework', settings.compliance.framework],
    ['Data Protection Officer', `${settings.compliance.dpoName} · ${settings.compliance.dpoEmail} · ${settings.compliance.dpoPhone}`],
    ['Consent capture mode', settings.compliance.consentCapture],
    ['Lawful basis', settings.compliance.lawfulBasisRegister],
    ['Purpose limitation', settings.compliance.purposeLimitationText],
    ['PII masking applied', shouldMask ? 'Yes — partial/full masking per policy' : 'No — unmasked export'],
    ['Cross-border transfer', settings.compliance.crossBorderTransfer ? 'Permitted' : 'Not permitted'],
    ['Dossier retention expiry', formatDate(dossier.attestation.retentionExpiry)],
  ]);

  doc.heading('Attestation', 2);
  doc.text(
    `This report was generated automatically by the IPRS Kenya platform from live registry queries executed on ${formatDate(
      dossier.generatedAt,
      true
    )} EAT. The values reproduced above are the values returned by the source registries at those timestamps. No manual alteration has been made to the extracted data.`,
    { size: 9.5 }
  );
  doc.spacer(10);
  doc.table(
    [
      { cells: ['Prepared by', dossier.attestation.preparedBy, 'Signature', '_______________________'] },
      { cells: ['Role', dossier.attestation.preparedByTier.replace('_', ' '), 'Date', formatDate(dossier.generatedAt)] },
      { cells: ['Reviewed by', dossier.risk.reviewRequired ? 'Pending manual review' : 'Not required', 'Report ID', dossier.reportId] },
    ],
    { widths: [1.4, 2.4, 1.2, 2.4], fontSize: 9, zebra: false }
  );

  doc.spacer(10);
  doc.callout('Disclaimer', settings.branding.reportDisclaimer || dossier.attestation.disclaimer, { accent: COLORS.amber });
  doc.spacer(4);
  doc.text(settings.branding.reportFooter, { size: 8, color: COLORS.muted, align: 'center' });
  doc.text('END OF REPORT', { size: 9, font: 'bold', color: COLORS.slate, align: 'center', gapBefore: 8 });

  return doc;
}

/* ============================== EXECUTIVE SUMMARY ============================== */

export function buildSummaryPdf(dossier: Dossier, settings: SystemSettings): PdfDocument {
  const taxAvailable = hasReportSection(dossier, ['kra']);
  const mpesaAvailable = hasReportSection(dossier, ['mpesa']);
  const creditAvailable = hasReportSection(dossier, ['crb', 'credit']);
  const employerAvailable = hasReportSection(dossier, ['employer']);
  const utilityAvailable = hasReportSection(dossier, ['kplc', 'utility']);
  const screeningAvailable = hasReportSection(dossier, ['screening', 'pep', 'sanction', 'criminal']);
  const doc = new PdfDocument({
    title: `Executive Summary — ${dossier.subject.fullName}`,
    author: 'IPRS Kenya',
    subject: dossier.reportId,
    headerLeft: 'IPRS Kenya — Executive Summary',
    headerRight: dossier.reportId,
    footerLeft: `Generated ${formatDate(dossier.generatedAt, true)} EAT`,
    classification: dossier.attestation.classification,
  });
  doc.heading('Executive Summary', 1);
  doc.text(`${dossier.subject.fullName} · ID ${dossier.subject.idNumber} · ${formatDate(dossier.generatedAt, true)}`, { size: 10, color: COLORS.slate });
  if (dossier.dataMode === 'simulated') {
    doc.callout('SIMULATED VERIFICATION', 'Seeded demo data — this document does not represent a live registry response.', { accent: COLORS.amber });
  }
  doc.callout(dossier.risk.verdict, `${dossier.risk.recommendation} Composite score ${riskScoreAvailable(dossier) ? `${dossier.risk.score}/100` : 'unavailable'}.`, {
    accent: dossier.risk.band === 'Low' ? COLORS.green : dossier.risk.band === 'Medium' ? COLORS.amber : dossier.risk.band === 'High' ? COLORS.red : COLORS.slate,
  });

  doc.heading('Section status', 2);
  doc.table(
    dossier.sections.map((sec) => ({
      cells: [sec.title, sec.provider, stateLabel(sec.state), reportConfidence(sec.confidence), KES(sec.costKes)],
      color: severityColor(sec.state === 'verified' ? 'success' : sec.state === 'mismatch' || sec.state === 'not_found' ? 'error' : 'warning'),
    })),
    { headers: ['Section', 'Source', 'State', 'Confidence', 'Cost'], widths: [2.6, 2.2, 1.2, 1, 1], fontSize: 8.5 }
  );

  doc.heading('Key findings', 2);
  doc.bullets([
    taxAvailable ? `KRA status ${reportStatus(dossier.tax.status, taxAvailable)}; outstanding liability ${reportAmount(dossier.tax.outstandingKes, taxAvailable)}.` : 'KRA data unavailable.',
    mpesaAvailable ? `M-PESA status ${reportStatus(dossier.mobileMoney.status, mpesaAvailable)}; monthly turnover ${reportAmount(dossier.mobileMoney.avgMonthlyTurnoverKes, mpesaAvailable)}.` : 'M-PESA data unavailable.',
    creditAvailable ? `CRB score ${reportScore(dossier.credit.score, creditAvailable, 900)}; listing status ${reportStatus(dossier.credit.listingStatus, creditAvailable)}.` : 'CRB data unavailable.',
    employerAvailable && dossier.employment[0] ? `Employment reported for ${dossier.employment[0].company} since ${dossier.employment[0].startDate}.` : 'Employment data unavailable.',
    utilityAvailable ? `Utility status ${reportStatus(dossier.utility.accountStatus, utilityAvailable)}; arrears ${reportAmount(dossier.utility.arrearsKes, utilityAvailable)}.` : 'Utility data unavailable.',
    screeningAvailable
      ? dossier.screening.pep === null && dossier.screening.sanctions === null
        ? 'Screening provider did not return conclusive PEP or sanctions values.'
        : dossier.screening.pep || dossier.screening.sanctions
          ? 'PEP or sanctions match identified — escalate.'
          : 'Screening returned no reported PEP or sanctions match.'
      : 'Screening data unavailable.',
    screeningAvailable ? (dossier.screening.criminalRecords.length ? `${dossier.screening.criminalRecords.length} criminal record(s) found.` : 'No criminal records reported by the queried source.') : 'Criminal-record data unavailable.',
    'Disposable income is unavailable from the queried providers.',
  ]);

  doc.heading('Recommendation', 2);
  doc.text(dossier.risk.recommendation, { size: 10 });
  doc.spacer(6);
  doc.text(settings.branding.reportFooter, { size: 8, color: COLORS.muted, align: 'center' });
  return doc;
}

/* ================================== INVOICE ================================== */

export function buildInvoicePdf(invoice: InvoiceItem, settings: SystemSettings, wallet?: Wallet): PdfDocument {
  const doc = new PdfDocument({
    title: `Invoice ${invoice.invoiceNo}`,
    author: settings.org.legalName,
    headerLeft: `${settings.org.tradingName} — Tax Invoice`,
    headerRight: invoice.invoiceNo,
    footerLeft: settings.branding.reportFooter,
  });
  doc.heading('Tax Invoice', 1);
  doc.keyValue([
    ['Invoice number', invoice.invoiceNo],
    ['Invoice date', invoice.date],
    ['Status', invoice.status.toUpperCase()],
    ['Amount', invoice.amount],
    ['Billed to', settings.org.legalName],
    ['Currency', settings.billing.currency],
    ['Payment terms', `Net ${settings.billing.creditTermsDays} days`],
  ]);
  doc.heading('Line items', 2);
  const amountValue = invoice.amountValue ?? 0;
  const vat = Math.round((amountValue / (1 + settings.billing.vatRatePct / 100)) * (settings.billing.vatRatePct / 100));
  doc.table(
    [
      { cells: ['Monthly platform access fee — Professional (batch 0–500)', '1', KES(amountValue - vat), KES(amountValue - vat) ] },
      { cells: [`VAT @ ${settings.billing.vatRatePct}%`, '', '', KES(vat)] },
      { cells: ['TOTAL DUE', '', '', invoice.amount], bold: true },
    ],
    { headers: ['Description', 'Qty', 'Unit', 'Amount'], widths: [5, 0.7, 1.4, 1.6], aligns: ['left', 'center', 'right', 'right'], fontSize: 9 }
  );
  if (wallet) {
    doc.heading('Wallet position at time of billing', 2);
    doc.keyValue([
      ['Wallet ID', wallet.id],
      ['Available balance', KES(wallet.balance)],
      ['Held for in-flight work', KES(wallet.held)],
      ['Lifetime top-ups', KES(wallet.lifetimeTopUp)],
      ['Lifetime spend', KES(wallet.lifetimeSpend)],
    ]);
  }
  doc.spacer(8);
  doc.callout('Payment channels', settings.billing.cardGateway + ' · M-PESA Paybill ' + settings.billing.mpesaShortcode + ' · Bank transfer (EFT)', { accent: COLORS.cyan });
  return doc;
}

/* ============================== WALLET STATEMENT ============================== */

export function buildWalletStatementPdf(wallet: Wallet, txs: WalletTransaction[], userName: string, settings: SystemSettings, period: string): PdfDocument {
  const doc = new PdfDocument({
    title: `Wallet statement — ${userName}`,
    author: settings.org.legalName,
    headerLeft: `${settings.org.tradingName} — Wallet Statement`,
    headerRight: `${userName} · ${period}`,
    footerLeft: settings.branding.reportFooter,
  });
  doc.heading('Wallet Statement', 1);
  doc.keyValue([
    ['Account holder', userName],
    ['Wallet ID', wallet.id],
    ['Currency', wallet.currency],
    ['Period', period],
    ['Opening position', KES(wallet.balance + txs.reduce((a, t) => a + (t.direction === 'debit' ? t.amount : -t.amount), 0))],
    ['Closing balance', KES(wallet.balance)],
    ['Held for in-flight work', KES(wallet.held)],
    ['Lifetime top-ups', KES(wallet.lifetimeTopUp)],
    ['Lifetime spend', KES(wallet.lifetimeSpend)],
    ['Transactions in period', String(txs.length)],
    ['Generated', formatDate(new Date().toISOString(), true)],
  ]);
  doc.heading('Transactions', 2);
  doc.table(
    txs.map((t) => ({
      cells: [formatDate(t.at, true), t.reference, t.description, t.channel.toUpperCase(), t.direction === 'credit' ? '+' : '−', KES(t.amount), t.status.toUpperCase(), KES(t.balanceAfter)],
      color: t.status === 'success' ? COLORS.black : t.status === 'failed' ? COLORS.red : COLORS.amber,
    })),
    { headers: ['Date & time', 'Reference', 'Description', 'Channel', 'Dir', 'Amount', 'Status', 'Balance'], widths: [1.5, 1.4, 3.2, 0.9, 0.4, 1.1, 0.9, 1.1], fontSize: 7.8 }
  );
  const credits = txs.filter((t) => t.direction === 'credit' && t.status === 'success').reduce((a, t) => a + t.amount, 0);
  const debits = txs.filter((t) => t.direction === 'debit').reduce((a, t) => a + t.amount, 0);
  doc.spacer(4);
  doc.table(
    [
      { cells: ['Total credits (successful)', KES(credits)] },
      { cells: ['Total debits', KES(debits)] },
      { cells: ['Net movement', KES(credits - debits)], bold: true },
    ],
    { widths: [3, 1.6], aligns: ['left', 'right'], fontSize: 9, zebra: false }
  );
  return doc;
}

/* ============================== PAYMENT LEDGER ============================== */

export function buildPaymentsPdf(payments: PaymentRecord[], settings: SystemSettings, title = 'Payment Monitoring Ledger'): PdfDocument {
  const doc = new PdfDocument({
    title,
    author: settings.org.legalName,
    headerLeft: `${settings.org.tradingName} — ${title}`,
    headerRight: `${payments.length} record(s)`,
    footerLeft: `Generated ${formatDate(new Date().toISOString(), true)} EAT`,
    classification: 'INTERNAL — FINANCIAL',
  });
  doc.heading(title, 1);
  const gross = payments.filter((p) => p.status === 'success').reduce((a, p) => a + p.amount, 0);
  const fees = payments.filter((p) => p.status === 'success').reduce((a, p) => a + p.feeKes, 0);
  doc.keyValue([
    ['Records', String(payments.length)],
    ['Gross collected', KES(gross)],
    ['Gateway fees', KES(fees)],
    ['Net collected', KES(gross - fees)],
    ['Successful', String(payments.filter((p) => p.status === 'success').length)],
    ['Failed / cancelled / timed out', String(payments.filter((p) => ['failed', 'cancelled', 'timeout'].includes(p.status)).length)],
    ['Refunded', String(payments.filter((p) => p.status === 'refunded').length)],
  ]);
  doc.heading('Ledger', 2);
  doc.table(
    payments.map((p) => ({
      cells: [formatDate(p.at, true), p.userName, p.channel.toUpperCase(), p.method, KES(p.amount), p.status.toUpperCase(), p.reference, p.gateway],
      color: severityColor(p.status),
    })),
    { headers: ['Date & time', 'User', 'Channel', 'Method', 'Amount', 'Status', 'Reference', 'Gateway'], widths: [1.4, 1.5, 0.8, 2, 1.1, 0.9, 1.4, 1.4], fontSize: 7.8 }
  );
  return doc;
}

/* ============================== PRICING SCHEDULE ============================== */

export function buildPricingSchedulePdf(catalog: PricingCatalog, settings: SystemSettings): PdfDocument {
  const doc = new PdfDocument({
    title: `${catalog.proposalRef} — Price Schedule`,
    author: settings.org.legalName,
    headerLeft: `${settings.org.tradingName} — KYC / KYB Price Schedule`,
    headerRight: `Batch ${catalog.batchLabel}`,
    footerLeft: `Effective ${catalog.effectiveDate} · Valid until ${catalog.validUntil}`,
    classification: 'COMMERCIAL IN CONFIDENCE',
  });

  doc.heading('KYC / KYB Financial Proposal 2026', 1);
  doc.text(`Price schedule — batch ${catalog.batchLabel}`, { size: 11, color: COLORS.slate });
  const confirmedCount = catalog.items.filter((i) => i.confirmedFromProposal).length;
  const provisionalCount = catalog.items.length - confirmedCount;
  if (provisionalCount > 0 || !catalog.confirmedFromProposal) {
    doc.callout(
      provisionalCount === 0 ? 'Schedule confirmed' : `Partly provisional schedule — ${provisionalCount} of ${catalog.items.length} rates unconfirmed`,
      provisionalCount === 0
        ? `All ${confirmedCount} rates are transcribed from the ${catalog.proposalRef} (batch ${catalog.batchLabel}). Set confirmedFromProposal to clear this notice.`
        : `${confirmedCount} of ${catalog.items.length} rates are transcribed from the ${catalog.proposalRef} (batch ${catalog.batchLabel}, VAT exclusive). The remaining ${provisionalCount} are placeholders — the proposal quotes no criminal, deceased, business-tax-compliance or CRB-business-report rates, and the Spin-documented composites are unpriced. Rows marked provisional should not be treated as contracted pricing.`,
      { accent: provisionalCount === 0 ? COLORS.green : COLORS.amber }
    );
  }
  doc.keyValue([
    ['Proposal reference', catalog.proposalRef],
    ['Volume batch in use', catalog.batchLabel],
    ['Currency', catalog.currency],
    ['Effective date', catalog.effectiveDate],
    ['Valid until', catalog.validUntil],
    ['VAT', `${catalog.vatRatePct}%`],
    ['One-off implementation fee', KES(catalog.setupFeeKes)],
    ['Monthly platform access fee', KES(catalog.monthlyAccessFeeKes)],
    ['Payment terms', catalog.paymentTerms],
    ['Payment channels', catalog.paymentChannels.join('; ')],
  ]);

  doc.heading('Schedule A — KYC line items', 2);
  doc.table(
    catalog.items
      .filter((i) => i.type === 'kyc')
      .map((i) => ({
        cells: [i.name, i.description, i.source, KES(i.unitPriceKes), num(i.includedInBatch), KES(i.overageRateKes), i.turnaround, i.confidence],
      })),
    {
      headers: ['Check', 'Description', 'Data source', 'Unit price', 'Included', 'Overage', 'Turnaround', 'Confidence'],
      widths: [1.7, 3, 1.9, 0.9, 0.7, 0.8, 1.1, 0.8],
      aligns: ['left', 'left', 'left', 'right', 'right', 'right', 'left', 'center'],
      fontSize: 7.6,
    }
  );

  doc.heading('Schedule B — KYB line items', 2);
  doc.table(
    catalog.items
      .filter((i) => i.type === 'kyb')
      .map((i) => ({
        cells: [i.name, i.description, i.source, KES(i.unitPriceKes), num(i.includedInBatch), KES(i.overageRateKes), i.turnaround, i.confidence],
      })),
    {
      headers: ['Check', 'Description', 'Data source', 'Unit price', 'Included', 'Overage', 'Turnaround', 'Confidence'],
      widths: [1.7, 3, 1.9, 0.9, 0.7, 0.8, 1.1, 0.8],
      aligns: ['left', 'left', 'left', 'right', 'right', 'right', 'left', 'center'],
      fontSize: 7.6,
    }
  );

  doc.heading('Schedule C — Bundles', 2);
  doc.table(
    catalog.bundles.map((b) => ({
      cells: [b.name, b.tagline, b.itemIds.map((id) => catalog.items.find((i) => i.id === id)?.name ?? id).join(', '), String(b.itemIds.length), KES(b.priceKes), KES(b.priceKes / b.itemIds.length)],
    })),
    { headers: ['Bundle', 'Positioning', 'Contents', 'Checks', 'Bundle price', 'Effective / check'], widths: [1.5, 2.4, 4.4, 0.6, 1, 1.1], aligns: ['left', 'left', 'left', 'center', 'right', 'right'], fontSize: 7.8 }
  );

  doc.heading('Commercial notes', 2);
  doc.bullets(catalog.notes);
  doc.heading('Exclusions', 2);
  doc.bullets(catalog.exclusions);
  doc.spacer(6);
  doc.text(settings.branding.reportFooter, { size: 8, color: COLORS.muted, align: 'center' });
  return doc;
}

/* ================================= AUDIT LOG ================================= */

export function buildAuditPdf(entries: AuditEntry[], settings: SystemSettings): PdfDocument {
  const doc = new PdfDocument({
    title: 'Platform Audit Log',
    author: settings.org.legalName,
    headerLeft: `${settings.org.tradingName} — Audit Log`,
    headerRight: `${entries.length} entries`,
    footerLeft: `Generated ${formatDate(new Date().toISOString(), true)} EAT · retention ${settings.compliance.auditRetentionMonths} months`,
    classification: 'INTERNAL — AUDIT',
  });
  doc.heading('Platform Audit Log', 1);
  doc.text('Append-only record of authentication, configuration, financial and data-access events.', { size: 9.5, color: COLORS.slate });
  doc.spacer(4);
  doc.table(
    entries.map((e) => ({
      cells: [formatDate(e.at, true), e.actorName, e.actorTier.replace('_', ' '), e.action, e.entity, e.severity.toUpperCase(), e.ip, e.detail ?? ''],
      color: severityColor(e.severity),
    })),
    { headers: ['Timestamp', 'Actor', 'Tier', 'Action', 'Entity', 'Severity', 'IP', 'Detail'], widths: [1.4, 1.3, 0.8, 1.5, 1.1, 0.8, 1, 3.4], fontSize: 7.6 }
  );
  return doc;
}
