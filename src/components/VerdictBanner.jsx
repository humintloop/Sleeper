const fallback = {
  red: '#DC4838',
  amber: '#C87844',
  teal: '#00CFC4',
  blue: '#6D8FD6',
  text3: '#68738A',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

export const verdictDisplay = {
  SUCCESS: { label: 'PROBE SUCCEEDED', tone: 'red' },
  PARTIAL: { label: 'PARTIAL HIT', tone: 'amber' },
  FAILURE: { label: 'MODEL HELD', tone: 'teal' },
  FAILED: { label: 'MODEL HELD', tone: 'teal' },
  REVIEW: { label: 'REVIEW REQUIRED', tone: 'blue' },
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
      borderRadius: 4,
      background: `${color}12`,
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
