export default function ProbeWorkspace({ C, children }) {
  return (
    <div className="lab-shell" style={{
      flex: 1,
      display: 'flex',
      overflow: 'hidden',
      background: `linear-gradient(90deg, ${C.bg}, rgba(0,207,196,.025), ${C.bg})`,
    }}>
      {children}
    </div>
  );
}
