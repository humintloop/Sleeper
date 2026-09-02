// Phase 2 Report tab: human-readable export (Markdown/HTML/JSON) built on
// src/reports/reportGenerator.js, which already existed but had no UI
// surface. Distinct from the Evidence Contract JSON download on the Evidence
// tab — that is the machine contract; this is the readable brief/handoff
// document. Export generation itself stays pure (reportGenerator.js,
// reportExport.js); this component is the thin UI wrapper the handoff doc
// asks for.
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { downloadHtml, downloadMarkdown, generateAgentAssessmentReport, generateAgentAssuranceBriefHtml } from '../reports/reportGenerator';
import { prepareReportExport } from '../reports/reportExport';

const FORMATS = [
  { id: 'markdown', label: 'MARKDOWN' },
  { id: 'html', label: 'HTML BRIEF' },
  { id: 'json', label: 'JSON' },
];

function toRunRecord(agentCase, profile, outcome) {
  return {
    id: outcome?.manifestDigest ? outcome.manifestDigest.slice(0, 12) : '',
    timestamp: outcome?.contract?.run_manifest?.generated_at || '',
    caseId: agentCase?.id || outcome?.contract?.case_id || '',
    caseTitle: agentCase?.title || '',
    profileId: profile?.id || outcome?.contract?.profile_id || '',
    profileLabel: profile?.label || '',
    verdict: outcome?.verdict?.verdict,
    reasonText: outcome?.verdict?.reason?.text,
    targetLabel: outcome?.contract?.target,
    degraded: Boolean(outcome?.run?.degraded),
    configurationDigest: outcome?.configurationDigest,
    manifestDigest: outcome?.manifestDigest,
    contract: outcome?.contract,
  };
}

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function buildContent(format, runs, metadata) {
  if (format === 'markdown') return generateAgentAssessmentReport(runs, metadata);
  if (format === 'html') return generateAgentAssuranceBriefHtml(runs, metadata);
  return { generatedAt: new Date().toISOString(), application: 'Sleeper', runs };
}

export default function ReportPanel({
  C,
  agentCase,
  profiles,
  result,
  comparisonResults = {},
  historical = false,
  historicalChanges = [],
  comparisonHistorical = false,
  currentConfigurationDigest = null,
}) {
  const [scope, setScope] = useState('current');
  const [pending, setPending] = useState(null); // { format } awaiting confirmation
  useEffect(() => setPending(null), [scope, result, comparisonResults]);

  const comparisonRuns = Object.entries(comparisonResults).map(([id, outcome]) => toRunRecord(agentCase, profiles?.[id], outcome));
  const currentRuns = result ? [toRunRecord(agentCase, profiles?.[result.contract?.profile_id], result)] : [];
  const runs = scope === 'comparison' ? comparisonRuns : currentRuns;
  const scopeIsStale = scope === 'comparison' ? comparisonHistorical : historical;
  const digests = scope === 'comparison'
    ? { completedConfigurationDigest: comparisonRuns.map(r => r.configurationDigest).filter(Boolean).join(', '), completedManifestDigest: comparisonRuns.map(r => r.manifestDigest).filter(Boolean).join(', ') }
    : { completedConfigurationDigest: currentRuns[0]?.configurationDigest ?? null, completedManifestDigest: currentRuns[0]?.manifestDigest ?? null };

  const runExport = (format, confirmed = false) => {
    const metadata = { assessmentId: agentCase?.id ? `${agentCase.id}-${scope}` : undefined };
    const content = buildContent(format, runs, metadata);
    let payload;
    try {
      payload = prepareReportExport({
        content, format, state: scopeIsStale ? 'stale' : 'current', confirmed,
        changes: historicalChanges, currentConfigurationDigest, ...digests,
      });
    } catch (exportError) {
      if (exportError?.code === 'STALE_EXPORT_CONFIRMATION_REQUIRED') {
        setPending({ format });
        return;
      }
      throw exportError;
    }
    setPending(null);
    const filenameBase = `${scopeIsStale ? 'historical-' : ''}sleeper-report-${agentCase?.id || 'run'}-${scope}`;
    if (format === 'markdown') downloadMarkdown(`${filenameBase}.md`, payload);
    else if (format === 'html') downloadHtml(`${filenameBase}.html`, payload);
    else downloadJson(`${filenameBase}.json`, payload);
  };

  if (runs.length === 0) {
    return (
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2, padding: 18, color: C.text3, fontSize: 13 }}>
        {scope === 'comparison' ? 'No comparison results yet — run Compare first.' : 'Run a case to build a report here.'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ color: C.text2, fontSize: 12.5, lineHeight: 1.55 }}>
        Human-readable export for handoff — distinct from the machine Evidence Contract JSON on the
        Evidence tab. Includes run identity, configuration digest, case-condition evaluation, and every
        limitation the contract carries; nothing here claims more than the contract does.
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button aria-pressed={scope === 'current'} onClick={() => setScope('current')} style={scopeBtn(C, scope === 'current')}>
          CURRENT RESULT
        </button>
        <button aria-pressed={scope === 'comparison'} onClick={() => setScope('comparison')} disabled={comparisonRuns.length === 0} style={scopeBtn(C, scope === 'comparison')}>
          COMPARISON SET ({comparisonRuns.length})
        </button>
      </div>

      {scopeIsStale && (
        <div role="status" style={{ fontSize: 12, color: C.ochre, background: C.amberBg, border: `1px solid ${C.ochre}55`, padding: '9px 12px', borderRadius: 2 }}>
          Historical: the current execution settings differ from this completed {scope === 'comparison' ? 'comparison set' : 'run'}.
          Export requires explicit confirmation and is labeled historical.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FORMATS.map(fmt => (
          <button key={fmt.id} onClick={() => runExport(fmt.id)} style={ghostBtn(C)}>
            <Download size={13} /> {fmt.label}
          </button>
        ))}
      </div>

      {pending && (
        <div role="alert" style={{ fontSize: 12, color: C.text1, background: C.amberBg, border: `1px solid ${C.ochre}55`, padding: '10px 12px', borderRadius: 2 }}>
          Export this {scope === 'comparison' ? 'comparison set' : 'run'} as historical evidence? It will retain its
          original completed identity and will not describe the settings currently selected.
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => runExport(pending.format, true)} style={ghostBtn(C)}>CONFIRM HISTORICAL {pending.format.toUpperCase()}</button>
            <button onClick={() => setPending(null)} style={ghostBtn(C)}>CANCEL</button>
          </div>
        </div>
      )}
    </div>
  );
}

function scopeBtn(C, active) {
  return {
    padding: '7px 14px', fontSize: 11.5, fontWeight: 800, letterSpacing: .5, cursor: 'pointer', borderRadius: 2,
    background: active ? C.brassBg : 'transparent', border: `1px solid ${active ? C.brass : C.borderHi}`,
    color: active ? C.brass : C.text2,
  };
}

function ghostBtn(C) {
  return {
    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 11.5, fontWeight: 800,
    letterSpacing: .5, cursor: 'pointer', borderRadius: 2, background: 'transparent', border: `1px solid ${C.borderHi}`, color: C.text1,
  };
}
