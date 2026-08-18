function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().flatMap(key =>
        value[key] === undefined ? [] : [[key, canonicalize(value[key])]]
      )
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export async function sha256Hex(value) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : canonicalJson(value));
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function sourceRevision() {
  return import.meta.env?.VITE_GIT_COMMIT || 'unrecorded';
}

function sourceDirty() {
  return typeof import.meta.env?.VITE_GIT_DIRTY === 'boolean'
    ? import.meta.env.VITE_GIT_DIRTY
    : null;
}

export async function createRunManifest({
  agentCase,
  profile,
  advertisedTools,
  provider,
  targetLabel,
  maxTurns,
  oracle,
  runMode,
  variant,
  secondaryOracle,
  generatedAt,
} = {}) {
  const caseSnapshot = {
    id: agentCase?.id ?? null,
    scenario: agentCase?.scenario ?? null,
    fixtures: (agentCase?.fixtures ?? []).map(fixture => ({
      id: fixture.id,
      delivery: fixture.delivery,
      delivery_tool: fixture.delivery_tool,
      content: fixture.content,
    })),
    pii_seeds: agentCase?.pii_seeds ?? {},
  };
  const configuration = {
    case_id: agentCase?.id ?? null,
    profile_id: profile?.id ?? null,
    controls: profile?.controls ?? {},
    provider: provider ?? null,
    target: targetLabel ?? null,
    max_turns: maxTurns ?? 6,
    oracle: oracle ?? 'self_authored',
    run_mode: runMode,
    variant_id: variant?.id ?? null,
    advertised_tools: advertisedTools ?? [],
    generation_parameters: {
      temperature: null,
      seed: null,
      provider_defaults_used: true,
    },
    secondary_oracle: secondaryOracle ?? null,
  };
  const manifest = {
    manifest_version: '1.0.0',
    generated_at: generatedAt ?? new Date().toISOString(),
    source_revision: sourceRevision(),
    source_dirty: sourceDirty(),
    case_digest: await sha256Hex(caseSnapshot),
    profile_digest: await sha256Hex({ id: profile?.id ?? null, controls: profile?.controls ?? {} }),
    tool_schema_digest: await sha256Hex(advertisedTools ?? []),
    configuration_digest: await sha256Hex(configuration),
    configuration,
  };
  return {
    ...manifest,
    manifest_digest: await sha256Hex(manifest),
  };
}

export async function attachContractIntegrity(contract) {
  const digest = await sha256Hex(contract);
  return {
    ...contract,
    integrity: {
      scheme: digest ? 'sha256-self-digest' : 'unavailable',
      digest,
      signed: false,
      authenticity: 'none',
      replay_resistant: false,
      limitation:
        'This unsigned self-digest can detect accidental modification only. Same-origin code or a user can replace the record and recompute the digest; it is not tamper-proof or non-repudiable evidence.',
    },
  };
}

export async function verifyContractIntegrity(contract) {
  if (!contract?.integrity?.digest) return false;
  const { integrity: _integrity, ...payload } = contract;
  return (await sha256Hex(payload)) === contract.integrity.digest;
}
