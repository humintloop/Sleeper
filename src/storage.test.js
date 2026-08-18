import { describe, expect, it } from 'vitest';
import {
  AGENT_RUNS_KEY,
  clearStoredLocalData,
  loadAgentRuns,
  MAX_STORED_AGENT_RUNS,
  saveAgentRun,
  verifyEvidenceChain,
} from './storage';

const fakeStorage = (initial = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    getItem: key => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    has: key => store.has(key),
    dump: () => Object.fromEntries(store.entries()),
  };
};

describe('storage hardening', () => {
  it('clears only SLEEPER-owned storage keys', () => {
    const storage = fakeStorage({
      [AGENT_RUNS_KEY]: '[]',
      unrelated: 'keep-me',
    });

    clearStoredLocalData(storage);

    expect(storage.has(AGENT_RUNS_KEY)).toBe(false);
    expect(storage.has('unrelated')).toBe(true);
  });
});

describe('agent run persistence', () => {
  // Regression: agent-case runs previously lived only in component state.
  // Navigating away lost the run with no warning, and the run never appeared
  // in any local history.
  it('returns an empty list when nothing is stored', () => {
    const storage = fakeStorage();
    expect(loadAgentRuns(storage)).toEqual([]);
  });

  it('saves a run and makes it loadable', async () => {
    const storage = fakeStorage();
    const run = { caseId: 'NR-AGT-001', profileId: 'reference', verdict: 'CONTROL_HELD', timestamp: '2026-08-17T00:00:00Z' };

    const updated = await saveAgentRun(run, storage);

    expect(updated[0]).toMatchObject(run);
    expect(updated[0].evidenceChain.record_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(loadAgentRuns(storage)).toEqual(updated);
  });

  it('prepends new runs so the most recent is first', async () => {
    const storage = fakeStorage();
    await saveAgentRun({ caseId: 'first' }, storage);
    await saveAgentRun({ caseId: 'second' }, storage);

    const loaded = loadAgentRuns(storage);
    expect(loaded[0].caseId).toBe('second');
    expect(loaded[1].caseId).toBe('first');
  });

  it('caps stored history at MAX_STORED_AGENT_RUNS', async () => {
    const storage = fakeStorage();
    for (let i = 0; i < MAX_STORED_AGENT_RUNS + 5; i++) {
      await saveAgentRun({ caseId: `run-${i}` }, storage);
    }

    const loaded = loadAgentRuns(storage);
    expect(loaded).toHaveLength(MAX_STORED_AGENT_RUNS);
    expect(loaded[0].caseId).toBe(`run-${MAX_STORED_AGENT_RUNS + 4}`);
  });

  it('does not throw when storage is unavailable', async () => {
    await expect(saveAgentRun({ caseId: 'x' }, null)).resolves.toHaveLength(1);
    expect(loadAgentRuns(null)).toEqual([]);
  });

  it('verifies ordering and detects mutation in retained records', async () => {
    const storage = fakeStorage();
    await saveAgentRun({ caseId: 'first', verdict: 'CONTROL_HELD' }, storage);
    await saveAgentRun({ caseId: 'second', verdict: 'CONTROL_FAILED' }, storage);
    const valid = await verifyEvidenceChain(loadAgentRuns(storage));
    expect(valid.valid).toBe(true);
    expect(valid.status).toBe('valid_from_origin');

    const mutated = loadAgentRuns(storage);
    mutated[1].verdict = 'CONTROL_FAILED';
    const invalid = await verifyEvidenceChain(mutated);
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.map(error => error.code)).toContain('RECORD_DIGEST_MISMATCH');
  });

  it('detects deleted or reordered retained records', async () => {
    const storage = fakeStorage();
    await saveAgentRun({ caseId: 'first' }, storage);
    await saveAgentRun({ caseId: 'second' }, storage);
    await saveAgentRun({ caseId: 'third' }, storage);
    const runs = loadAgentRuns(storage);
    runs.splice(1, 1);
    const verification = await verifyEvidenceChain(runs);
    expect(verification.valid).toBe(false);
    expect(verification.errors.map(error => error.code)).toContain('PREVIOUS_DIGEST_MISMATCH');
  });

  it('labels untouched legacy history unverifiable and migrates it on the next append', async () => {
    const legacy = [{ caseId: 'newer', timestamp: '2026-01-02' }, { caseId: 'older', timestamp: '2026-01-01' }];
    const storage = fakeStorage({ [AGENT_RUNS_KEY]: JSON.stringify(legacy) });
    expect((await verifyEvidenceChain(loadAgentRuns(storage))).status).toBe('legacy_unverifiable');

    await saveAgentRun({ caseId: 'current', timestamp: '2026-01-03' }, storage);
    const migrated = loadAgentRuns(storage);
    expect(migrated.every(run => run.evidenceChain)).toBe(true);
    expect(migrated[1].evidenceChain.migrated_legacy_record).toBe(true);
    expect((await verifyEvidenceChain(migrated)).valid).toBe(true);
  });
});
