import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const isolatedDataDirs = new Set<string>();

function removeIsolatedDataDirs(): void {
  for (const dataDir of isolatedDataDirs) {
    rmSync(dataDir, { recursive: true, force: true });
  }
  isolatedDataDirs.clear();
}

function trackIsolatedDataDir(dataDir: string): void {
  isolatedDataDirs.add(dataDir);
  if (isolatedDataDirs.size === 1) {
    process.once('exit', removeIsolatedDataDirs);
  }
}

export function createIsolatedDatabasePath(env: NodeJS.ProcessEnv): string {
  if (env.IPRS_DB === undefined) {
    const dataDir = mkdtempSync(path.join(tmpdir(), 'iprs-vitest-'));
    trackIsolatedDataDir(dataDir);
    env.IPRS_DB = path.join(dataDir, 'iprs.sqlite');
  }
  return env.IPRS_DB;
}

createIsolatedDatabasePath(process.env);
