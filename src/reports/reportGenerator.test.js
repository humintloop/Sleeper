import { describe, expect, it } from 'vitest';
import { createFindingsExport, fencedCodeBlock, generateAssessmentReport, generateAuditBriefHtml, sanitizeFindingForExport } from './reportGenerator';

const adversarialFinding = {
  id: 'f-1',
  runId: 'run-1',
  caseFileId: 'AI-CASE',
  systemUnderTest: '<img src=x onerror=alert(1)>',
  promptHash: 'abc123',
  victimPromptPreview: 'SECRET TARGET PROMPT',
  internalRuntimeObject: { shouldNotExport: true },
  payloadName: '# Payload heading | table',
  payload: 'normal payload\n```\n# escaped?\n`````\n[click](https://evil.example)',
  responseExcerpt: 'short excerpt',
  responseFull: 'model output\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n# model heading\n| pipe | value |\n`````',
  verdict: 'SUCCESS',
  reviewerDecision: 'CONFIRMED',
  reviewerNotes: '<script>alert(2)</script>',
  evalReason: 'reason with | pipes and [link](https://evil.example)',
  judgeReason: '<img src=x onerror=alert(3)>',
  techniqueId: 'AML.T0051.000',
  techniqueName: '<script>technique()</script>',
  mappedControls: ['LLM-SEC-001'],
  nistAiRmf: ['MAP 1.1 <script>x</script>'],
  retestGuidance: ['rerun <img src=x onerror=alert(4)>'],
};

describe('report export sanitization', () => {
  it('uses an outer Markdown fence longer than any backtick run in content', () => {
    const block = fencedCodeBlock('contains ``` and ````` inside', 'text');
    expect(block.startsWith('``````text\n')).toBe(true);
    expect(block.endsWith('\n``````')).toBe(true);
  });

  it('exports an explicit JSON schema without prompt previews or unexpected internal fields', () => {
    const exported = createFindingsExport([adversarialFinding], { assessmentId: 'assessment-1' });
    const json = JSON.stringify(exported);

    expect(exported.exportVersion).toBe(1);
    expect(exported.application).toBe('SLEEPER');
    expect(exported.findings[0].promptHash).toBe('abc123');
    expect(exported.findings[0].promptHashAlgorithm).toBe('SHA-256');
    expect(exported.findings[0].victimPromptPreview).toBeUndefined();
    expect(exported.findings[0].internalRuntimeObject).toBeUndefined();
    expect(json).not.toContain('SECRET TARGET PROMPT');
  });

  it('sanitizes legacy findings before export', () => {
    const sanitized = sanitizeFindingForExport(adversarialFinding);
    expect(sanitized.victimPromptPreview).toBeUndefined();
    expect(sanitized.response).toContain('<script>alert(1)</script>');
    expect(sanitized.promptHashAlgorithm).toBe('SHA-256');
  });

  it('keeps adversarial Markdown output inside evidence blocks', () => {
    const report = generateAssessmentReport([adversarialFinding]);
    expect(report).toContain('``````text\n');
    expect(report).toContain('<script>alert(1)</script>');
    expect(report).not.toContain('SECRET TARGET PROMPT');
    expect(report).not.toContain('**System Under Test:** <img src=x onerror=alert(1)>');
    expect(report).toContain('**System Under Test:** &lt;img src=x onerror=alert\\(1\\)&gt;');
    expect(report).toContain('## Active Findings');
    expect(report).toContain('### Stored Full Response');
  });

  it('escapes HTML report content before insertion', () => {
    const html = generateAuditBriefHtml([adversarialFinding]);

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;technique()&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('<br>');
  });
});
