import { describe, expect, it } from 'vitest';
import { findMaterialDifferences, summarizeControlDelta } from './ComparisonStoryPanel';

const PROFILE_ORDER = ['baseline', 'partial', 'reference'];

const outcome = (verdict, { blocked = false, evidenceClass = 'E1', caseSummary = null } = {}) => ({
  verdict: { verdict },
  run: {
    events: blocked
      ? [{ type: 'authorization_decision', blocked: true }]
      : [{ type: 'authorization_decision', blocked: false }],
  },
  contract: {
    evidence: { max_class_claimed: evidenceClass },
    case_evaluation: caseSummary ? { summary: caseSummary } : null,
  },
});

describe('findMaterialDifferences', () => {
  it('reports no differences when every present profile agrees on everything tracked', () => {
    const results = {
      baseline: outcome('CONTROL_FAILED'),
      reference: outcome('CONTROL_FAILED'),
    };
    expect(findMaterialDifferences(results, PROFILE_ORDER)).toEqual([]);
  });

  it('flags a verdict difference by name, not just by existence', () => {
    const results = {
      baseline: outcome('CONTROL_FAILED'),
      reference: outcome('CONTROL_HELD'),
    };
    const differences = findMaterialDifferences(results, PROFILE_ORDER);
    expect(differences.some(line => line.includes('Verdict differs'))).toBe(true);
    expect(differences.some(line => line.includes('baseline → CONTROL_FAILED'))).toBe(true);
    expect(differences.some(line => line.includes('reference → CONTROL_HELD'))).toBe(true);
  });

  it('flags a gate-decision difference independent of verdict wording', () => {
    const results = {
      baseline: outcome('CONTROL_FAILED', { blocked: false }),
      reference: outcome('PARTIAL_CONTROL_FAILURE', { blocked: true }),
    };
    const differences = findMaterialDifferences(results, PROFILE_ORDER);
    expect(differences.some(line => line.includes('Gate decision differs'))).toBe(true);
  });

  it('flags an evidence-class difference even when the verdict word is the same', () => {
    const results = {
      baseline: outcome('PARTIAL_CONTROL_FAILURE', { evidenceClass: 'E1' }),
      reference: outcome('PARTIAL_CONTROL_FAILURE', { evidenceClass: 'E3' }),
    };
    const differences = findMaterialDifferences(results, PROFILE_ORDER);
    expect(differences.some(line => line.includes('Evidence class claimed differs'))).toBe(true);
  });

  it('flags a case-condition evaluation outcome difference', () => {
    const results = {
      baseline: outcome('PARTIAL_CONTROL_FAILURE', { caseSummary: { attack_success: false, partial_control_failure: true } }),
      reference: outcome('PARTIAL_CONTROL_FAILURE', { caseSummary: { attack_success: false, partial_control_failure: null } }),
    };
    const differences = findMaterialDifferences(results, PROFILE_ORDER);
    expect(differences.some(line => line.includes('Case-condition evaluation outcome differs'))).toBe(true);
  });

  it('ignores profiles that have not been run yet rather than treating "no result" as a difference by itself', () => {
    const results = { baseline: outcome('CONTROL_FAILED') };
    expect(findMaterialDifferences(results, PROFILE_ORDER)).toEqual([]);
  });
});

describe('summarizeControlDelta', () => {
  const results = verdicts => Object.fromEntries(
    Object.entries(verdicts).map(([id, [verdict, blocked]]) => [id, outcome(verdict, { blocked })]),
  );

  it('returns nothing when fewer than two profiles have run', () => {
    expect(summarizeControlDelta(results({ baseline: ['CONTROL_FAILED', false] }), PROFILE_ORDER)).toBeNull();
    expect(summarizeControlDelta({}, PROFILE_ORDER)).toBeNull();
  });

  it('reports a verdict change when the profiles disagree on the verdict', () => {
    const delta = summarizeControlDelta(results({
      baseline: ['CONTROL_FAILED', false],
      reference: ['CONTROL_HELD', true],
    }), PROFILE_ORDER);
    expect(delta.verdictChanged).toBe(true);
    expect(delta.gateChanged).toBe(true);
    expect(delta.headline).toMatch(/both the gate decision and the verdict/);
  });

  it('separates a gate-only change from a verdict change', () => {
    const delta = summarizeControlDelta(results({
      baseline: ['PARTIAL_CONTROL_FAILURE', false],
      reference: ['PARTIAL_CONTROL_FAILURE', true],
    }), PROFILE_ORDER);
    expect(delta.verdictChanged).toBe(false);
    expect(delta.gateChanged).toBe(true);
    expect(delta.changed).toBe(true);
    expect(delta.headline).toMatch(/same verdict/);
  });

  it('says so plainly when the control profile changed nothing observable', () => {
    const delta = summarizeControlDelta(results({
      baseline: ['CONTROL_FAILED', false],
      partial: ['CONTROL_FAILED', false],
      reference: ['CONTROL_FAILED', false],
    }), PROFILE_ORDER);
    expect(delta.changed).toBe(false);
    expect(delta.headline).toMatch(/No profile differed/);
  });

  it('never states an outcome as a property of the controls themselves', () => {
    // CLAUDE.md: output is evidence for review, not a conformance claim. The
    // headline may say what this run did; it may not say controls "work".
    const all = ['CONTROL_FAILED', 'CONTROL_HELD', 'PARTIAL_CONTROL_FAILURE'].map((verdict, index) =>
      summarizeControlDelta(results({
        baseline: ['CONTROL_FAILED', false],
        reference: [verdict, index % 2 === 0],
      }), PROFILE_ORDER).headline);
    for (const headline of all) {
      expect(headline).not.toMatch(/effective|compliant|prevents|protects|secure/i);
    }
  });
});
