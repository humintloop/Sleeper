// Report generation for agent-case runs. Built around the record shape
// AgentCaseRunner.jsx persists via src/storage.js's saveAgentRun — verdict,
// reason, and a full Evidence Contract (E-class/I-class/scope/status) — not
// a single-turn probe finding shape.
//
// The XSS-escaping discipline from the probe-era version is preserved
// unchanged: reason text, detection signals, and framework rationale can all
// carry text that traces back to scenario fixtures or model output, so
// anything interpolated into the HTML brief goes through escapeHtml first.

// v2 adds configurationDigest/manifestDigest (src/harness/runConfiguration.js,
// src/harness/runProvenance.js) and caseEvaluation (src/harness/evaluateCaseConditions.js)
// — Phase 1 additions the v1 shape predates. Additive, not breaking: every v1
// consumer that ignored unknown fields keeps working.
export const AGENT_RUNS_EXPORT_VERSION = 2;

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
  const safeItems = (Array.isArray(items) ? items : []).map(String).filter(Boolean);
  return safeItems.length ? safeItems.map(item => `- ${bulletText(item)}`).join('\n') : '- None recorded';
};

/**
 * Normalize a persisted agent-run record (see AgentCaseRunner.jsx's
 * persistRun) into the flat shape every export function below reads from.
 * Missing fields default rather than throw, since exports must survive a
 * partially-recorded run (e.g. an INCONCLUSIVE run that never reached a
 * target still has a contract, just a thin one).
 */
export function sanitizeAgentRunForExport(run = {}) {
  const contract = run.contract || {};
  const evidence = contract.evidence || {};
  const caseEvaluation = contract.case_evaluation || null;
  return {
    exportVersion: AGENT_RUNS_EXPORT_VERSION,
    id: run.id || '',
    timestamp: run.timestamp || '',
    caseId: run.caseId || contract.case_id || '',
    caseTitle: run.caseTitle || run.caseId || '',
    profileId: run.profileId || contract.profile_id || '',
    profileLabel: run.profileLabel || run.profileId || '',
    verdict: run.verdict || contract.verdict || 'INCONCLUSIVE',
    reasonCode: contract.reason?.code || '',
    reasonText: run.reasonText || contract.reason?.text || '',
    targetLabel: run.targetLabel || contract.target || '',
    degraded: Boolean(run.degraded ?? contract.simulated_only),
    simulatedOnly: contract.simulated_only !== false,
    simulationNote: contract.simulation_note || '',
    configurationDigest: run.configurationDigest || contract.run_manifest?.configuration_digest || '',
    manifestDigest: run.manifestDigest || contract.run_manifest?.manifest_digest || '',
    evidenceTargetClass: evidence.target?.class || '',
    evidenceTargetSubject: evidence.target?.subject || '',
    evidenceControlPointClass: evidence.control_point?.class || null,
    evidenceControlPointSubject: evidence.control_point?.subject || null,
    maxClassClaimed: evidence.max_class_claimed || '',
    independenceLevel: evidence.independence?.level || '',
    status: evidence.status || '',
    statusDowngraded: Boolean(evidence.status_downgraded),
    scopeVocabulary: contract.scope?.vocabulary || '',
    scopeCovers: Array.isArray(contract.scope?.covers) ? contract.scope.covers : [],
    scopeDoesNotCover: Array.isArray(contract.scope?.does_not_cover) ? contract.scope.does_not_cover : [],
    controlsExercised: Array.isArray(contract.controls_exercised) ? contract.controls_exercised : [],
    controlsUnexercised: Array.isArray(contract.controls_unexercised) ? contract.controls_unexercised : [],
    frameworkReferences: Array.isArray(contract.framework_references) ? contract.framework_references : [],
    limitations: Array.isArray(contract.limitations) ? contract.limitations : [],
    claimBoundary: contract.claim_boundary || '',
    // Case-condition evaluation, kept separate from general control
    // enforcement above per the handoff doc's Evidence-tab requirement — a
    // reader should never have to guess whether a fact was independently
    // observed by the general engine or derived from a declared case signal.
    caseEvaluationSummary: caseEvaluation?.summary || null,
    caseEvaluationEntries: Array.isArray(caseEvaluation?.evaluations) ? caseEvaluation.evaluations : [],
    caseEvaluationUnsupportedSignals: Array.isArray(caseEvaluation?.unsupported_signals) ? caseEvaluation.unsupported_signals : [],
  };
}

export function createAgentRunsExport(runs = [], metadata = {}) {
  return {
    exportVersion: AGENT_RUNS_EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    application: 'Sleeper',
    assessmentId: metadata.assessmentId || null,
    runs: runs.map(sanitizeAgentRunForExport),
  };
}

function frameworkReferenceList(refs = []) {
  const lines = refs.map(ref => `${ref.framework || 'unknown'}: ${ref.id || ''} (${ref.relationship || 'inferred'})`);
  return list(lines);
}

function caseEvaluationSection(run) {
  if (run.caseEvaluationEntries.length === 0) return '';
  const rows = run.caseEvaluationEntries.map(entry => {
    const signals = (entry.signals || [])
      .map(signal => `${signal.name}=${String(signal.observed)} (${signal.source})`)
      .join(', ') || 'no executable signals declared';
    return `- ${bulletText(entry.condition)}: ${bulletText(entry.outcome)} — ${bulletText(signals)}`;
  }).join('\n');
  const unsupported = run.caseEvaluationUnsupportedSignals.length > 0
    ? `\n\nUnsupported signals (unknown, never counted as secure): ${run.caseEvaluationUnsupportedSignals.map(bulletText).join(', ')}`
    : '';
  return `\n\n### Case-Condition Evaluation\nDerived from recorded runtime fields, independent of general control enforcement above.\n${rows}${unsupported}`;
}

export function buildAgentRunMarkdown(rawRun) {
  const run = sanitizeAgentRunForExport(rawRun);
  return `## Run: ${inline(run.caseTitle, 'Untitled case')}

**Run ID:** ${inline(run.id)}<br>
**Case:** ${inline(run.caseId)}<br>
**Control Profile:** ${inline(run.profileLabel)}<br>
**Verdict (control vocabulary):** ${inline(run.verdict, 'INCONCLUSIVE')}<br>
**Reason Code:** ${inline(run.reasonCode)}<br>
**Target:** ${inline(run.targetLabel)}<br>
**Degraded:** ${run.degraded ? 'Yes - see limitations' : 'No'}<br>
**Timestamp:** ${inline(run.timestamp)}<br>
**Configuration Digest:** ${inline(run.configurationDigest, 'not recorded')}<br>
**Manifest Digest:** ${inline(run.manifestDigest, 'not recorded')}

### Reason
${escapeMarkdownStructure(run.reasonText || 'Not recorded').trim() || 'Not recorded'}

### Evidence Class
- Target: ${bulletText(run.evidenceTargetClass)} (${bulletText(run.evidenceTargetSubject)})
- Control point: ${run.evidenceControlPointClass ? `${bulletText(run.evidenceControlPointClass)} (${bulletText(run.evidenceControlPointSubject)})` : 'none exercised'}
- Max class claimed: ${bulletText(run.maxClassClaimed)}
- Independence: ${bulletText(run.independenceLevel)}
- Status: ${bulletText(run.status)}${run.statusDowngraded ? ' (downgraded — see limitations)' : ''}

### Scope
- Vocabulary: ${bulletText(run.scopeVocabulary)}
- Covers: ${run.scopeCovers.length ? run.scopeCovers.map(bulletText).join(', ') : 'none'}
- Does not cover: ${run.scopeDoesNotCover.length ? run.scopeDoesNotCover.map(bulletText).join(', ') : 'none'}
${caseEvaluationSection(run)}

### Framework Relevance
${frameworkReferenceList(run.frameworkReferences)}

### Limitations
${list(run.limitations)}

### Claim Boundary
${escapeMarkdownStructure(run.claimBoundary).trim() || 'Not recorded'}
`;
}

export function generateAgentAssessmentReport(runs = [], metadata = {}) {
  const date = new Date().toISOString();
  const sanitized = runs.map(sanitizeAgentRunForExport);
  const heldCount = sanitized.filter(r => r.verdict === 'CONTROL_HELD').length;
  const failedCount = sanitized.filter(r => r.verdict === 'CONTROL_FAILED').length;
  const partialCount = sanitized.filter(r => r.verdict === 'PARTIAL_CONTROL_FAILURE').length;
  const inconclusiveCount = sanitized.filter(r => r.verdict === 'INCONCLUSIVE').length;

  return `# Agent Threat Assessment Report

Generated: ${inline(date)}
Assessment ID: ${inline(metadata.assessmentId || `assessment-${date.slice(0, 10)}`)}

## Executive Summary

This report summarizes locally executed agent-case runs. Each run gives a model real tool
definitions and control profile enforcement, and watches whether it acts on an instruction
that should not be trusted. The verdict vocabulary here (CONTROL_HELD / PARTIAL_CONTROL_FAILURE
/ CONTROL_FAILED / INCONCLUSIVE) answers "did the exercised control hold?" An unexercised control
is never reported as a hold: a run that never reached its target, or never attempted the action
under test, is INCONCLUSIVE.

- Runs logged: ${sanitized.length}
- Control held: ${heldCount}
- Partial control failure: ${partialCount}
- Control failed: ${failedCount}
- Inconclusive: ${inconclusiveCount}

## Runs

${sanitized.length ? runs.map(buildAgentRunMarkdown).join('\n---\n\n') : 'No runs logged.'}

## Limitations

- This lab evaluates local and live-API model behavior in a mock-tool harness. Tool effects are
  simulated; nothing recorded here reflects a real action taken by any system.
- Results can vary by model, provider, quantization, prompt, temperature, and runtime.
- Evidence class is capped at E3 (enforcement) by design. This project produces no E4
  (persistence and replay resistance) or E5 (isolation and security boundary) evidence.
- Oracle independence is I0 unless a run records otherwise: the controls and the verdict function
  are authored by this project, not an independent check on it.
- Framework mappings are traceability aids for control review and do not constitute legal, audit,
  or certification conclusions.
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

export function generateAgentAssuranceBriefHtml(runs = [], metadata = {}) {
  const generatedAt = new Date().toISOString();
  const sanitized = runs.map(sanitizeAgentRunForExport);
  const rows = sanitized.map(run => {
    const frameworks = run.frameworkReferences
      .map(ref => `${escapeHtml(ref.framework || 'unknown')}: ${escapeHtml(ref.id || '')} (${escapeHtml(ref.relationship || 'inferred')})`)
      .join('<br>') || 'None recorded';
    const caseEvaluation = run.caseEvaluationEntries.length > 0
      ? `<h3>Case-Condition Evaluation</h3>
      <p>Derived from recorded runtime fields, independent of general control enforcement above.</p>
      <pre>${escapeHtml(run.caseEvaluationEntries.map(entry => {
        const signals = (entry.signals || []).map(signal => `${signal.name}=${String(signal.observed)} (${signal.source})`).join(', ') || 'no executable signals declared';
        return `${entry.condition}: ${entry.outcome} — ${signals}`;
      }).join('\n') + (run.caseEvaluationUnsupportedSignals.length > 0 ? `\nUnsupported signals: ${run.caseEvaluationUnsupportedSignals.join(', ')}` : ''))}</pre>`
      : '';
    return `<section class="finding">
      <div class="finding-head">
        <div><span>RUN</span><strong>${escapeHtml(run.id)}</strong></div>
        <div><span>VERDICT</span><strong>${escapeHtml(run.verdict)}</strong></div>
        <div><span>MAX CLASS CLAIMED</span><strong>${escapeHtml(run.maxClassClaimed)}</strong></div>
      </div>
      <h2>${escapeHtml(run.caseTitle)}</h2>
      <div class="grid">
        <p><b>Case</b>${escapeHtml(run.caseId)}</p>
        <p><b>Control Profile</b>${escapeHtml(run.profileLabel)}</p>
        <p><b>Target</b>${escapeHtml(run.targetLabel)}</p>
        <p><b>Degraded</b>${run.degraded ? 'Yes' : 'No'}</p>
        <p><b>Independence</b>${escapeHtml(run.independenceLevel)}</p>
        <p><b>Status</b>${escapeHtml(run.status)}</p>
        <p><b>Configuration Digest</b>${escapeHtml(run.configurationDigest || 'not recorded')}</p>
        <p><b>Manifest Digest</b>${escapeHtml(run.manifestDigest || 'not recorded')}</p>
      </div>
      <h3>Reason</h3>
      <p class="${run.verdict === 'CONTROL_FAILED' ? 'warning' : ''}">${escapeHtml(run.reasonText || 'Not recorded')}</p>
      <h3>Scope</h3>
      <p>Covers: ${escapeHtml(run.scopeCovers.join(', ') || 'none')}<br>Does not cover: ${escapeHtml(run.scopeDoesNotCover.join(', ') || 'none')}</p>
      ${caseEvaluation}
      <h3>Framework Relevance</h3>
      <p>${frameworks}</p>
      <h3>Limitations</h3>
      <pre>${escapeHtml(run.limitations.join('\n') || 'None recorded')}</pre>
    </section>`;
  }).join('\n');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Sleeper Assurance Brief</title>
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
  <h1>Sleeper Assurance Brief</h1>
  <div class="meta">
    <p><b>Generated</b>${escapeHtml(generatedAt)}</p>
    <p><b>Assessment ID</b>${escapeHtml(metadata.assessmentId || 'Not recorded')}</p>
    <p><b>Runs</b>${sanitized.length}</p>
  </div>
  ${rows || '<p>No runs recorded.</p>'}
  <p class="foot">Framework mappings are traceability aids and do not constitute legal, audit, or certification conclusions. Tool effects in every run were simulated. Evidence was generated locally in the browser; review exported files before sharing.</p>
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
