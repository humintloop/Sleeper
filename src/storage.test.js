import { describe, expect, it } from 'vitest';
import {
  AGENT_RUNS_KEY,
  clearStoredLocalData,
  loadAgentRuns,
  MAX_STORED_AGENT_RUNS,
  saveAgentRun,
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

  it('saves a run and makes it loadable', () => {
    const storage = fakeStorage();
    const run = { caseId: 'NR-AGT-001', profileId: 'reference', verdict: 'CONTROL_HELD', timestamp: '2026-08-17T00:00:00Z' };

    const updated = saveAgentRun(run, storage);

    expect(updated).toEqual([run]);
    expect(loadAgentRuns(storage)).toEqual([run]);
  });

  it('prepends new runs so the most recent is first', () => {
    const storage = fakeStorage();
    saveAgentRun({ caseId: 'first' }, storage);
    saveAgentRun({ caseId: 'second' }, storage);

    const loaded = loadAgentRuns(storage);
    expect(loaded[0].caseId).toBe('second');
    expect(loaded[1].caseId).toBe('first');
  });

  it('caps stored history at MAX_STORED_AGENT_RUNS', () => {
    const storage = fakeStorage();
    for (let i = 0; i < MAX_STORED_AGENT_RUNS + 5; i++) {
      saveAgentRun({ caseId: `run-${i}` }, storage);
    }

    const loaded = loadAgentRuns(storage);
    expect(loaded).toHaveLength(MAX_STORED_AGENT_RUNS);
    expect(loaded[0].caseId).toBe(`run-${MAX_STORED_AGENT_RUNS + 4}`);
  });

  it('does not throw when storage is unavailable', () => {
    expect(() => saveAgentRun({ caseId: 'x' }, null)).not.toThrow();
    expect(loadAgentRuns(null)).toEqual([]);
  });
});
