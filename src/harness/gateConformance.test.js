import { describe, expect, it } from 'vitest';
import { GATE_CONFORMANCE_CASES, runGateConformanceSuite } from './gateConformance';

describe('gate conformance suite', () => {
  it('passes every declared case against the real gate', () => {
    const report = runGateConformanceSuite();
    const failed = report.results.filter(item => !item.passed);
    expect(failed).toEqual([]);
    expect(report.summary).toEqual({ total: GATE_CONFORMANCE_CASES.length, passed: GATE_CONFORMANCE_CASES.length, failed: 0 });
  });

  it('names Sleeper\'s own gate as the claim scope, not any target', () => {
    const report = runGateConformanceSuite();
    expect(report.target).toBe('sleeper_gate_direct');
    expect(report.claim_scope.toLowerCase()).toContain('sleeper');
    expect(report.claim_scope.toLowerCase()).toContain('no target');
  });

  it('detects a real regression rather than always reporting green', () => {
    const brokenCase = {
      id: 'intentionally-wrong-expectation',
      description: 'A case whose expectation cannot be met, to prove the suite can fail.',
      run: () => ({ tool_blocked: false }),
      field: 'tool_blocked',
      expected: true,
    };
    const report = runGateConformanceSuite([brokenCase]);
    expect(report.summary).toEqual({ total: 1, passed: 0, failed: 1 });
    expect(report.results[0].passed).toBe(false);
  });

  it('every case reads a field off the gate\'s own record, not a re-derivation of it', () => {
    for (const testCase of GATE_CONFORMANCE_CASES) {
      const record = testCase.run();
      expect(record).toHaveProperty(testCase.field);
    }
  });
});
