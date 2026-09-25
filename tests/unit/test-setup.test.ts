import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createIsolatedDatabasePath } from '../setup';

describe('Vitest database setup', () => {
  it('assigns an isolated file-backed database path when none is supplied', () => {
    const dbPath = process.env.IPRS_DB;

    expect(dbPath).toBeDefined();
    expect(path.isAbsolute(dbPath ?? '')).toBe(true);
    expect(path.extname(dbPath ?? '')).toBe('.sqlite');
    expect(dbPath).not.toBe(path.resolve('server/.data/iprs.sqlite'));
  });

  it('generates a different path for every environment it is given', () => {
    const firstEnv: NodeJS.ProcessEnv = {};
    const secondEnv: NodeJS.ProcessEnv = {};

    const firstPath = createIsolatedDatabasePath(firstEnv);
    const secondPath = createIsolatedDatabasePath(secondEnv);

    expect(firstPath).not.toBe(secondPath);
    expect(path.dirname(firstPath)).not.toBe(path.dirname(secondPath));
  });

  it('assigns the generated path back onto the supplied environment', () => {
    const env: NodeJS.ProcessEnv = {};

    const dbPath = createIsolatedDatabasePath(env);

    expect(env.IPRS_DB).toBe(dbPath);
    expect(path.isAbsolute(dbPath)).toBe(true);
    expect(path.extname(dbPath)).toBe('.sqlite');
    expect(path.dirname(dbPath)).not.toBe(path.resolve('server/.data'));
  });

  it('reuses a generated path when the same environment is passed again', () => {
    const env: NodeJS.ProcessEnv = {};

    const firstPath = createIsolatedDatabasePath(env);
    const secondPath = createIsolatedDatabasePath(env);

    expect(secondPath).toBe(firstPath);
  });

  it('preserves an explicitly supplied IPRS_DB and cleans later generated paths', () => {
    const explicitPath = path.resolve('server/.data', 'explicit.sqlite');
    const env: NodeJS.ProcessEnv = { IPRS_DB: explicitPath };

    expect(createIsolatedDatabasePath(env)).toBe(explicitPath);
    expect(env.IPRS_DB).toBe(explicitPath);

    const childExplicitPath = path.join(tmpdir(), 'iprs-explicit.sqlite');
    const script = [
      "import { createIsolatedDatabasePath } from './tests/setup.ts';",
      'console.log(createIsolatedDatabasePath({}));',
    ].join('\n');
    const output = execFileSync(
      process.execPath,
      ['--experimental-strip-types', '--input-type=module', '-e', script],
      { env: { ...process.env, IPRS_DB: childExplicitPath }, encoding: 'utf8' },
    ).trim();

    expect(existsSync(path.dirname(output))).toBe(false);
  });

  it('keeps the automatic setup path out of the shared repository database', () => {
    const sharedRepositoryDb = path.resolve('server/.data/iprs.sqlite');

    expect(process.env.IPRS_DB).not.toBe(sharedRepositoryDb);
  });
});
