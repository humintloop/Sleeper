import { describe, expect, it } from 'vitest';
import {
  createRunConfiguration,
  diffRunConfigurations,
  deriveAssessmentState,
  configurationDigest,
} from './runConfiguration';

const baseInput = () => ({
  agentCase: { id: 'NR-AGT-001' },
  variant: null,
  profile: {
    id: 'reference',
    controls: {
      toolAuthorization: 'enforce',
      adversarialDetection: 'block_or_constrain',
    },
  },
  targetType: 'live',
  provider: 'anthropic',
  providerModel: 'claude-sonnet-5',
  localModel: null,
  targetLabel: 'anthropic:claude-sonnet-5',
  maxTurns: 6,
  judgeEnabled: true,
  judgeModel: 'judge-model',
  runMode: 'mock_tool_harness',
  trialCount: 3,
  advertisedTools: [
    { name: 'send_email', parameters: { required: ['to'], type: 'object' } },
    { name: 'read_file', parameters: { type: 'object' } },
  ],
});

describe('canonical execution configuration', () => {
  it('captures every execution-relevant control without retaining secrets', () => {
    const config = createRunConfiguration({ ...baseInput(), apiKey: 'must-not-be-recorded' });

    expect(config).toMatchObject({
      schema_version: '1.0.0',
      case_id: 'NR-AGT-001',
      variant_id: null,
      profile_id: 'reference',
      target_type: 'live',
      provider: 'anthropic',
      provider_model: 'claude-sonnet-5',
      max_turns: 6,
      judge: { enabled: true, model_id: 'judge-model' },
      run_mode: 'mock_tool_harness',
      trial_count: 3,
    });
    expect(JSON.stringify(config)).not.toContain('must-not-be-recorded');
    expect(config.advertised_tools).toHaveLength(2);
  });

  it('canonicalizes nested key order and produces a stable digest', async () => {
    const first = createRunConfiguration(baseInput());
    const reordered = createRunConfiguration({
      ...baseInput(),
      profile: {
        controls: {
          adversarialDetection: 'block_or_constrain',
          toolAuthorization: 'enforce',
        },
        id: 'reference',
      },
      advertisedTools: [...baseInput().advertisedTools].reverse().reverse(),
    });

    expect(reordered).toEqual(first);
    expect(await configurationDigest(reordered)).toBe(await configurationDigest(first));
  });

  it.each([
    ['case', { agentCase: { id: 'NR-AGT-002' } }, 'case_id'],
    ['variant', { variant: { id: 'NR-AGT-002-V2' } }, 'variant_id'],
    ['profile', { profile: { id: 'baseline', controls: {} } }, 'profile_id'],
    ['profile controls', { profile: { id: 'reference', controls: { toolAuthorization: 'off' } } }, 'controls.toolAuthorization'],
    ['target type', { targetType: 'local' }, 'target_type'],
    ['provider', { provider: 'openai' }, 'provider'],
    ['provider model', { providerModel: 'gpt-5' }, 'provider_model'],
    ['local model', { localModel: 'local-model' }, 'local_model'],
    ['maximum turns', { maxTurns: 9 }, 'max_turns'],
    ['judge enabled', { judgeEnabled: false }, 'judge.enabled'],
    ['judge model', { judgeModel: 'other-judge' }, 'judge.model_id'],
    ['run mode', { runMode: 'deterministic_replay' }, 'run_mode'],
    ['trial count', { trialCount: 7 }, 'trial_count'],
    ['advertised tools', { advertisedTools: [{ name: 'web_search' }] }, 'advertised_tools'],
  ])('reports a human-readable diff when %s changes', (_label, override, expectedPath) => {
    const before = createRunConfiguration(baseInput());
    const after = createRunConfiguration({ ...baseInput(), ...override });
    const changes = diffRunConfigurations(before, after);

    expect(changes.some(change => change.path === expectedPath)).toBe(true);
    expect(changes.every(change => change.label && 'before' in change && 'after' in change)).toBe(true);
  });
});

describe('derived assessment state', () => {
  const current = createRunConfiguration(baseInput());
  const result = { configuration: current, run: { degraded: false } };

  it('derives idle, running, current, stale, degraded, and error without synchronized flags', () => {
    expect(deriveAssessmentState({ currentConfiguration: current })).toMatchObject({ state: 'idle' });
    expect(deriveAssessmentState({ currentConfiguration: current, running: true, result })).toMatchObject({ state: 'running' });
    expect(deriveAssessmentState({ currentConfiguration: current, result })).toMatchObject({ state: 'current' });
    expect(deriveAssessmentState({
      currentConfiguration: createRunConfiguration({ ...baseInput(), trialCount: 4 }),
      result,
    })).toMatchObject({ state: 'stale', changes: [{ path: 'trial_count' }] });
    expect(deriveAssessmentState({ currentConfiguration: current, result: { ...result, run: { degraded: true } } }))
      .toMatchObject({ state: 'degraded' });
    expect(deriveAssessmentState({ currentConfiguration: current, error: 'failed' })).toMatchObject({ state: 'error' });
  });
});
