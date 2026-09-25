const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const textValue = (record, keys) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return '';
};
const numberValue = (record, keys) => {
  for (const key of keys) {
    const raw = record[key];
    if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
};
const booleanValue = (record, keys) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
  }
  return null;
};
const percentage = (value) => {
  if (value === null) return null;
  const normalized = value >= 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized * 10) / 10));
};
const providerState = (data) => {
  const status = textValue(data, ['match_status', 'status', 'result', 'state']).toLowerCase();
  if (['mismatch', 'not_match', 'failed', 'error'].includes(status)) return 'mismatch';
  if (['not_found', 'no_match', 'nomatch'].includes(status)) return 'not_found';
  if (['partial', 'incomplete'].includes(status)) return 'partial';
  if (['insufficient', 'pending'].includes(status)) return 'insufficient';
  if (['match', 'matched', 'verified', 'success', 'ok', 'active'].includes(status)) return 'verified';
  return 'insufficient';
};
const primitiveResponse = (data, result) => {
  const raw = {};
  for (const [key, value] of Object.entries(data)) {
    if (['string', 'number', 'boolean'].includes(typeof value) || value === null) raw[key] = value;
  }
  if (result.providerCode !== null && result.providerCode !== undefined) raw.providerCode = result.providerCode;
  if (result.httpStatus !== undefined) raw.httpStatus = result.httpStatus;
  return raw;
};
const riskFromProvider = (data) => {
  const rawScore = numberValue(data, ['risk_score', 'riskScore', 'credit_score', 'score']);
  if (rawScore === null) {
    return {
      score: null,
      band: null,
      verdict: 'Unknown — provider did not return a risk score.',
      drivers: [],
      recommendation: 'Complete manual review or obtain a provider risk score before proceeding.',
      reviewRequired: true,
    };
  }
  const score = Math.max(0, Math.min(100, rawScore >= 0 && rawScore <= 1 ? rawScore * 100 : rawScore));
  const band = score >= 80 ? 'Low' : score >= 60 ? 'Medium' : 'High';
  const verdict = band === 'Low' ? 'Low Risk — Provider score returned.' : band === 'Medium' ? 'Medium Risk — Provider score returned; monitor.' : 'High Risk — Provider score requires manual review.';
  return {
    score: Math.round(score * 10) / 10,
    band,
    verdict,
    drivers: [{ factor: 'Provider-reported risk score', weight: 1, contribution: score, direction: score >= 60 ? 'positive' : 'negative' }],
    recommendation: band === 'Low' ? 'Proceed with standard monitoring.' : 'Complete manual review before proceeding.',
    reviewRequired: band !== 'Low',
  };
};

export function dossierFromSpinResult({ result, module, item, owner, identifier }) {
  if (isRecord(result) && isRecord(result.subject) && isRecord(result.risk)) {
    return { ...result, catalogueItemId: item.id };
  }
  if (!isRecord(result) || result.ok !== true) {
    throw new Error(result?.message || `Spin provider request failed${result?.providerCode ? ` (${result.providerCode})` : ''}.`);
  }
  if (!isRecord(result.data)) {
    throw new Error('Spin returned no renderable provider data.');
  }

  const data = result.data;
  const fullName = textValue(data, ['full_name', 'fullName', 'name']) || [textValue(data, ['first_name', 'firstName']), textValue(data, ['middle_name', 'other_name', 'middleName']), textValue(data, ['last_name', 'lastName', 'surname'])].filter(Boolean).join(' ') || `Subject ${identifier}`;
  const firstName = textValue(data, ['first_name', 'firstName', 'forename']) || 'Unknown';
  const lastName = textValue(data, ['last_name', 'lastName', 'surname']) || 'Unknown';
  const idNumber = textValue(data, ['id_number', 'idNumber', 'national_id', 'citizen_id', 'identifier']) || identifier;
  const phone = textValue(data, ['phone_number', 'phoneNumber', 'phone', 'msisdn']);
  const confidence = percentage(numberValue(data, ['confidence', 'registry_confidence', 'match_confidence', 'photo_match_score', 'photo_match']));
  const state = providerState(data);
  const isMpesa = ['MPESAKYCCHECK', 'sim_swap', 'PHONESEARCH'].includes(module.searchType);
  const isKra = ['pin', 'identity-kra', 'FULLKYC'].includes(module.searchType);
  const isCredit = ['CREDITINFO', 'Metropol', 'METROPOLFULLJSON'].includes(module.searchType);
  const isUtility = module.searchType === 'kplc';
  const isEmployer = ['employer', 'FULLKYC'].includes(module.searchType);
  const isScreening = ['HAKIKISHA', 'FULLKYC'].includes(module.searchType);
  const rawResponse = primitiveResponse(data, result);
  const section = {
    id: `spin-${module.id}`,
    title: module.name,
    provider: `Spin Mobile · ${module.name}`,
    state,
     confidence: confidence,
    retrievedAt: new Date().toISOString(),
     latencyMs: null,
    costKes: item.unitPriceKes,
    summary: result.message || `Spin ${module.searchType} returned provider data without an explicit status.`,
    fields: Object.entries(rawResponse).map(([key, value]) => ({
      label: key,
      value,
      source: 'Spin Mobile',
      retrievedAt: new Date().toISOString(),
      confidence: confidence ?? undefined,
      matchRule: 'Provider-reported',
    })),
    rawResponse,
  };
  const responseCode = Number.parseInt(String(result.providerCode ?? '200'), 10) || 200;
  const event = {
    id: `spin-event-${module.id}`,
    at: new Date().toISOString(),
    actor: owner.name,
    actorTier: owner.tier,
    provider: 'Spin Mobile',
    endpoint: module.endpoint ?? '/analytics/search',
    fieldsRequested: Object.keys(data),
    responseCode,
     latencyMs: null,
    costKes: item.unitPriceKes,
    consentRef: `CNS-${result.providerCode ?? 'SPIN'}`,
    outcome: state,
    ip: owner.lastLoginIp ?? '0.0.0.0',
  };
  const employment = isEmployer && (textValue(data, ['employer_name', 'employerName', 'company', 'company_name']) || textValue(data, ['position', 'job_title', 'jobGroup']))
    ? [{
        id: `spin-employment-${module.id}`,
        company: textValue(data, ['employer_name', 'employerName', 'company', 'company_name']) || 'Unknown',
        position: textValue(data, ['position', 'job_title', 'jobGroup']) || 'Unknown',
        startDate: textValue(data, ['start_date', 'startDate', 'employed_since']) || 'Unknown',
        current: true,
        verifiedBy: 'Spin Mobile',
        verificationState: state,
        monthlyBand: textValue(data, ['monthly_band', 'monthlyBand', 'salary']) || 'Unknown',
        contractType: textValue(data, ['contract_type', 'contractType']) || 'Unknown',
      }]
    : [];
  const screening = {
    pep: isScreening ? booleanValue(data, ['pep', 'politically_exposed_person']) : null,
    pepDetail: isScreening ? textValue(data, ['pep_detail', 'pepDetail']) || 'Unknown' : 'Unknown',
    sanctions: isScreening ? booleanValue(data, ['sanctions', 'sanctioned', 'watchlist_match']) : null,
    sanctionsDetail: isScreening ? textValue(data, ['sanctions_detail', 'sanctionsDetail']) || 'Unknown' : 'Unknown',
     adverseMedia: isScreening ? numberValue(data, ['adverse_media', 'adverseMedia']) : null,
     criminalRecords: [],
     civilLitigation: isScreening ? numberValue(data, ['civil_litigation', 'civilLitigation']) : null,
    insolvency: isScreening ? booleanValue(data, ['insolvency', 'bankruptcy']) : null,
  };
  return {
    id: `SPIN-${String(result.providerCode ?? '200').replace(/[^A-Za-z0-9.-]/g, '')}-${identifier}`,
    reportId: `IPRS-SPIN-${identifier}`,
    generatedAt: new Date().toISOString(),
    dataMode: 'provider',
    subject: {
      fullName,
      firstName,
      middleName: textValue(data, ['middle_name', 'other_name', 'middleName']) || undefined,
      lastName,
      aliases: [],
      gender: textValue(data, ['gender', 'sex']) || 'Unknown',
      dob: textValue(data, ['dob', 'date_of_birth', 'birth_date']) || 'Unknown',
      dobRaw: textValue(data, ['dob', 'date_of_birth', 'birth_date']) || 'Unknown',
      nationality: textValue(data, ['nationality', 'country']) || 'Unknown',
      idNumber,
      idType: 'Provider-reported',
      kraPin: textValue(data, ['kra_pin', 'kraPin', 'pin']),
      phone,
      altPhones: [],
      email: textValue(data, ['email', 'email_address']),
      maritalStatus: textValue(data, ['marital_status', 'maritalStatus']) || 'Unknown',
      nextOfKin: textValue(data, ['next_of_kin', 'nextOfKin']) || 'Unknown',
      county: textValue(data, ['county']) || 'Unknown',
      subCounty: textValue(data, ['sub_county', 'subCounty']) || 'Unknown',
      constituency: textValue(data, ['constituency']) || 'Unknown',
      ward: textValue(data, ['ward']) || 'Unknown',
       photoMatchScore: percentage(numberValue(data, ['photo_match_score', 'photo_match'])),
      deceased: booleanValue(data, ['deceased', 'is_deceased']),
    },
    addresses: [],
    documents: [],
     employment,
     tax: {
       pin: isKra ? textValue(data, ['kra_pin', 'kraPin', 'KRAPIN', 'pin']) : '',
       status: isKra ? textValue(data, ['tax_status', 'taxStatus', 'status', 'pin_status']) || 'Unknown' : 'Unknown',
       registeredOn: isKra ? textValue(data, ['registered_on', 'registeredOn']) || 'Unknown' : 'Unknown',
       obligationTypes: isKra && Array.isArray(data.obligation_types) ? data.obligation_types.map(String) : [],
       complianceYears: [],
       outstandingKes: isKra ? numberValue(data, ['outstanding', 'outstandingKes', 'tax_debt']) ?? null : null,
       lastReturnFiled: isKra ? textValue(data, ['last_return_filed', 'lastReturnFiled']) || 'Unknown' : 'Unknown',
       goodStanding: isKra ? booleanValue(data, ['good_standing', 'goodStanding', 'compliance_cert_valid', 'is_compliant']) : null,
     },
     mobileMoney: {
       accountName: isMpesa ? textValue(data, ['account_name', 'accountName', 'registered_name', 'registeredName']) : '',
       msisdn: isMpesa ? phone || textValue(data, ['msisdn', 'phone_number']) : '',
       activeSince: isMpesa ? textValue(data, ['active_since', 'activeSince']) || 'Unknown' : 'Unknown',
       kycTier: isMpesa ? textValue(data, ['kyc_tier', 'kycTier']) || 'Unknown' : 'Unknown',
       dailyLimitKes: isMpesa ? numberValue(data, ['daily_limit', 'dailyLimit']) ?? null : null,
       transactionLimitKes: isMpesa ? numberValue(data, ['transaction_limit', 'transactionLimit', 'single_transaction_limit']) ?? null : null,
       activityBand: isMpesa ? textValue(data, ['activity_band', 'activityBand']) || 'Unknown' : 'Unknown',
       avgMonthlyTurnoverKes: isMpesa ? numberValue(data, ['avg_monthly_turnover_kes', 'avgMonthlyTurnoverKes']) ?? null : null,
       status: isMpesa ? textValue(data, ['status', 'account_status', 'match_status']) || 'Unknown' : 'Unknown',
       simSwapEvents: isMpesa ? numberValue(data, ['sim_swaps_24m', 'simSwapEvents']) ?? null : null,
       lastActive: isMpesa ? textValue(data, ['last_active', 'lastActive']) || 'Unknown' : 'Unknown',
     },
     credit: {
       bureau: isCredit ? textValue(data, ['bureau', 'credit_bureau']) || 'Unknown' : 'Unknown',
       score: isCredit ? numberValue(data, ['credit_score', 'creditScore', 'score']) ?? null : null,
       scoreBand: isCredit ? textValue(data, ['score_band', 'scoreBand']) || 'Unknown' : 'Unknown',
       listingStatus: isCredit ? textValue(data, ['listing_status', 'listingStatus', 'status']) || 'Unknown' : 'Unknown',
       totalFacilities: isCredit ? numberValue(data, ['total_facilities', 'totalFacilities']) ?? null : null,
       totalOutstandingKes: isCredit ? numberValue(data, ['total_outstanding', 'totalOutstanding']) ?? null : null,
       totalLimitKes: isCredit ? numberValue(data, ['total_limit', 'totalLimit']) ?? null : null,
       utilisationPct: isCredit ? numberValue(data, ['utilisation_pct', 'utilization_pct', 'utilisationPct']) ?? null : null,
       oldestFacility: isCredit ? textValue(data, ['oldest_facility', 'oldestFacility']) || 'Unknown' : 'Unknown',
       daysSinceLastEnquiry: isCredit ? numberValue(data, ['days_since_last_enquiry', 'daysSinceLastEnquiry']) ?? null : null,
       enquiries12m: isCredit ? numberValue(data, ['enquiries_12m', 'enquiries12m']) ?? null : null,
       facilities: [],
       adverseListings: [],
     },
     utility: {
       provider: isUtility ? textValue(data, ['provider', 'utility_provider']) || 'Unknown' : 'Unknown',
       meterNumber: isUtility ? textValue(data, ['meter_number', 'meterNumber', 'account_number']) || '' : '',
       accountStatus: isUtility ? textValue(data, ['account_status', 'accountStatus', 'status']) || 'Unknown' : 'Unknown',
       connectedSince: isUtility ? textValue(data, ['connected_since', 'connectedSince']) || 'Unknown' : 'Unknown',
       avgMonthlyBillKes: isUtility ? numberValue(data, ['avg_monthly_bill', 'avgMonthlyBill']) ?? null : null,
       arrearsKes: isUtility ? numberValue(data, ['arrears', 'arrearsKes']) ?? null : null,
       paymentBehaviour: isUtility ? textValue(data, ['payment_behaviour', 'paymentBehaviour']) || 'Unknown' : 'Unknown',
       lastPayment: isUtility ? textValue(data, ['last_payment', 'lastPayment']) || 'Unknown' : 'Unknown',
     },
     business: { links: [], isDirector: null, isBeneficialOwner: null, soleProprietorships: 0 },
     screening,
    relationships: [],
    risk: riskFromProvider(data),
    sections: [section],
    events: [event],
    attestation: {
      preparedBy: owner.name,
      preparedByTier: owner.tier,
      sources: [`Spin Mobile · ${module.name}`],
      disclaimer: 'This dossier contains only the provider-reported fields returned for the requested check. Missing fields are unknown and are not inferred.',
      classification: 'Confidential identity verification',
      retentionExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };
}
