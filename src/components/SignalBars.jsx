const fallback = {
  amber: '#C87844',
  text3: '#68738A',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

export default function SignalBars({ C = fallback, color = C.amber, label, count = 12 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <style>{`
        @keyframes sleeperBar {
          0%, 100% { height: 9px; opacity: .25; }
          45% { height: 38px; opacity: .88; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 42 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 3,
              borderRadius: 2,
              backgroundColor: color,
              opacity: 0.75,
              animation: `sleeperBar 1.35s ease-in-out ${(i * 0.08).toFixed(2)}s infinite`,
            }}
          />
        ))}
      </div>
      {label && (
        <span style={{
          fontFamily: C.mono,
          fontSize: 10,
          color,
          letterSpacing: '0.18em',
          opacity: 0.72,
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
      )}
    </div>
  );
}
