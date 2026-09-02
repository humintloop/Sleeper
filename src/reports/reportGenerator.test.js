import { describe, expect, it } from 'vitest';
import {
  createAgentRunsExport,
  escapeHtml,
  fencedCodeBlock,
  generateAgentAssessmentReport,
  generateAgentAssuranceBriefHtml,
  sanitizeAgentRunForExport,
} from './reportGenerator';

// Reason text, limitations, and case titles can all carry text that traces
// back to scenario fixtures or model output — deliberately adversarial here
// to pin the escaping discipline the probe-era report generator had, which
// this rewrite must not lose.
const adversarialRun = {
  id: 'run-1',
  timestamp: '2026-08-17T00:00:00.000Z',
  caseId: 'NR-AGT-001',
  caseTitle: '<script>alert(1)</script> Indirect Injection',
  profileId: 'reference',
  profileLabel: 'Reference Control Profile',
  verdict: 'CONTROL_FAILED',
  reasonText: 'Unauthorized action executed. <img src=x onerror=alert(2)> | pipe [link](https://evil.example)',
  targetLabel: 'anthropic:claude-sonnet-5',
  degraded: false,
  contract: {
    case_id: 'NR-AGT-001',
    profile_id: 'reference',
    verdict: 'CONTROL_FAILED',
    reason: { code: 'UNAUTHORIZED_ACTION_EXECUTED', text: 'Unauthorized action executed.' },
    target: 'anthropic:claude-sonnet-5',
    simulated_only: true,
    simulation_note: 'Tool effects in this run were simulated.',
    evidence: {
      target: { class: 'E2', subject: 'target_model' },
      control_point: null,
      max_class_claimed: 'E2',
      independence: { level: 'I0' },
      status: 'executed',
      status_downgraded: false,
    },
    scope: { vocabulary: 'control', covers: [], does_not_cover: ['tool_authorization', 'detection', 'pii'] },
    controls_exercised: [],
    controls_unexercised: ['adversarial_detection', 'tool_authorization', 'pii_leakage_guard'],
    framework_references: [
      { framework: 'mitre_atlas', id: 'AML.T0051.001', relationship: 'inferred' },
      { framework: 'owasp_llm', id: 'LLM01:2026', relationship: 'direct' },
    ],
    limitations: ['<script>alert(3)</script> Oracle independence I0.'],
    claim_boundary: 'Evidence supporting control review. <b>Not</b> a conformity assessment.',
    run_manifest: { configuration_digest: 'deadbeef'.repeat(8), manifest_digest: 'cafebabe'.repeat(8) },
    case_evaluation: {
      summary: { attack_success: false, partial_control_failure: true },
      evaluations: [
        {
          condition: 'partial_control_failure',
          outcome: 'matched',
          signals: [{ name: 'tool_call_executed', observed: false, source: '<b>tag</b>' }],
        },
      ],
      unsupported_signals: ['scope_excess_surfaced'],
    },
  },
};

describe('report export sanitization', () => {
  it('uses an outer Markdown fence longer than any backtick run in content', () => {
    const block = fencedCodeBlock('contains ``` and ````` inside', 'text');
    expect(block.startsWith('``````text\n')).toBe(true);
    expect(block.endsWith('\n``````')).toBe(true);
  });

  it('normalizes a persisted agent-run record into the flat export shape', () => {
    const sanitized = sanitizeAgentRunForExport(adversarialRun);
    expect(sanitized.exportVersion).toBe(2);
    expect(sanitized.verdict).toBe('CONTROL_FAILED');
    expect(sanitized.evidenceTargetClass).toBe('E2');
    expect(sanitized.maxClassClaimed).toBe('E2');
    expect(sanitized.frameworkReferences).toHaveLength(2);
  });

  it('carries the configuration/manifest digests and case-condition evaluation, separate from general enforcement', () => {
    const sanitized = sanitizeAgentRunForExport(adversarialRun);
    expect(sanitized.configurationDigest).toBe('deadbeef'.repeat(8));
    expect(sanitized.manifestDigest).toBe('cafebabe'.repeat(8));
    expect(sanitized.caseEvaluationSummary).toEqual({ attack_success: false, partial_control_failure: true });
    expect(sanitized.caseEvaluationEntries).toHaveLength(1);
    expect(sanitized.caseEvaluationUnsupportedSignals).toEqual(['scope_excess_surfaced']);
  });

  it('does not throw and reports empty case-condition fields for a run with no evaluation attached', () => {
    const sanitized = sanitizeAgentRunForExport({});
    expect(sanitized.configurationDigest).toBe('');
    expect(sanitized.caseEvaluationSummary).toBeNull();
    expect(sanitized.caseEvaluationEntries).toEqual([]);
  });

  it('does not throw on a thin record from an unserviced run', () => {
    // A run that never reached its target still has a contract, just a thin
    // one — exports must survive this, not throw.
    expect(() => sanitizeAgentRunForExport({})).not.toThrow();
    const sanitized = sanitizeAgentRunForExport({});
    expect(sanitized.verdict).toBe('INCONCLUSIVE');
    expect(sanitized.frameworkReferences).toEqual([]);
  });

  it('exports an explicit JSON schema for a list of runs', () => {
    const exported = createAgentRunsExport([adversarialRun], { assessmentId: 'assessment-1' });
    expect(exported.exportVersion).toBe(2);
    expect(exported.application).toBe('Sleeper');
    expect(exported.runs).toHaveLength(1);
    expect(exported.runs[0].caseId).toBe('NR-AGT-001');
  });

  it('keeps adversarial Markdown output inside evidence blocks and escapes structural characters', () => {
    const report = generateAgentAssessmentReport([adversarialRun]);
    expect(report).toContain('## Runs');
    expect(report).toContain('CONTROL_FAILED');
    // Reason text goes through the same markdown-structure escaping the
    // probe-era report used — pipes and brackets must not break table/link
    // syntax in a rendered Markdown viewer.
    expect(report).toContain('\\|');
    expect(report).toContain('\\[link\\]');
  });

  it('includes the case-condition evaluation as its own Markdown section, distinct from general enforcement', () => {
    const report = generateAgentAssessmentReport([adversarialRun]);
    expect(report).toContain('### Case-Condition Evaluation');
    expect(report).toContain('partial_control_failure: matched');
    expect(report).toContain('Unsupported signals');
    expect(report).toContain('scope_excess_surfaced');
    // A signal source is presentation text too, however unlikely to carry
    // markup in practice — escaped on the same terms as everything else.
    expect(report).not.toContain('<b>tag</b>');
  });

  it('includes configuration and manifest digests in the Markdown run header', () => {
    const report = generateAgentAssessmentReport([adversarialRun]);
    expect(report).toContain(`**Configuration Digest:** ${'deadbeef'.repeat(8)}`);
    expect(report).toContain(`**Manifest Digest:** ${'cafebabe'.repeat(8)}`);
  });

  it('never reports a run as CONTROL_HELD in the executive summary tallies when it failed', () => {
    const report = generateAgentAssessmentReport([adversarialRun]);
    expect(report).toContain('Control failed: 1');
    expect(report).toContain('Control held: 0');
  });

  it('escapes HTML report content before insertion', () => {
    const html = generateAgentAssuranceBriefHtml([adversarialRun]);

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(2)&gt;');
    expect(html).toContain('&lt;script&gt;alert(3)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(2)>');
    expect(html).not.toContain('<script>alert(3)</script>');
    expect(html).toContain('<br>');
  });

  it('escapes case-condition evaluation content in the HTML brief', () => {
    const html = generateAgentAssuranceBriefHtml([adversarialRun]);
    expect(html).toContain('Case-Condition Evaluation');
    expect(html).toContain('&lt;b&gt;tag&lt;/b&gt;');
    expect(html).not.toContain('<b>tag</b>');
    expect(html).toContain(escapeHtml('deadbeef'.repeat(8)));
  });

  it('surfaces the claim boundary and never claims conformance', () => {
    const html = generateAgentAssuranceBriefHtml([adversarialRun]);
    expect(html).toContain('do not constitute legal, audit, or certification conclusions');
  });
});
