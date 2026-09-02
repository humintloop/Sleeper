import { describe, expect, it } from 'vitest';
import { findMaterialDifferences } from './ComparisonStoryPanel';

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
