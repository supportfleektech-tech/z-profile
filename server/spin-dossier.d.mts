import type { Dossier } from '../src/types/index';

export function dossierFromSpinResult(input: {
  result: unknown;
  module: { id: string; name: string; searchType: string; endpoint?: string | null };
  item: { id: string; unitPriceKes: number };
  owner: { name: string; tier: 'user' | 'admin' | 'super_admin'; lastLoginIp?: string };
  identifier: string;
}): Dossier;
