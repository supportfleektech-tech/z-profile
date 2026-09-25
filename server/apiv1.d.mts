export const MACHINE_SCOPES: readonly string[];
export const MACHINE_ENDPOINTS: readonly string[];
export function hashMachineSecret(secret: string): string;
export function issueMachineApiKey(input: { ownerId: string; label: string; scopes: string[]; environment?: string }): {
  key: Record<string, unknown>;
  secret: string;
};
export function createMachineApiRouter(options: Record<string, unknown>): unknown;
export function machineDependencies(applyWalletMovement: (movement: Record<string, unknown>) => { transaction: Record<string, unknown> }): Record<string, unknown>;
