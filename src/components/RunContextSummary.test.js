import { describe, expect, it } from 'vitest';
import { targetSummary } from './RunContextSummary';

describe('targetSummary', () => {
  it('describes Sample Replay without a model, since it never uses one', () => {
    expect(targetSummary({ target_type: 'sample' })).toBe('Sample Replay');
  });

  it('names the local model, or flags one is still unselected', () => {
    expect(targetSummary({ target_type: 'local', local_model: 'tinyllama-1.1b' })).toBe('Local — tinyllama-1.1b');
    expect(targetSummary({ target_type: 'local', local_model: null })).toBe('Local — model not selected');
  });

  it('names the provider and model for a live target, or flags one is still unselected', () => {
    expect(targetSummary({ target_type: 'live', provider: 'anthropic', provider_model: 'claude-sonnet-5' }))
      .toBe('Live — anthropic:claude-sonnet-5');
    expect(targetSummary({ target_type: 'live', provider: 'anthropic', provider_model: null }))
      .toBe('Live — anthropic:model not selected');
  });

  it('falls back to the target label, or a not-selected message, for an unrecognized type', () => {
    expect(targetSummary({ target_type: 'unknown', target_label: 'custom:target' })).toBe('custom:target');
    expect(targetSummary({ target_type: 'unknown' })).toBe('Target not selected');
  });

  it('returns an empty string for a missing configuration rather than throwing', () => {
    expect(targetSummary(null)).toBe('');
    expect(targetSummary(undefined)).toBe('');
  });
});
