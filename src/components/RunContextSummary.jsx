// Phase 2 persistent context strip: the active configuration, the displayed
// result's relationship to it (current/stale/running/degraded/error), and
// the rerun action, all in one place that stays visible above whichever
// workspace tab (Compare/Trace/Evidence/Report) is open. Reads the same
// canonical configuration snapshot src/harness/runConfiguration.js produces
// — no second copy of "what determines a run" gets built here.
const STATE_TONE = {
  idle: 'text3',
  running: 'brass',
  current: 'green',
  stale: 'ochre',
  degraded: 'red',
  error: 'red',
};

export function targetSummary(configuration) {
  if (!configuration) return '';
  const type = configuration.target_type;
  if (type === 'sample') return 'Sample Replay';
  if (type === 'local') return `Local — ${configuration.local_model || 'model not selected'}`;
  if (type === 'live') return `Live — ${configuration.provider || 'provider'}:${configuration.provider_model || 'model not selected'}`;
  return configuration.target_label || 'Target not selected';
}

function Field({ C, label, value, mono = false }) {
  if (!value) return null;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: C.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: C.text1, fontFamily: mono ? C.mono : C.sans, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

export default function RunContextSummary({
  C,
  caseTitle,
  variantTitle = null,
  profileLabel,
  configuration,
  configurationDigest,
  assessmentState,
  onRerun,
  running = false,
}) {
  const state = assessmentState?.state ?? 'idle';
  const tone = C[STATE_TONE[state]] || C.text3;
  const judge = configuration?.judge?.enabled ? (configuration.judge.model_id || 'judge model not selected') : null;

  return (
    <div
      role="status"
      aria-live={state === 'error' ? 'assertive' : 'polite'}
      style={{
        background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${tone}`,
        borderRadius: 2, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px', alignItems: 'flex-end' }}>
        <Field C={C} label="Case" value={caseTitle} />
        <Field C={C} label="Variant" value={variantTitle} />
        <Field C={C} label="Control profile" value={profileLabel} />
        <Field C={C} label="Target" value={targetSummary(configuration)} />
        <Field C={C} label="Judge" value={judge} />
        <Field C={C} label="Trials" value={configuration?.trial_count > 1 ? configuration.trial_count : null} />
        <Field C={C} label="Configuration digest" value={configurationDigest ? `${configurationDigest.slice(0, 16)}…` : 'calculating…'} mono />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ color: tone, fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase' }}>{state}</span>
        <span style={{ color: C.text3, fontSize: 11.5 }}>{assessmentState?.message}</span>
        {state === 'stale' && onRerun && (
          <button onClick={onRerun} disabled={running} style={{
            marginLeft: 'auto', padding: '5px 12px', fontSize: 11, fontWeight: 800, letterSpacing: .5,
            background: C.amberBg, border: `1px solid ${C.ochre}`, color: C.ochre, borderRadius: 2,
            cursor: running ? 'not-allowed' : 'pointer',
          }}>
            RERUN WITH CURRENT CONFIGURATION
          </button>
        )}
      </div>
      {state === 'stale' && assessmentState?.changes?.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, color: C.text2, fontSize: 11.5, lineHeight: 1.5 }}>
          {assessmentState.changes.map(change => (
            <li key={change.path}><strong>{change.label}</strong>: {change.before} → {change.after}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
