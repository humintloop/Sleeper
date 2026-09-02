import { describe, expect, it } from 'vitest';
import {
  attachContractIntegrity,
  canonicalJson,
  createRunManifest,
  verifyContractIntegrity,
} from './runProvenance';

describe('canonical run provenance', () => {
  it('canonicalizes object key order recursively', () => {
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
  });

  it('produces stable configuration digests for the same controlled inputs', async () => {
    const input = {
      agentCase: { id: 'CASE', scenario: { user_task: 'x' }, fixtures: [], pii_seeds: {} },
      profile: { id: 'reference', controls: { gate: 'enforce' } },
      advertisedTools: [{ name: 'send_email' }],
      provider: 'generic', targetLabel: 'fixture', maxTurns: 6,
      oracle: 'self_authored', runMode: 'mock_tool_harness', generatedAt: '2026-01-01T00:00:00Z',
    };
    const first = await createRunManifest(input);
    const second = await createRunManifest(input);
    expect(first.configuration_digest).toBe(second.configuration_digest);
    expect(first.manifest_digest).toBe(second.manifest_digest);
  });

  it('distinguishes the execution configuration digest from completed manifest identity', async () => {
    const input = {
      agentCase: { id: 'CASE', scenario: {}, fixtures: [], pii_seeds: {} },
      profile: { id: 'reference', controls: { gate: 'enforce' } },
      advertisedTools: [{ name: 'send_email' }],
      targetType: 'live', provider: 'anthropic', providerModel: 'model-a',
      targetLabel: 'anthropic:model-a', maxTurns: 6, trialCount: 3,
    };
    const first = await createRunManifest({ ...input, generatedAt: '2026-01-01T00:00:00Z' });
    const later = await createRunManifest({ ...input, generatedAt: '2026-01-01T00:01:00Z' });

    expect(first.configuration_digest).toBe(later.configuration_digest);
    expect(first.manifest_digest).not.toBe(later.manifest_digest);
    expect(first.configuration.provider_model).toBe('model-a');
    expect(first.configuration.target_type).toBe('live');
  });
});

describe('honest contract self-digest', () => {
  it('verifies unchanged content and detects accidental mutation', async () => {
    const contract = await attachContractIntegrity({ case_id: 'CASE', verdict: 'INCONCLUSIVE' });
    expect(await verifyContractIntegrity(contract)).toBe(true);
    expect(await verifyContractIntegrity({ ...contract, verdict: 'CONTROL_HELD' })).toBe(false);
    expect(contract.integrity.signed).toBe(false);
    expect(contract.integrity.replay_resistant).toBe(false);
  });
});
