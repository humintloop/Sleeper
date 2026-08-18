const fallback = {
  red: '#DC4838',
  amber: '#C87844',
  teal: '#00CFC4',
  blue: '#6D8FD6',
  green: '#4EBA6F',
  ochre: '#B99242',
  slate: '#6B7A99',
  text3: '#68738A',
  surface: '#0D0D0C',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

// Two vocabularies, kept in one lookup table now that this is the only
// verdict-display component left. The probe entries
// (SUCCESS/PARTIAL/FAILURE/FAILED/REVIEW) are retained for any
// exported finding record that still carries the old vocabulary; the
// CONTROL_* entries are computeVerdict.js's control vocabulary, the one the
// app actually produces going forward. They answer different questions —
// "did the model resist" vs. "did the control hold" — and must never be
// read as the same claim, but a shared label/color lookup is safe: nothing
// in the UI mixes the two vocabularies into one badge.
export const verdictDisplay = {
  SUCCESS: { label: 'PROBE SUCCEEDED', tone: 'red' },
  PARTIAL: { label: 'PARTIAL HIT', tone: 'amber' },
  FAILURE: { label: 'MODEL HELD', tone: 'teal' },
  FAILED: { label: 'MODEL HELD', tone: 'teal' },
  REVIEW: { label: 'REVIEW REQUIRED', tone: 'blue' },
  CONTROL_HELD: { label: 'CONTROL HELD', tone: 'green' },
  PARTIAL_CONTROL_FAILURE: { label: 'PARTIAL CONTROL FAILURE', tone: 'ochre' },
  CONTROL_FAILED: { label: 'CONTROL FAILED', tone: 'red' },
  INCONCLUSIVE: { label: 'INCONCLUSIVE', tone: 'slate' },
};

export function getVerdictLabel(verdict) {
  const key = String(verdict || '').toUpperCase();
  return verdictDisplay[key]?.label || key || 'UNKNOWN';
}

export function getVerdictColor(verdict, C = fallback) {
  const key = String(verdict || '').toUpperCase();
  const tone = verdictDisplay[key]?.tone;
  return tone ? C[tone] : C.text3;
}

export default function VerdictBanner({ C = fallback, verdict, note, compact = false }) {
  const color = getVerdictColor(verdict, C);
  return (
    <div style={{
      padding: compact ? '7px 10px' : '11px 16px',
      border: `1px solid ${color}44`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 2,
      background: C.surface || fallback.surface,
      textAlign: compact ? 'left' : 'center',
    }}>
      <div style={{
        fontFamily: C.mono,
        fontSize: compact ? 12 : 14,
        color,
        letterSpacing: '0.14em',
        fontWeight: 800,
      }}>
        {getVerdictLabel(verdict)}
      </div>
      {note && (
        <div style={{ marginTop: 5, fontSize: 13, color: C.text2 || C.text3, lineHeight: 1.45 }}>
          {note}
        </div>
      )}
    </div>
  );
}
