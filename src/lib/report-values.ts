import type { Dossier } from '../types';
import { KES } from './format';

const FAMILY_ALIASES: Record<string, string[]> = {
  kra: ['kra', 'fullkyc'],
  metropol: ['metropol'],
  hakikisha: ['hakikisha'],
  fullkyc: ['fullkyc'],
  simswap: ['simswap'],
  phonesearch: ['phonesearch'],
  mpesa: ['mpesa'],
  credit: ['credit', 'crb', 'metropol', 'creditinfo'],
  utility: ['kplc', 'utility'],
  employer: ['employer', 'fullkyc'],
  screening: ['screening', 'pep', 'sanction', 'criminal', 'fullkyc'],
  business: ['business', 'company', 'registry'],
};

const normalizeToken = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export function hasReportSection(dossier: Dossier, tokens: string[]): boolean {
  const aliases = tokens.flatMap((token) => FAMILY_ALIASES[normalizeToken(token)] ?? [normalizeToken(token)]);
  return dossier.sections.some((section) => {
    const sectionId = normalizeToken(section.id);
    const provider = normalizeToken(section.provider);
    return aliases.some((alias) => sectionId.includes(alias) || provider.includes(alias));
  });
}

export function reportAmount(value: number | null | undefined, available: boolean): string {
  return available && value !== null && value !== undefined ? KES(value) : 'Unavailable';
}

export function reportCount(value: number | null | undefined, available: boolean): string {
  return available && value !== null && value !== undefined ? String(value) : 'Unavailable';
}

export function reportBoolean(value: boolean | null | undefined, available: boolean): string {
  if (!available || value === null || value === undefined) return 'Unknown';
  return value ? 'Yes' : 'No';
}

export function reportStatus(value: string | null | undefined, available: boolean): string {
  if (!available || value === null || value === undefined || value === '' || value === 'Unknown') return 'Unavailable';
  return value;
}

export function reportDate(value: string | null | undefined, available: boolean): string {
  if (!available || value === null || value === undefined || value === '' || value === 'Unknown') return 'Unavailable';
  return value;
}

export function reportScore(value: number | null | undefined, available: boolean, maximum = 100): string {
  return available && value !== null && value !== undefined ? `${value} / ${maximum}` : 'Unavailable';
}

export function reportPercent(value: number | null | undefined, available = true): string {
  return available && value !== null && value !== undefined ? `${value}%` : 'Unavailable';
}

export function reportLatency(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Unavailable' : `${value} ms`;
}

export function reportConfidence(value: number | null | undefined): string {
  return reportPercent(value);
}

export function averageReportConfidence(dossier: Dossier): number | null {
  const values = dossier.sections.flatMap((section) => section.confidence === null || section.confidence === undefined ? [] : [section.confidence]);
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function riskScoreAvailable(dossier: Dossier): boolean {
  return dossier.risk.score !== null && dossier.risk.score !== undefined && !dossier.risk.verdict.toLowerCase().startsWith('unknown');
}
