// Agent-case runs are the only thing this project persists locally now that
// the single-turn probe flow is gone (docs/remove-single-turn-flow.md).
// ACTIVE_CASE_KEY / FINDINGS_KEY / ANALYST_KEY and their probe-shaped fields
// (probeIndex, clusterId, judgeMode, presetId, analyst) were removed with the
// probe flow itself — there is no agent-mode equivalent of "resume a
// half-configured case": AgentCaseRunner is a single self-contained screen,
// and what needs persisting is completed runs, which AGENT_RUNS_KEY already
// covers.
export const AGENT_RUNS_KEY = 'sleeper-agent-runs';
export const MAX_STORED_AGENT_RUNS = 20;

export const STORAGE_KEYS = [
  AGENT_RUNS_KEY,
];

const readJson = (storage, key, fallback) => {
  try {
    const raw = storage?.getItem?.(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
};

export function loadAgentRuns(storage = globalThis.localStorage) {
  const runs = readJson(storage, AGENT_RUNS_KEY, []);
  return Array.isArray(runs) ? runs : [];
}

/**
 * Prepend a completed agent-case run and persist it, capped at
 * MAX_STORED_AGENT_RUNS most recent. Returns the updated list so the caller
 * can update its own state without a second read.
 */
export function saveAgentRun(run, storage = globalThis.localStorage) {
  const existing = loadAgentRuns(storage);
  const updated = [run, ...existing].slice(0, MAX_STORED_AGENT_RUNS);
  try {
    storage?.setItem?.(AGENT_RUNS_KEY, JSON.stringify(updated));
  } catch (_) {
    // Storage full or unavailable — the run still rendered this session;
    // only the history entry is lost.
  }
  return updated;
}

export function clearStoredLocalData(storage = globalThis.localStorage) {
  STORAGE_KEYS.forEach(key => {
    try { storage?.removeItem?.(key); } catch (_) {}
  });
}
