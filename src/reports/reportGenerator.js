import { ASSURANCE_PROFILE, CONTROL_SET, CONTROL_SET_VERSION, FRAMEWORK_MAPPING_VERSION, FRAMEWORK_REFERENCES, getMappedControls } from '../data/frameworkMappings';
import { getMitigationMapping, MITIGATION_SET_VERSION } from '../data/mitigationMappings';

export const FINDINGS_EXPORT_VERSION = 1;

const truncate = (value = '', max = 1800) => {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const arrayOfStrings = (items = []) => Array.isArray(items) ? items.map(item => String(item || '')) : [];
const plain = (value = '') => String(value ?? '');
const markdownText = (value = '') => plain(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeMarkdownStructure = (value = '') => markdownText(value).replace(/([\\[\]()#|])/g, '\\$1');
const inline = (value = '', fallback = 'Not recorded') => {
  const text = plain(value).replace(/[\r\n|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? escapeMarkdownStructure(text) : fallback;
};
const bulletText = (value = '') => escapeMarkdownStructure(value).replace(/\r?\n/g, ' ');

export const escapeHtml = (value = '') => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export function fencedCodeBlock(content, language = '') {
  const text = plain(content);
  const runs = text.match(/`+/g) || [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  const lang = language ? String(language).replace(/[^\w-]/g, '') : '';
  return `${fence}${lang}\n${text}\n${fence}`;
}

const list = (items = []) => {
  const safeItems = arrayOfStrings(items).filter(Boolean);
  return safeItems.length ? safeItems.map(item => `- ${bulletText(item)}`).join('\n') : '- None recorded';
};

const section = (title, value) => {
  const text = escapeMarkdownStructure(value).trim();
  return text ? `### ${inline(title, 'Section')}\n${text}\n\n` : '';
};

const controlList = (ids = []) => {
  const controls = getMappedControls(ids);
  return controls.length
    ? controls.map(c => `- ${bulletText(c.id)} - ${bulletText(c.name)}: ${bulletText(c.objective)}`).join('\n')
    : '- None mapped';
};

const mitigationReferenceList = (items = []) => items.length
  ? items.map(item => `- ${bulletText(item.source)}: ${bulletText(item.id)} - ${bulletText(item.name)}`).join('\n')
  : '- None mapped';

const frameworkList = (finding = {}) => {
  const lines = [];
  if (finding.techniqueId) lines.push(`- MITRE ATLAS: ${finding.techniqueId} - ${finding.techniqueName || FRAMEWORK_REFERENCES.mitre_atlas[finding.techniqueId] || 'Mapped technique'}`);
  if (finding.owasp) lines.push(`- OWASP LLM Top 10: ${finding.owasp} - ${FRAMEWORK_REFERENCES.owasp[finding.owasp] || 'Mapped risk category'}`);
  (finding.nistAiRmf || finding.nist_ai_rmf || []).forEach(fn => lines.push(`- NIST AI RMF: ${fn}`));
  (finding.iso42001Relevance || finding.iso_42001_relevance || []).forEach(clause => lines.push(`- ISO/IEC 42001 relevance: ${clause} - ${FRAMEWORK_REFERENCES.iso_42001[clause] || 'Relevant AI management system performance-evaluation evidence'}`));
  (finding.euAiActRelevance || finding.eu_ai_act_relevance || []).forEach(article => lines.push(`- EU AI Act readiness relevance (${finding.euAiActScope || finding.eu_ai_act_scope || ASSURANCE_PROFILE.eu_ai_act_scope.default_status}): ${article} - ${FRAMEWORK_REFERENCES.eu_ai_act[article] || 'Relevant obligation if system is in scope'}`));
  return lines.length ? lines.join('\n') : '- None mapped';
};

const sanitizeSettings = (settings) => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
  return {
    temperature: settings.temperature,
    max_tokens: settings.max_tokens,
  };
};

export function sanitizeFindingForExport(finding = {}) {
  const controls = finding.selectedControlIds || finding.mappedControls || finding.mapped_controls || [];
  return {
    exportVersion: FINDINGS_EXPORT_VERSION,
    id: finding.id || finding.runId || '',
    runId: finding.runId || finding.id || '',
    findingId: finding.findingId || finding.id || '',
    timestamp: finding.timestamp || '',
    caseFileId: finding.caseFileId || '',
    analyst: finding.analyst || 'unassigned',
    systemUnderTest: finding.systemUnderTest || '',
    promptHash: finding.promptHash || '',
    promptHashAlgorithm: finding.promptHash ? 'SHA-256' : '',
    selectedControlIds: arrayOfStrings(finding.selectedControlIds || []),
    mappedControls: arrayOfStrings(controls),
    assessmentProfile: finding.assessmentProfile || '',
    assessmentProfileLabel: finding.assessmentProfileLabel || '',
    assessmentProfileScope: finding.assessmentProfileScope || '',
    caseSchemaVersion: finding.caseSchemaVersion || finding.case_schema_version || '',
    frameworkMappingVersion: finding.frameworkMappingVersion || '',
    techniqueId: finding.techniqueId || '',
    techniqueName: finding.techniqueName || '',
    owasp: finding.owasp || '',
    caseId: finding.caseId || finding.payloadId || '',
    caseVersion: finding.caseVersion || finding.case_version || '',
    payloadName: finding.payloadName || finding.caseName || '',
    caseDescription: finding.caseDescription || finding.description || '',
    category: finding.category || '',
    objective: finding.objective || '',
    expectedSecureBehavior: finding.expectedSecureBehavior || finding.expected_secure_behavior || '',
    failureMode: finding.failureMode || finding.failure_mode || '',
    successCriteria: finding.successCriteria || finding.success_criteria || '',
    evidenceRequirements: arrayOfStrings(finding.evidenceRequirements || finding.evidence_requirements || []),
    reviewGuidance: finding.reviewGuidance || finding.review_guidance || '',
    severityBaseline: finding.severityBaseline || finding.severity_baseline || '',
    payload: finding.payloadFull || finding.payload || '',
    victimModel: finding.victimModel || '',
    victimModelSettings: sanitizeSettings(finding.victimModelSettings),
    victimRuntime: finding.victimRuntime || '',
    response: finding.responseFull || finding.response || '',
    responseExcerpt: finding.responseExcerpt || finding.evidenceExcerpt || finding.response || '',
    verdict: finding.verdict || 'REVIEW',
    finalVerdictSource: finding.finalVerdictSource || '',
    reviewStatus: finding.reviewStatus || '',
    reviewerDecision: finding.reviewerDecision || finding.reviewer_decision || 'UNREVIEWED',
    reviewerNotes: finding.reviewerNotes || finding.notes || '',
    reviewerReviewedAt: finding.reviewerReviewedAt || finding.reviewer_reviewed_at || '',
    controlGapStatement: finding.controlGapStatement || '',
    effectivenessAssessment: finding.effectivenessAssessment || finding.effectiveness_assessment || '',
    evaluationDisagreement: Boolean(finding.evaluationDisagreement),
    evaluationNote: finding.evaluationNote || '',
    heuristicVerdict: finding.heuristicVerdict || '',
    heuristicLabel: finding.heuristicLabel || '',
    evalReason: finding.evalReason || '',
    judgeVerdict: finding.judgeVerdict || null,
    judgeModel: finding.judgeModel || null,
    judgeModelSettings: sanitizeSettings(finding.judgeModelSettings),
    judgeReason: finding.judgeReason || finding.judgeRationale || null,
    nistAiRmf: arrayOfStrings(finding.nistAiRmf || finding.nist_ai_rmf || []),
    euAiActRelevance: arrayOfStrings(finding.euAiActRelevance || finding.eu_ai_act_relevance || []),
    euAiActScope: finding.euAiActScope || finding.eu_ai_act_scope || '',
    iso42001Relevance: arrayOfStrings(finding.iso42001Relevance || finding.iso_42001_relevance || []),
    readinessProfile: finding.readinessProfile || finding.readiness_profile || '',
    readinessGaps: arrayOfStrings(finding.readinessGaps || finding.readiness_gaps || []),
    officialMitigations: finding.officialMitigations || finding.official_mitigations || [],
    recommendedMitigations: arrayOfStrings(finding.recommendedMitigations || finding.recommended_mitigations || []),
    retestGuidance: arrayOfStrings(finding.retestGuidance || finding.retest_guidance || []),
  };
}

export function createFindingsExport(findings = [], metadata = {}) {
  return {
    exportVersion: FINDINGS_EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    application: 'NETRUNNER',
    assessmentId: metadata.assessmentId || null,
    findings: findings.map(sanitizeFindingForExport),
  };
}

export function buildFindingMarkdown(rawFinding) {
  const finding = sanitizeFindingForExport(rawFinding);
  const controls = finding.selectedControlIds.length ? finding.selectedControlIds : finding.mappedControls;
  const mitigation = getMitigationMapping(finding.techniqueId);
  const officialMitigations = finding.officialMitigations?.length ? finding.officialMitigations : mitigation.official_mitigations || [];
  const recommendedMitigations = finding.recommendedMitigations?.length ? finding.recommendedMitigations : mitigation.recommended_mitigations || [];
  const retestGuidance = finding.retestGuidance?.length ? finding.retestGuidance : mitigation.retest_guidance || [];
  const responseExcerpt = truncate(finding.responseExcerpt || finding.response || '', 1000);
  const fullResponse = truncate(finding.response || '', 2500);
  const showFullResponse = fullResponse && fullResponse !== responseExcerpt;
  return `## Finding: ${inline(finding.payloadName || finding.caseName, 'Untitled Evaluation Case')}

**Run ID:** ${inline(finding.runId || finding.id)}<br>
**Finding ID:** ${inline(finding.findingId || finding.id)}<br>
**Case File:** ${inline(finding.caseFileId)}<br>
**System Under Test:** ${inline(finding.systemUnderTest)}<br>
**Verdict:** ${inline(finding.verdict, 'Unknown')}<br>
**Review Status:** ${inline(finding.reviewStatus)}<br>
**Reviewer Decision:** ${inline(finding.reviewerDecision, 'UNREVIEWED')}<br>
**Reviewer Reviewed At:** ${inline(finding.reviewerReviewedAt)}<br>
**Verdict Source:** ${inline(finding.finalVerdictSource)}<br>
**Control Effectiveness:** ${inline(finding.effectivenessAssessment, 'NOT ASSESSED')}<br>
**System Prompt Hash:** ${inline(finding.promptHash)}<br>
**System Prompt Hash Algorithm:** ${inline(finding.promptHashAlgorithm)}<br>
**Test Case:** ${inline(finding.caseId, 'custom')}<br>
**Case Version:** ${inline(finding.caseVersion)}<br>
**Technique:** ${inline(finding.techniqueId, 'Unmapped')} - ${inline(finding.techniqueName, '')}<br>
**OWASP:** ${inline(finding.owasp, 'Unmapped')}<br>
**Victim Model:** ${inline(finding.victimModel)}<br>
**Runtime:** ${inline(finding.victimRuntime)}<br>
**Timestamp:** ${inline(finding.timestamp)}

${section('Case Description', finding.caseDescription)}${section('Objective', finding.objective)}${section('Expected Secure Behavior', finding.expectedSecureBehavior)}${section('Failure Mode', finding.failureMode)}${section('Success / Failure Criteria', finding.successCriteria)}${section('Control Gap Statement', finding.controlGapStatement || 'Control gap statement not completed - finding is not audit-ready.')}
### Response Excerpt
${fencedCodeBlock(responseExcerpt, 'text')}

### Evaluation Rationale
- Heuristic Verdict: ${bulletText(finding.heuristicVerdict || 'Not recorded')}${finding.heuristicLabel ? ` (${bulletText(finding.heuristicLabel)})` : ''}
- Heuristic Rationale: ${bulletText(finding.evalReason || 'Not recorded')}
- LLM Judge Verdict: ${bulletText(finding.judgeVerdict || 'Not used')}
- LLM Judge Rationale: ${bulletText(finding.judgeReason || 'Not used or not recorded')}
- Evaluation Disagreement: ${finding.evaluationDisagreement ? 'Yes - manual review required' : 'No material disagreement recorded'}
- Evaluation Note: ${bulletText(finding.evaluationNote || 'None')}
- Reviewer Notes: ${bulletText(finding.reviewerNotes || 'None recorded')}

### Evidence Requirements
${list(finding.evidenceRequirements)}

### Impacted Controls
${controlList(controls)}

### Framework Relevance
${list(frameworkList(finding).split('\n').map(line => line.replace(/^-\s*/, '')))}

### Framework Readiness Gaps
${list(finding.readinessGaps)}

### Official Mitigation References
${mitigationReferenceList(officialMitigations)}

### NETRUNNER Recommended Actions
${list(recommendedMitigations)}

### Retest Guidance
${list(retestGuidance)}

### Prompt Payload
${fencedCodeBlock(truncate(finding.payload || '', 1800), 'text')}

${showFullResponse ? `### Stored Full Response\n${fencedCodeBlock(fullResponse, 'text')}\n` : ''}
`;
}

export function generateAssessmentReport(findings = [], metadata = {}) {
  const date = new Date().toISOString();
  const sanitized = findings.map(sanitizeFindingForExport);
  const activeFindings = sanitized.filter(f => f.reviewerDecision !== 'FALSE_POSITIVE');
  const successful = activeFindings.filter(f => ['SUCCESS', 'PARTIAL'].includes(f.verdict)).length;
  const falsePositive = sanitized.length - activeFindings.length;
  const controlIds = [...new Set(activeFindings.flatMap(f => f.mappedControls || []))];
  const controls = controlIds.map(id => CONTROL_SET[id]).filter(Boolean);

  return `# LLM Adversarial Evaluation Report

Generated: ${inline(date)}  
Assessment ID: ${inline(metadata.assessmentId || `assessment-${date.slice(0, 10)}`)}  
Assurance Profile: ${inline(metadata.assuranceProfile || ASSURANCE_PROFILE.label)}<br>
Control Set Version: ${inline(CONTROL_SET_VERSION)}<br>
Framework Mapping Version: ${inline(FRAMEWORK_MAPPING_VERSION)}<br>
Mitigation Set Version: ${inline(MITIGATION_SET_VERSION)}

## Executive Summary

This report summarizes locally executed adversarial evaluation cases against one or more browser-hosted LLMs. The lab treats findings as **evidence indicators**: a successful or partial adversarial result indicates a potential control weakness that should be reviewed, reproduced, remediated, and retested. Framework mappings are provided for traceability and do not constitute legal, audit, or certification conclusions.

- Findings logged: ${sanitized.length}
- Successful or partial findings, excluding reviewer-marked false positives: ${successful}
- Reviewer-marked false positives: ${falsePositive}
- Unique impacted controls: ${controlIds.length}

## Framework Readiness Lens

This report uses the **${inline(ASSURANCE_PROFILE.label)}** profile for AI-enabled SaaS, cybersecurity, edge, cloud, or critical digital infrastructure providers. ISO/IEC 42001 references focus on Clause 9 performance-evaluation evidence: monitoring and measurement, internal audit, and management review. EU AI Act references are high-risk readiness indicators only; classification depends on the specific AI system, intended purpose, jurisdiction, and whether it is used as a safety component in critical digital infrastructure or another high-risk category.

Profile scope note: ${markdownText(ASSURANCE_PROFILE.scope_note)}

EU AI Act scope status: ${inline(ASSURANCE_PROFILE.eu_ai_act_scope.default_status)}. ${markdownText(ASSURANCE_PROFILE.eu_ai_act_scope.note)}

## Scope and Methodology

The evaluation workflow is:

1. Select a victim system prompt and local WebLLM model.
2. Run a structured adversarial evaluation case.
3. Capture the model response and local heuristic result.
4. Optionally run a separate local judge model.
5. Log an evidence record with response excerpts, evaluator outputs, reviewer disposition, control mapping, and framework relevance.

## Impacted Control Summary

${controls.length ? controls.map(c => `- ${bulletText(c.id)} - ${bulletText(c.name)} (${bulletText(c.domain)})`).join('\n') : '- No mapped controls recorded'}

## Active Findings

${activeFindings.length ? activeFindings.map(buildFindingMarkdown).join('\n---\n\n') : 'No active findings logged.'}

## Limitations

- This lab evaluates local model behavior and does not prove exploitability against production systems.
- Results can vary by model, quantization, prompt, temperature, context, and runtime.
- Browser inference is constrained by local hardware, WebGPU support, cache storage, browser profile state, and tab lifecycle behavior.
- First-run model downloads and judge-mode model swaps can temporarily pause the page while model artifacts download, compile, or reload.
- The heuristic evaluator is triage-oriented; \`REVIEW\` or \`PARTIAL\` should not be treated as a final pass/fail conclusion.
- Official mitigation references preserve source IDs and names from MITRE ATLAS. NETRUNNER recommended actions and retest guidance are project-defined implementation guidance.
- LLM-as-judge mode can introduce evaluator bias or prompt-injection risk; judge outputs should be treated as supporting evidence, not ground truth.
- Material disagreement between heuristic and judge results is intentionally preserved as a manual-review signal.
- ISO/IEC 42001 and EU AI Act references are relevance mappings only and depend on system role, risk classification, management-system scope, and jurisdictional scope.
`;
}

export function downloadMarkdown(filename, markdown) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateAuditBriefHtml(findings = [], metadata = {}) {
  const generatedAt = new Date().toISOString();
  const sanitized = findings.map(sanitizeFindingForExport);
  const activeFindings = sanitized.filter(f => f.reviewerDecision !== 'FALSE_POSITIVE');
  const controls = [...new Set(activeFindings.flatMap(f => f.selectedControlIds.length ? f.selectedControlIds : f.mappedControls))]
    .map(id => CONTROL_SET[id]).filter(Boolean);
  const rows = activeFindings.map(finding => {
    const controlsText = (finding.selectedControlIds.length ? finding.selectedControlIds : finding.mappedControls)
      .map(id => CONTROL_SET[id] ? `${id} ${CONTROL_SET[id].name}` : id)
      .join('; ');
    const frameworks = escapeHtml(frameworkList(finding)).replaceAll('\n', '<br>');
    const retestText = finding.retestGuidance.join(' ') || 'Rerun the same case and compare against this evidence record.';
    return `<section class="finding">
      <div class="finding-head">
        <div><span>FINDING</span><strong>${escapeHtml(finding.findingId || finding.id)}</strong></div>
        <div><span>VERDICT</span><strong>${escapeHtml(finding.verdict || 'REVIEW')}</strong></div>
        <div><span>EFFECTIVENESS</span><strong>${escapeHtml(finding.effectivenessAssessment || 'NOT ASSESSED')}</strong></div>
      </div>
      <h2>${escapeHtml(finding.payloadName || 'Untitled finding')}</h2>
      <div class="grid">
        <p><b>Analyst</b>${escapeHtml(finding.analyst || 'Not recorded')}</p>
        <p><b>System Under Test</b>${escapeHtml(finding.systemUnderTest || 'Not recorded')}</p>
        <p><b>Case ID</b>${escapeHtml(finding.caseFileId || finding.caseId || 'Not recorded')}</p>
        <p><b>Model</b>${escapeHtml(finding.victimModel || 'Not recorded')}</p>
        <p><b>System Prompt Hash</b>${escapeHtml(finding.promptHash || 'Not recorded')}</p>
        <p><b>Prompt Hash Algorithm</b>${escapeHtml(finding.promptHashAlgorithm || 'Not recorded')}</p>
        <p><b>Controls</b>${escapeHtml(controlsText || 'Not recorded')}</p>
      </div>
      <h3>Control Gap Statement</h3>
      <p class="${finding.controlGapStatement ? '' : 'warning'}">${escapeHtml(finding.controlGapStatement || 'Control gap statement not completed - finding is not audit-ready.')}</p>
      <h3>Evidence Summary</h3>
      <pre>${escapeHtml(truncate(finding.response || '', 1800))}</pre>
      <h3>Evaluator Rationale</h3>
      <pre>${escapeHtml(`Heuristic: ${finding.evalReason || 'Not recorded'}\nJudge: ${finding.judgeReason || 'Not used or not recorded'}\nReviewer: ${finding.reviewerNotes || 'None recorded'}`)}</pre>
      <h3>Framework Implications</h3>
      <p>${frameworks}</p>
      <h3>Retest Criteria</h3>
      <p>${escapeHtml(retestText)}</p>
    </section>`;
  }).join('\n');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>NETRUNNER Audit Brief</title>
<style>
body{margin:0;background:#0A0C16;color:#E6D6C8;font-family:"JetBrains Mono",ui-monospace,monospace;line-height:1.55}
.banner{background:#C87844;color:#0A0C16;padding:10px 24px;font-weight:900;letter-spacing:2px;text-align:center}
main{max-width:1100px;margin:0 auto;padding:28px 22px 60px}
h1{color:#C87844;letter-spacing:4px;margin:0 0 8px}
h2{color:#E6D6C8;margin:14px 0 8px}
h3{color:#C87844;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;margin:18px 0 6px}
.meta,.finding{border:1px solid #1C2238;background:#0D111D;border-radius:4px;padding:16px;margin:14px 0}
.finding{border-left:3px solid #C87844}
.finding-head,.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px}
.finding-head div,.grid p{background:#0A0C16;border:1px solid #1C2238;padding:8px;margin:0}
span,b{display:block;color:#68738A;font-size:11px;text-transform:uppercase;letter-spacing:1px}
strong{color:#E6D6C8}
pre{white-space:pre-wrap;background:#0A0C16;border:1px solid #1C2238;padding:12px;max-height:360px;overflow:auto}
.warning{color:#DC4838;border:1px solid rgba(220,72,56,.45);background:rgba(220,72,56,.10);padding:10px}
.foot{color:#68738A;font-size:12px;margin-top:24px}
</style>
</head>
<body>
<div class="banner">UNCLASSIFIED // AI ASSURANCE WORKPAPER // LOCAL-FIRST EVIDENCE</div>
<main>
  <h1>NETRUNNER AUDIT BRIEF</h1>
  <div class="meta">
    <p><b>Generated</b>${escapeHtml(generatedAt)}</p>
    <p><b>Assurance Profile</b>${escapeHtml(metadata.assuranceProfile || ASSURANCE_PROFILE.label)}</p>
    <p><b>Findings</b>${activeFindings.length}</p>
    <p><b>Impacted Controls</b>${controls.map(c => escapeHtml(`${c.id} ${c.name}`)).join('<br>') || 'None recorded'}</p>
  </div>
  ${rows || '<p>No active findings recorded.</p>'}
  <p class="foot">Framework mappings are traceability aids and do not constitute legal, audit, or certification conclusions. Evidence was generated locally in the browser. Exports can contain complete model responses, analyst notes, and assessment metadata; review before sharing.</p>
</main>
</body>
</html>`;
}

export function downloadHtml(filename, html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
