import { canonicalJson, sha256Hex } from './runProvenance.js';

export const RUN_CONFIGURATION_VERSION = '1.0.0';

const FIELD_LABELS = {
  case_id: 'Case',
  variant_id: 'Variant',
  profile_id: 'Control profile',
  controls: 'Profile controls',
  target_type: 'Target type',
  provider: 'Provider',
  provider_model: 'Provider model',
  local_model: 'Local model',
  target_label: 'Target identity',
  max_turns: 'Maximum turns',
  judge: 'Secondary judge',
  run_mode: 'Run mode',
  trial_count: 'Trial count',
  advertised_tools: 'Advertised tools',
};

function canonicalSnapshot(value) {
  return JSON.parse(canonicalJson(value));
}

/**
 * Build the one secret-free snapshot used by the UI, run manifest, completed
 * result, comparison members, trial summaries, and persisted history.
 */
export function createRunConfiguration({
  agentCase,
  variant = null,
  profile,
  targetType = null,
  provider = null,
  providerModel = null,
  localModel = null,
  targetLabel = null,
  maxTurns = 6,
  judgeEnabled = false,
  judgeModel = null,
  secondaryOracle = null,
  runMode = null,
  trialCount = 1,
  advertisedTools = [],
} = {}) {
  return canonicalSnapshot({
    schema_version: RUN_CONFIGURATION_VERSION,
    case_id: agentCase?.id ?? agentCase ?? null,
    variant_id: variant?.id ?? variant ?? null,
    profile_id: profile?.id ?? profile ?? null,
    controls: profile?.controls ?? {},
    target_type: targetType,
    provider,
    provider_model: providerModel,
    local_model: localModel,
    target_label: targetLabel,
    max_turns: maxTurns ?? 6,
    judge: {
      enabled: judgeEnabled === true,
      model_id: judgeEnabled === true ? (judgeModel ?? null) : null,
    },
    secondary_oracle: secondaryOracle,
    run_mode: runMode,
    trial_count: trialCount ?? 1,
    advertised_tools: advertisedTools ?? [],
  });
}

export function configurationDigest(configuration) {
  return sha256Hex(configuration);
}

function displayValue(value) {
  if (value === undefined) return '(missing)';
  if (value === null) return '(none)';
  if (typeof value === 'object') return canonicalJson(value);
  return String(value);
}

function collectDiff(before, after, path, changes) {
  if (canonicalJson(before) === canonicalJson(after)) return;
  const bothObjects = before && after && typeof before === 'object' && typeof after === 'object';
  if (bothObjects && !Array.isArray(before) && !Array.isArray(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    keys.forEach(key => collectDiff(before[key], after[key], path ? `${path}.${key}` : key, changes));
    return;
  }
  const root = path.split('.')[0];
  changes.push({
    path,
    label: FIELD_LABELS[root] ?? path,
    before: displayValue(before),
    after: displayValue(after),
  });
}

export function diffRunConfigurations(before = null, after = null) {
  const changes = [];
  collectDiff(before ?? {}, after ?? {}, '', changes);
  return changes.filter(change => change.path !== 'schema_version');
}

export function configurationsEqual(before, after) {
  return canonicalJson(before ?? null) === canonicalJson(after ?? null);
}

/** Derive the visible state; callers do not maintain a parallel stale flag. */
export function deriveAssessmentState({
  currentConfiguration,
  result = null,
  running = false,
  error = null,
} = {}) {
  if (running) return { state: 'running', changes: [], degraded: false, message: 'Assessment is running.' };
  if (error && !result) return { state: 'error', changes: [], degraded: false, message: `Assessment error: ${error}` };
  if (!result) return { state: 'idle', changes: [], degraded: false, message: 'No completed assessment.' };

  const resultConfiguration = result.configuration ?? result.contract?.run_manifest?.configuration ?? null;
  const changes = diffRunConfigurations(resultConfiguration, currentConfiguration);
  const degraded = result.run?.degraded === true || result.contract?.limitations?.some(note =>
    typeof note === 'string' && /degrad/i.test(note)
  ) === true;
  if (changes.length > 0) {
    return {
      state: 'stale', changes, degraded,
      message: `Historical result: ${changes.length} execution setting${changes.length === 1 ? '' : 's'} changed.`,
    };
  }
  if (degraded) {
    return { state: 'degraded', changes: [], degraded: true, message: 'Current result completed through a degraded path.' };
  }
  if (error) return { state: 'error', changes: [], degraded: false, message: `Assessment error: ${error}` };
  return { state: 'current', changes: [], degraded: false, message: 'Displayed result matches the current configuration.' };
}
