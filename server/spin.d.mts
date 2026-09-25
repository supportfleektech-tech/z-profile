export function isLive(): boolean;
export function search(moduleOrItemId: string, identifier: string, opts?: Record<string, unknown>): Promise<unknown>;
export interface NormalizedSpinResponse {
  ok: boolean;
  providerCode: string | number | null;
  message: string;
  data: unknown;
}

export function normalizeResponse(raw: unknown): NormalizedSpinResponse;
