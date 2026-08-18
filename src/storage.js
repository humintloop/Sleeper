// Agent-case runs are the only thing this project persists locally now that
// the single-turn probe flow is gone (docs/remove-single-turn-flow.md).
// ACTIVE_CASE_KEY / FINDINGS_KEY / ANALYST_KEY and their probe-shaped fields
// (probeIndex, clusterId, judgeMode, presetId, analyst) were removed with the
// probe flow itself — there is no agent-mode equivalent of "resume a
// half-configured case": AgentCaseRunner is a single self-contained screen,
// and what needs persisting is completed runs, which AGENT_RUNS_KEY already
// covers.
import { canonicalJson, sha256Hex } from './harness/runProvenance.js';

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
function withoutChain(run) {
  if (!run || typeof run !== 'object') return run;
  const { evidenceChain: _evidenceChain, ...payload } = run;
  return payload;
}

async function migrateLegacyRuns(runs) {
  if (runs.length === 0 || runs.some(run => run?.evidenceChain)) return runs;
  let previousDigest = null;
  let sequence = 0;
  const oldestFirst = [];
  for (const run of [...runs].reverse()) {
    sequence += 1;
    const payload = withoutChain(run);
    const recordDigest = await sha256Hex(canonicalJson(payload));
    oldestFirst.push({
      ...payload,
      evidenceChain: {
        version: '1.0.0', sequence, previous_digest: previousDigest,
        record_digest: recordDigest, linked_at: run?.timestamp ?? null,
        signed: false, externally_witnessed: false, migrated_legacy_record: true,
        limitation:
          'Migrated browser-local hash-chain entry. Migration establishes current ordering but cannot prove the record was unchanged before migration.',
      },
    });
    previousDigest = recordDigest;
  }
  return oldestFirst.reverse();
}

export async function saveAgentRun(run, storage = globalThis.localStorage, { now } = {}) {
  const existing = await migrateLegacyRuns(loadAgentRuns(storage));
  const previous = existing[0]?.evidenceChain ?? null;
  const payload = withoutChain(run);
  const recordDigest = await sha256Hex(canonicalJson(payload));
  const chainedRun = {
    ...payload,
    evidenceChain: {
      version: '1.0.0',
      sequence: Number.isInteger(previous?.sequence) ? previous.sequence + 1 : 1,
      previous_digest: previous?.record_digest ?? null,
      record_digest: recordDigest,
      linked_at: now ?? run?.timestamp ?? new Date().toISOString(),
      signed: false,
      externally_witnessed: false,
      limitation:
        'Browser-local hash chain. It can reveal accidental gaps or reordering among retained records, but localStorage can be replaced and the chain recomputed.',
    },
  };
  const updated = [chainedRun, ...existing].slice(0, MAX_STORED_AGENT_RUNS);
  try {
    storage?.setItem?.(AGENT_RUNS_KEY, JSON.stringify(updated));
  } catch (_) {
    // Storage full or unavailable — the run still rendered this session;
    // only the history entry is lost.
  }
  return updated;
}

export async function verifyEvidenceChain(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return { valid: true, status: 'empty', checked: 0, latest_sequence: null, errors: [] };
  }
  if (runs.every(run => !run?.evidenceChain)) {
    return {
      valid: true, status: 'legacy_unverifiable', checked: 0, latest_sequence: null, errors: [],
      limitation: 'These records predate browser hash chaining. They remain readable but their ordering and content cannot be verified.',
    };
  }
  const errors = [];
  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index];
    const chain = run?.evidenceChain;
    if (!chain?.record_digest) {
      errors.push({ index, code: 'CHAIN_METADATA_MISSING' });
      continue;
    }
    const actual = await sha256Hex(canonicalJson(withoutChain(run)));
    if (actual !== chain.record_digest) errors.push({ index, code: 'RECORD_DIGEST_MISMATCH' });

    const older = runs[index + 1]?.evidenceChain;
    if (older) {
      if (chain.previous_digest !== older.record_digest) {
        errors.push({ index, code: 'PREVIOUS_DIGEST_MISMATCH' });
      }
      if (chain.sequence !== older.sequence + 1) {
        errors.push({ index, code: 'SEQUENCE_MISMATCH' });
      }
    }
  }
  const oldest = runs.at(-1)?.evidenceChain;
  return {
    valid: errors.length === 0,
    status: errors.length > 0 ? 'invalid' : oldest?.previous_digest ? 'valid_retained_window' : 'valid_from_origin',
    checked: runs.length,
    latest_sequence: runs[0]?.evidenceChain?.sequence ?? null,
    errors,
    limitation:
      'Verification covers only the retained browser records. It does not prove authorship, prevent replacement of the entire chain, or provide trusted time.',
  };
}

export function clearStoredLocalData(storage = globalThis.localStorage) {
  STORAGE_KEYS.forEach(key => {
    try { storage?.removeItem?.(key); } catch (_) {}
  });
}
