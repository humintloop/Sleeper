// Renders a buildEvidenceContract() contract — evidence class / independence /
// status / scope, not ORPHEUS's flat field list. Field groups below mirror the
// actual object shape in src/harness/evidenceContract.js.
import { Check, Copy, Download, FileJson } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EVIDENCE_CLASSES as EVIDENCE_CLASS_NAMES } from '../harness/evidenceContract';
import { verifyContractIntegrity } from '../harness/runProvenance';
import { prepareEvidenceContractExport } from '../reports/evidenceContractExport';

function downloadJson(payload, contract, historical = false) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${historical ? 'historical-' : ''}${contract.case_id || 'sleeper-evidence-contract'}-${contract.profile_id || 'run'}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function ghostBtn(C) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px',
    background: 'transparent', border: `1px solid ${C.borderHi}`, color: C.text2,
    fontSize: C.size.micro, fontWeight: 700, letterSpacing: .5, cursor: 'pointer', borderRadius: 2,
  };
}

function Field({ C, label, value, tone }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: C.text3, fontSize: C.size.micro, marginBottom: 2 }}>{label}</div>
      <div style={{ color: tone ? C[tone] || C.text1 : C.text1, fontSize: C.size.small, fontWeight: 800, fontFamily: C.mono, overflowWrap: 'anywhere' }}>
        {value === null || value === undefined || value === '' ? 'NULL' : String(value)}
      </div>
    </div>
  );
}

function Group({ C, title, children }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2, padding: '12px 14px' }}>
      <div style={{ color: C.text3, fontSize: C.size.micro, fontWeight: 800, letterSpacing: .2, marginBottom: 9 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 7 }}>
        {children}
      </div>
    </div>
  );
}

function humanize(value) {
  return String(value ?? '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .replaceAll('Pii', 'PII')
    .replaceAll('Api', 'API');
}

export default function EvidenceContractPanel({
  C,
  contract,
  historical = false,
  historicalChanges = [],
  currentConfigurationDigest = null,
}) {
  const [copied, setCopied] = useState(false);
  const [pendingExport, setPendingExport] = useState(null);
  const [integrityVerified, setIntegrityVerified] = useState(null);
  const json = useMemo(() => contract ? JSON.stringify(contract, null, 2) : '', [contract]);

  useEffect(() => {
    let active = true;
    setIntegrityVerified(null);
    if (contract?.integrity?.digest) {
      verifyContractIntegrity(contract).then(valid => {
        if (active) setIntegrityVerified(valid);
      });
    }
    return () => { active = false; };
  }, [contract]);

  useEffect(() => setPendingExport(null), [contract, historical]);

  if (!contract) {
    return (
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.text3, fontSize: C.size.small, fontWeight: 800, letterSpacing: .2, marginBottom: 8 }}>
          <FileJson size={14} /> Evidence Contract
        </div>
        <div style={{ color: C.text2, fontSize: C.size.small, lineHeight: 1.55 }}>
          Run a case to generate a contract. It records what this run&rsquo;s evidence permits its author to claim — never more.
        </div>
      </div>
    );
  }

  const performExport = async (action, confirmed = false) => {
    let payload;
    try {
      payload = prepareEvidenceContractExport({
        contract,
        state: historical ? 'stale' : 'current',
        confirmed,
        changes: historicalChanges,
        currentConfigurationDigest,
      });
    } catch (exportError) {
      if (exportError?.code === 'STALE_EXPORT_CONFIRMATION_REQUIRED') {
        setPendingExport(action);
        return;
      }
      throw exportError;
    }
    setPendingExport(null);
    if (action === 'copy') {
      await navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
      return;
    }
    downloadJson(payload, contract, historical);
  };

  const ev = contract.evidence || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.brass, fontSize: C.size.small, fontWeight: 900, letterSpacing: .2 }}>
            <FileJson size={14} /> Evidence Contract
          </div>
          <div style={{ color: C.text3, fontSize: C.size.small, marginTop: 3, fontFamily: C.mono }}>{contract.case_id} · {contract.profile_id}</div>
        </div>
        <button onClick={() => performExport('copy')} style={ghostBtn(C)}>
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'COPIED' : 'COPY JSON'}
        </button>
        <button onClick={() => performExport('download')} style={ghostBtn(C)}>
          <Download size={13} /> DOWNLOAD
        </button>
      </div>

      {historical && (
        <div role="status" style={{ fontSize: C.size.small, color: C.ochre, background: C.amberBg, border: `1px solid ${C.ochre}55`, padding: '9px 12px', borderRadius: 2 }}>
          Historical result: the current execution settings differ from this completed run. Copy and download require explicit confirmation and are labeled historical.
        </div>
      )}

      {pendingExport && (
        <div role="alert" style={{ fontSize: C.size.small, color: C.text1, background: C.amberBg, border: `1px solid ${C.ochre}55`, padding: '10px 12px', borderRadius: 2 }}>
          Export the completed run as historical evidence? It will retain its original manifest and configuration digest and will not describe the settings currently selected.
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => performExport(pendingExport, true)} style={ghostBtn(C)}>CONFIRM HISTORICAL {pendingExport.toUpperCase()}</button>
            <button onClick={() => setPendingExport(null)} style={ghostBtn(C)}>CANCEL</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        <div style={{ background: C.greenBg, border: `1px solid ${C.green}55`, borderLeft: `3px solid ${C.green}`, borderRadius: 2, padding: '11px 13px' }}>
          <div style={{ color: C.green, fontSize: C.size.micro, fontWeight: 900, letterSpacing: .2, marginBottom: 5 }}>What this run supports</div>
          <div style={{ color: C.text1, fontSize: C.size.small, lineHeight: 1.5 }}>
            {(contract.scope?.covers || []).map(humanize).join(', ') || 'No positive control claim.'}
          </div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.borderHi}`, borderLeft: `3px solid ${C.borderHi}`, borderRadius: 2, padding: '11px 13px' }}>
          <div style={{ color: C.text2, fontSize: C.size.micro, fontWeight: 900, letterSpacing: .2, marginBottom: 5 }}>What it does not support</div>
          <div style={{ color: C.text2, fontSize: C.size.small, lineHeight: 1.5 }}>
            {(contract.scope?.does_not_cover || []).map(humanize).join(', ') || 'No additional exclusions recorded.'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <Group C={C} title="Evidence class">
          <Field C={C} label="Target" value={`${ev.target?.class} (${ev.target?.class_name}) — ${ev.target?.subject}`} />
          <Field C={C} label="Control point" value={ev.control_point ? `${ev.control_point.class} (${ev.control_point.class_name}) — ${ev.control_point.subject}` : 'none exercised'} tone={ev.control_point ? 'brass' : undefined} />
          <Field C={C} label="Max class claimed" value={`${ev.max_class_claimed} (${EVIDENCE_CLASS_NAMES[ev.max_class_claimed] || ''})`} />
          <Field C={C} label="Ceiling" value={`${ev.ceiling} — E4/E5 (persistence, isolation) are unreachable by design`} />
          <Field C={C} label="Independence" value={`${ev.independence?.level} — ${ev.independence?.level_name}`} />
          <Field C={C} label="Status" value={ev.status} tone={ev.status_downgraded ? 'ochre' : undefined} />
        </Group>

        <div style={{ fontSize: C.size.micro, color: C.text3, lineHeight: 1.6, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2, padding: '10px 12px' }}>
          <span style={{ color: C.text2, fontWeight: 700 }}>What this means: </span>
          Evidence class (E1&ndash;E5) is how strong a claim this run&rsquo;s evidence supports &mdash; E1 is an observation,
          E2 is characterizing real behavior, E3 is watching a control actually block something. This project
          never reaches E4 (replay-resistant persistence) or E5 (isolation boundary) &mdash; that ceiling is
          enforced in code, not just stated here. Independence (I0&ndash;I2) is who built the check: I0 means
          this project wrote both the control and the check on it, which is what every run here is unless
          stated otherwise.
        </div>

        <Group C={C} title="Scope">
          <Field C={C} label="Vocabulary" value={contract.scope?.vocabulary} />
          <Field C={C} label="Covers" value={contract.scope?.covers?.map(humanize).join(', ') || '(none)'} tone="green" />
          <Field C={C} label="Does not cover" value={contract.scope?.does_not_cover?.map(humanize).join(', ') || '(none)'} tone="slate" />
        </Group>

        <Group C={C} title="Run">
          <Field C={C} label="Verdict" value={contract.verdict} />
          <Field C={C} label="Run mode" value={contract.run_mode} />
          <Field C={C} label="Mode" value={contract.mode} />
          <Field C={C} label="Target" value={contract.target} />
        </Group>

        {contract.case_evaluation && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2, padding: '12px 14px' }}>
            <div style={{ color: C.text3, fontSize: C.size.micro, fontWeight: 800, letterSpacing: .2, marginBottom: 9 }}>Case-condition evaluation</div>
            <div style={{ display: 'grid', gap: 9 }}>
              {contract.case_evaluation.evaluations?.map(evaluation => (
                <div key={evaluation.condition} style={{ color: C.text2, fontSize: C.size.small, lineHeight: 1.5 }}>
                  <strong style={{ color: C.text1 }}>{humanize(evaluation.condition)}: {humanize(evaluation.outcome)}</strong>
                  <div style={{ color: C.text3, marginTop: 2 }}>
                    {evaluation.signals.map(signal => `${signal.name}=${String(signal.observed)} (${signal.source})`).join(' · ') || 'No executable signals declared.'}
                  </div>
                  {evaluation.limitations?.map((limitation, index) => (
                    <div key={index} style={{ color: C.ochre, marginTop: 2 }}>{limitation}</div>
                  ))}
                </div>
              ))}
              {contract.case_evaluation.unsupported_signals?.length > 0 && (
                <div style={{ color: C.ochre, fontSize: C.size.micro }}>
                  Unsupported signals: {contract.case_evaluation.unsupported_signals.join(', ')}. These remain unknown and cannot support a held verdict.
                </div>
              )}
            </div>
          </div>
        )}

        {contract.secondary_oracle && (
          <Group C={C} title="Secondary model oracle">
            <Field C={C} label="Status" value={contract.secondary_oracle.status} tone={contract.secondary_oracle.status === 'completed' ? undefined : 'ochre'} />
            <Field C={C} label="Assessment" value={contract.secondary_oracle.assessment ?? 'no valid assessment'} />
            <Field C={C} label="Blinded judged verdict" value={contract.secondary_oracle.judged_verdict ?? 'no valid verdict'} />
            <Field C={C} label="Malicious goal adoption" value={contract.secondary_oracle.malicious_goal_adoption ?? 'unclear'} />
            <Field C={C} label="Unauthorized action intent" value={contract.secondary_oracle.unauthorized_action_intent ?? 'unclear'} />
            <Field C={C} label="Judge model" value={contract.secondary_oracle.model_id} />
            <Field C={C} label="Independence effect" value="none — remains I0" tone="ochre" />
            {contract.secondary_oracle.error && (
              <div style={{ gridColumn: '1 / -1', color: C.red, fontSize: C.size.small }}>
                Judge error: {contract.secondary_oracle.error}
              </div>
            )}
            {/* Shown whenever the judge produced no valid verdict, not only on
               outright error — a small local model very often replies with
               text that just doesn't parse as the expected JSON shape, and
               "no valid verdict" with nothing else to look at is a dead end.
               This is exactly what the model returned; it's diagnostic, not
               a claim about anything. */}
            {!contract.secondary_oracle.judged_verdict && contract.secondary_oracle.raw_response && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ color: C.text3, fontSize: C.size.micro, marginBottom: 4 }}>Raw judge response (did not parse as valid output)</div>
                <pre style={{
                  margin: 0, fontFamily: C.mono, fontSize: C.size.micro, lineHeight: 1.5, color: C.text2,
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, padding: '9px 11px',
                  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 220, overflowY: 'auto',
                }}>
                  {contract.secondary_oracle.raw_response}
                </pre>
              </div>
            )}
          </Group>
        )}

        {contract.run_manifest && (
          <Group C={C} title="Run provenance">
            <Field C={C} label="Source revision" value={contract.run_manifest.source_revision} tone={contract.run_manifest.source_revision === 'unrecorded' ? 'ochre' : undefined} />
            <Field C={C} label="Dirty source tree" value={contract.run_manifest.source_dirty === null ? 'unknown' : contract.run_manifest.source_dirty ? 'yes' : 'no'} tone={contract.run_manifest.source_dirty ? 'ochre' : undefined} />
            <Field C={C} label="Configuration digest" value={contract.run_manifest.configuration_digest} />
            <Field C={C} label="Case digest" value={contract.run_manifest.case_digest} />
            <Field C={C} label="Tool schema digest" value={contract.run_manifest.tool_schema_digest} />
          </Group>
        )}

        {contract.integrity && (
          <Group C={C} title="Integrity boundary">
            <Field C={C} label="Scheme" value={contract.integrity.scheme} />
            <Field C={C} label="Digest" value={contract.integrity.digest} />
            <Field C={C} label="Signed" value={contract.integrity.signed ? 'yes' : 'no'} tone="ochre" />
            <Field C={C} label="Replay resistant" value={contract.integrity.replay_resistant ? 'yes' : 'no'} tone="ochre" />
            <Field C={C} label="Self-digest verifies" value={integrityVerified === null ? 'checking' : integrityVerified ? 'yes' : 'no'} tone={integrityVerified === false ? 'red' : undefined} />
            <Field C={C} label="External witness" value={contract.integrity.external_witness?.verified === true ? 'verified' : contract.integrity.external_witness?.verified === false ? 'failed' : 'not configured'} tone={contract.integrity.external_witness?.verified === false ? 'red' : undefined} />
          </Group>
        )}
      </div>

      {contract.integrity?.limitation && (
        <div style={{ fontSize: C.size.micro, color: C.text3, lineHeight: 1.55 }}>
          {contract.integrity.limitation}
        </div>
      )}

      {integrityVerified === false && (
        <div role="alert" style={{ fontSize: C.size.small, color: C.red, background: C.redBg, border: `1px solid ${C.red}55`, padding: '9px 12px', borderRadius: 2 }}>
          This record no longer matches its stored self-digest. Treat it as modified browser-local evidence.
        </div>
      )}

      {contract.limitations?.length > 0 && (
        <div style={{ fontSize: C.size.small, color: C.text2, lineHeight: 1.5 }}>
          <div style={{ fontSize: C.size.micro, letterSpacing: .2, marginBottom: 6, color: C.text3 }}>Limitations</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {contract.limitations.map((note, i) => <li key={i} style={{ marginBottom: 3 }}>{note}</li>)}
          </ul>
        </div>
      )}

      <div style={{ fontSize: C.size.micro, color: C.text3, fontStyle: 'italic' }}>{contract.claim_boundary}</div>

      <details style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2, padding: '11px 13px' }}>
        <summary style={{ cursor: 'pointer', color: C.text2, fontSize: C.size.micro, fontWeight: 800, letterSpacing: .2 }}>
          Raw contract JSON
        </summary>
        <pre style={{ margin: '12px 0 0', maxHeight: 320, overflow: 'auto', padding: 14, background: C.ink, border: `1px solid ${C.border}`, borderRadius: 2, color: C.brass, fontSize: C.size.micro, lineHeight: 1.55, fontFamily: C.mono, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{json}</pre>
      </details>
    </div>
  );
}
