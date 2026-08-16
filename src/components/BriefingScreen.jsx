import SignalBars from './SignalBars';

function Field({ C, label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.text3, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.55 }}>
        {children || 'Not specified'}
      </div>
    </div>
  );
}

export default function BriefingScreen({ C, cluster, payload, mapping, mode = 'compact' }) {
  if (!payload && mode === 'compact') return null;

  const color = C[cluster?.colorKey] || C.amber;
  const title = payload?.name || cluster?.name || 'Select a test case';
  const code = payload?.technique || cluster?.code || 'NO CASE';
  const owasp = cluster?.owasp || mapping?.owasp || '';
  const brief = cluster?.clusterBrief || {};

  return (
    <section style={{
      padding: mode === 'full' ? '34px 28px' : '12px 16px',
      borderBottom: mode === 'full' ? 'none' : `1px solid ${C.border}`,
      background: mode === 'full' ? 'transparent' : 'rgba(0,207,196,.035)',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: mode === 'full' ? '1fr' : 'minmax(0, 1fr) auto',
        gap: 14,
        alignItems: 'center',
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        background: C.panel,
        borderRadius: 4,
        padding: mode === 'full' ? '22px 24px' : '12px 14px',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 7 }}>
            Case File // {code}{owasp ? ` // ${owasp}` : ''}
          </div>
          <div style={{ fontSize: mode === 'full' ? 22 : 15, color: C.text1, fontWeight: 800, letterSpacing: '.03em', marginBottom: 6 }}>
            {title}
          </div>
          <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.55 }}>
            {payload?.description || cluster?.description || 'Choose a case to load its briefing.'}
          </div>
        </div>
        {mode !== 'full' && <SignalBars C={C} color={color} label="probe brief" count={8} />}
      </div>

      {payload && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginTop: 12,
        }}>
          <Field C={C} label="Adversarial Goal">{payload.objective || brief.threat}</Field>
          <Field C={C} label="Expected Secure Behavior">{payload.expected_secure_behavior}</Field>
          <Field C={C} label="Failure Signal">{payload.failure_mode || brief.signal}</Field>
          <Field C={C} label="Primary Control">{mapping?.mapped_controls?.[0] || brief.control}</Field>
        </div>
      )}
    </section>
  );
}
