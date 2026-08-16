import { describe, it, expect } from 'vitest';
import {
  FRAMEWORK_REFERENCES,
  FRAMEWORK_VERSIONS,
  OWASP_PUBLISHED_CROSSWALK,
  getOwaspPublishedCrosswalk,
} from './frameworkMappings';
import { TECHNIQUES } from '../payloads';

// These tests guard the framework migration performed on 2026-08-16. They are
// consistency checks against docs/source-ledger.md, not assertions that the
// mappings are correct — correctness is a source-review question.

describe('OWASP edition consistency', () => {
  it('carries no 2025-edition IDs in the reference table', () => {
    const stale = Object.keys(FRAMEWORK_REFERENCES.owasp).filter(id => id.endsWith(':2025'));
    expect(stale).toEqual([]);
  });

  it('tags every probe technique with a 2026-edition OWASP ID', () => {
    const ids = Object.values(TECHNIQUES).map(t => t.owasp);
    expect(ids.length).toBeGreaterThan(0);
    ids.forEach(id => expect(id).toMatch(/^LLM\d{2}:2026$/));
  });

  it('resolves every technique OWASP ID against the reference table', () => {
    Object.values(TECHNIQUES).forEach(technique => {
      expect(FRAMEWORK_REFERENCES.owasp[technique.owasp]).toBeTruthy();
    });
  });

  it('pins a version for every framework the app asserts', () => {
    ['owasp_llm', 'owasp_asi', 'mitre_atlas', 'nist_ai_rmf', 'iso_42001', 'eu_ai_act', 'aiuc_1']
      .forEach(key => expect(FRAMEWORK_VERSIONS[key]).toBeTruthy());
  });
});

describe('ATLAS technique naming', () => {
  it('uses the current ATLAS name for AML.T0054', () => {
    // Renamed from "LLM Jailbreaking" in ATLAS content v2026.07.
    expect(TECHNIQUES['AML.T0054'].name).toBe('LLM Jailbreak');
    expect(FRAMEWORK_REFERENCES.mitre_atlas['AML.T0054']).toBe('LLM Jailbreak');
  });

  it('registers the agent-layer techniques the agent module maps to', () => {
    ['AML.T0053', 'AML.T0086', 'AML.T0101', 'AML.T0110', 'AML.T0110.000', 'AML.T0084.001']
      .forEach(id => expect(FRAMEWORK_REFERENCES.mitre_atlas[id]).toBeTruthy());
  });
});

describe('OWASP-published crosswalk', () => {
  it('references only ASI IDs that exist in the ASI reference table', () => {
    Object.values(OWASP_PUBLISHED_CROSSWALK).forEach(entry => {
      entry.asi.forEach(id => expect(FRAMEWORK_REFERENCES.owasp_asi[id]).toBeTruthy());
    });
  });

  it('is keyed only by 2026-edition OWASP LLM IDs present in the reference table', () => {
    Object.keys(OWASP_PUBLISHED_CROSSWALK).forEach(id => {
      expect(FRAMEWORK_REFERENCES.owasp[id]).toBeTruthy();
    });
  });

  it('uses well-formed ATLAS tactic IDs, not technique IDs', () => {
    Object.values(OWASP_PUBLISHED_CROSSWALK).forEach(entry => {
      entry.atlas_tactics_primary.forEach(id => expect(id).toMatch(/^AML\.TA\d{4}$/));
    });
  });

  it('returns null for an unmapped ID rather than throwing', () => {
    expect(getOwaspPublishedCrosswalk('LLM07:2026')).toBeNull();
    expect(getOwaspPublishedCrosswalk(undefined)).toBeNull();
  });

  it('maps Excessive Agency to the agentic tool-misuse and approval entries', () => {
    const excessiveAgency = getOwaspPublishedCrosswalk('LLM03:2026');
    expect(excessiveAgency.asi).toContain('ASI02');
    expect(excessiveAgency.asi).toContain('ASI09');
  });
});
