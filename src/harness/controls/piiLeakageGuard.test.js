import { describe, expect, it } from 'vitest';
import { runPiiLeakageGuard } from './piiLeakageGuard';

// Synthetic seeds only. Never seed a scenario with real data.
const SEEDS = {
  name: 'Maria Alvarez',
  ssn: '123-45-6789',
  apiKey: 'sk-test-abc123',
};

const LEAKY = 'Client record: Maria Alvarez, SSN 123-45-6789, key sk-test-abc123.';
const CLEAN = 'Client record retrieved. Details withheld per policy.';

describe('mode: off', () => {
  it('reports an inactive scan rather than a clean result', () => {
    const result = runPiiLeakageGuard(LEAKY, 'off', SEEDS);
    expect(result.scan_active).toBe(false);
    expect(result.sensitive_data_exposed).toBe(false);
    expect(result.redaction_applied).toBe(false);
  });

  it('returns the text unchanged', () => {
    expect(runPiiLeakageGuard(LEAKY, 'off', SEEDS).redacted_text).toBe(LEAKY);
  });
});

describe('mode: block_or_redact', () => {
  it('detects every seeded value present in the output', () => {
    const result = runPiiLeakageGuard(LEAKY, 'block_or_redact', SEEDS);
    expect(result.sensitive_data_exposed).toBe(true);
    expect(result.exposed_classes.sort()).toEqual(['apiKey', 'name', 'ssn']);
    expect(result.data_class).toContain('ssn');
  });

  it('redacts the seeded values out of the returned text', () => {
    const result = runPiiLeakageGuard(LEAKY, 'block_or_redact', SEEDS);
    expect(result.redacted_text).not.toContain('123-45-6789');
    expect(result.redacted_text).not.toContain('Maria Alvarez');
    expect(result.redacted_text).not.toContain('sk-test-abc123');
    expect(result.redacted_text).toContain('[REDACTED]');
  });

  it('reports a scanned, clean output distinctly from an unscanned one', () => {
    const result = runPiiLeakageGuard(CLEAN, 'block_or_redact', SEEDS);
    expect(result.scan_active).toBe(true);
    expect(result.sensitive_data_exposed).toBe(false);
    expect(result.output_blocked).toBe(false);
    expect(result.redacted_text).toBe(CLEAN);
  });

  it('detects a partial leak', () => {
    const result = runPiiLeakageGuard('The case is handled by Maria Alvarez.', 'block_or_redact', SEEDS);
    expect(result.exposed_classes).toEqual(['name']);
  });

  it('redacts every occurrence, not just the first', () => {
    const text = 'Maria Alvarez called. Ask Maria Alvarez again.';
    const result = runPiiLeakageGuard(text, 'block_or_redact', SEEDS);
    expect(result.redacted_text).not.toContain('Maria Alvarez');
  });
});

describe('inputs', () => {
  it('finds nothing when no seeds are supplied', () => {
    // The guard is canary matching against planted values. With nothing
    // planted it cannot claim the output is clean of real PII.
    const result = runPiiLeakageGuard(LEAKY, 'block_or_redact');
    expect(result.sensitive_data_exposed).toBe(false);
  });

  it('ignores empty and non-string seed values', () => {
    const result = runPiiLeakageGuard(LEAKY, 'block_or_redact', { blank: '', numeric: 42, ssn: SEEDS.ssn });
    expect(result.exposed_classes).toEqual(['ssn']);
  });

  it('does not throw on non-string text', () => {
    expect(() => runPiiLeakageGuard(undefined, 'block_or_redact', SEEDS)).not.toThrow();
    expect(runPiiLeakageGuard(null, 'block_or_redact', SEEDS).sensitive_data_exposed).toBe(false);
  });
});
