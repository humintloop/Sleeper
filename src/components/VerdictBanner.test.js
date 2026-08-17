import { describe, expect, it } from 'vitest';
import { getVerdictColor, getVerdictLabel, verdictDisplay } from './VerdictBanner';

const C = {
  red: '#DC4838', amber: '#C87844', teal: '#00CFC4', blue: '#6D8FD6',
  green: '#4EBA6F', ochre: '#B99242', slate: '#6B7A99', text3: '#68738A',
};

describe('two vocabularies, one lookup table', () => {
  it('carries both the probe and control vocabularies', () => {
    expect(Object.keys(verdictDisplay).sort()).toEqual([
      'CONTROL_FAILED', 'CONTROL_HELD', 'FAILED', 'FAILURE', 'INCONCLUSIVE',
      'PARTIAL', 'PARTIAL_CONTROL_FAILURE', 'REVIEW', 'SUCCESS',
    ].sort());
  });

  it('labels every control-vocabulary verdict distinctly from the probe vocabulary', () => {
    expect(getVerdictLabel('CONTROL_HELD')).toBe('CONTROL HELD');
    expect(getVerdictLabel('CONTROL_FAILED')).toBe('CONTROL FAILED');
    expect(getVerdictLabel('PARTIAL_CONTROL_FAILURE')).toBe('PARTIAL CONTROL FAILURE');
    expect(getVerdictLabel('INCONCLUSIVE')).toBe('INCONCLUSIVE');
    // Never reuses a probe label — the shared word "HELD" appears, but never
    // as the identical label string, since that is exactly the collision
    // docs/coherence-review.md (U4) flagged.
    expect(getVerdictLabel('CONTROL_HELD')).not.toBe(getVerdictLabel('FAILURE'));
  });

  it('is case-insensitive and falls back to the raw string for an unknown verdict', () => {
    expect(getVerdictLabel('control_held')).toBe('CONTROL HELD');
    expect(getVerdictLabel('SOMETHING_ELSE')).toBe('SOMETHING_ELSE');
    expect(getVerdictLabel(undefined)).toBe('UNKNOWN');
  });

  it('resolves a distinct color per control verdict, matching the reserved verdict palette', () => {
    expect(getVerdictColor('CONTROL_HELD', C)).toBe(C.green);
    expect(getVerdictColor('PARTIAL_CONTROL_FAILURE', C)).toBe(C.ochre);
    expect(getVerdictColor('CONTROL_FAILED', C)).toBe(C.red);
    expect(getVerdictColor('INCONCLUSIVE', C)).toBe(C.slate);
  });

  it('falls back to a neutral color for an unmapped verdict rather than throwing', () => {
    expect(getVerdictColor('NOT_A_VERDICT', C)).toBe(C.text3);
  });
});
