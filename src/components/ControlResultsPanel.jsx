// Renders a computeVerdict.js verdict object — {verdict, reason, outcomes,
// scope, evidence_limitations} — not ORPHEUS's flat control_verdict string.
//
// Label and color come from VerdictBanner.jsx's shared verdictDisplay rather
// than a second local copy of the same mapping — that duplication was the
// exact confusion docs/coherence-review.md (U4) flagged: the raw enum string
// rendered here, a different color mapping from the one other verdict
// surfaces used.
import { getVerdictColor, getVerdictLabel } from './VerdictBanner';

// This screen's CONTROL_* vocabulary answers "did the exercised control hold?"
// Keep that scope explicit without referring to a deleted legacy workflow.
const VERDICT_PLAIN_LANGUAGE = {
  CONTROL_HELD: 'The control held — the exercised controls caught the attempted action.',
  PARTIAL_CONTROL_FAILURE: 'Partial control failure — at least one control failed while others held.',
  CONTROL_FAILED: 'Control failed — no exercised control caught the attempted action.',
  INCONCLUSIVE: 'Inconclusive — not enough was exercised in this run to say either way.',
};

const OUTCOME_TONE = { held: 'green', failed: 'red', unexercised: 'slate' };

const CONTROL_LABEL = {
  adversarial_detection: 'Adversarial Input Detection',
  tool_authorization: 'Tool-Use Authorization',
  pii_leakage_guard: 'PII Leakage Prevention',
};

function OutcomeTag({ C, outcome }) {
  const color = C[OUTCOME_TONE[outcome]] || C.text3;
  return (
    <span style={{
      fontSize: 11, color, fontWeight: 800, letterSpacing: .5,
      border: `1px solid ${color}55`, padding: '3px 8px', borderRadius: 2,
    }}>
      {outcome?.toUpperCase()}
    </span>
  );
}

function humanizeReason(text = '') {
  return text
    .replaceAll('adversarial_detection', 'adversarial input detection')
    .replaceAll('tool_authorization', 'tool-use authorization')
    .replaceAll('pii_leakage_guard', 'PII leakage prevention');
}

export default function ControlResultsPanel({ C, verdict, profiles, comparisonHistory }) {
  if (!verdict) return null;
  const color = getVerdictColor(verdict.verdict, C);
  const outcomes = verdict.outcomes || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '14px 16px', borderRadius: 2, background: C.surface, border: `1px solid ${color}55`, borderLeft: `3px solid ${color}` }}>
        <div style={{ fontSize: 10, color: C.text3, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 }}>
          Outcome for exercised controls
        </div>
        <div style={{ fontSize: 20, color, fontWeight: 900, letterSpacing: .3, marginBottom: 4 }}>
          {getVerdictLabel(verdict.verdict)}
        </div>
        <div style={{ fontSize: 13, color: C.text1, lineHeight: 1.5, marginBottom: verdict.reason?.text ? 8 : 0 }}>
          {VERDICT_PLAIN_LANGUAGE[verdict.verdict]}
        </div>
        {verdict.reason?.text && (
          <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>{humanizeReason(verdict.reason.text)}</div>
        )}
        {verdict.reason?.code && (
          <div style={{ fontSize: 10.5, color: C.text3, fontFamily: C.mono, marginTop: 6 }}>{verdict.reason.code}</div>
        )}
        <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.5, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          This verdict describes only the controls actually exercised in this run. It does not prove that the model is
          safe, that the target has production controls, or that the same result will occur on another run.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(CONTROL_LABEL).map(([key, label]) => {
          const row = outcomes[key];
          if (!row) return null;
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', fontSize: 13, color: C.text1, fontWeight: 600 }}>{label}</div>
              <OutcomeTag C={C} outcome={row.outcome} />
              <div style={{ flex: '2 1 240px', fontSize: 12, color: C.text2, lineHeight: 1.4 }}>{row.text}</div>
            </div>
          );
        })}
      </div>

      {verdict.evidence_limitations?.length > 0 && (
        <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.5 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6, color: C.text3 }}>Evidence limitations</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {verdict.evidence_limitations.map((note, i) => <li key={i} style={{ marginBottom: 3 }}>{note}</li>)}
          </ul>
        </div>
      )}

      {comparisonHistory && Object.keys(comparisonHistory).length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: C.text3, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 }}>
            Comparative arm — same case, other profiles
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.values(profiles).map(profile => {
              const v = comparisonHistory[profile.id];
              const tone = v ? getVerdictColor(v, C) : C.borderHi;
              return (
                <div key={profile.id} style={{
                  padding: '8px 12px', borderRadius: 2, background: C.surface,
                  border: `1px solid ${v ? tone + '55' : C.border}`, borderLeft: `3px solid ${tone}`,
                  minWidth: 150,
                }}>
                  <div style={{ fontSize: 11, color: C.text2, fontWeight: 700, marginBottom: 3 }}>{profile.label}</div>
                  <div style={{ fontSize: 11, color: tone, fontWeight: 800, letterSpacing: .5 }}>
                    {v ? getVerdictLabel(v) : 'NOT RUN YET'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
