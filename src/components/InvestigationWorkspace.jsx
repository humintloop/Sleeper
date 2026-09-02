// Phase 2 workspace navigation: Compare / Trace / Evidence / Report as a
// stable tabbed surface, replacing the long stacked-and-<details> result
// page. Pure navigation shell — it renders whichever tab's content it is
// given and owns no security or verdict logic itself.
import { useRef, useState } from 'react';

export default function InvestigationWorkspace({ C, tabs, defaultTabId }) {
  const available = tabs.filter(tab => !tab.hidden);
  const [activeId, setActiveId] = useState(defaultTabId ?? available[0]?.id);
  const tabRefs = useRef({});
  const active = available.find(tab => tab.id === activeId) ?? available[0];

  const focusTab = id => tabRefs.current[id]?.focus();

  const onKeyDown = (event, index) => {
    const count = available.length;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = available[(index + (event.key === 'ArrowRight' ? 1 : count - 1)) % count];
      setActiveId(next.id);
      focusTab(next.id);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveId(available[0].id);
      focusTab(available[0].id);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveId(available[count - 1].id);
      focusTab(available[count - 1].id);
    }
  };

  if (!active) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div role="tablist" aria-label="Investigation workspace" style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {available.map((tab, index) => {
          const selected = tab.id === active.id;
          return (
            <button
              key={tab.id}
              ref={el => { tabRefs.current[tab.id] = el; }}
              role="tab"
              id={`workspace-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`workspace-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={event => onKeyDown(event, index)}
              style={{
                padding: '9px 16px', fontSize: C.size.small, fontWeight: 800, letterSpacing: .2,
                cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: `2px solid ${selected ? C.brass : 'transparent'}`,
                color: selected ? C.brass : C.text3, display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: -1,
              }}
            >
              {tab.label}
              {tab.badge != null && (
                <span style={{
                  fontSize: C.size.micro, fontWeight: 900, padding: '1px 6px', borderRadius: 2,
                  background: selected ? C.brassBg : C.surface, color: selected ? C.brass : C.text3,
                  border: `1px solid ${selected ? C.brass : C.borderHi}`,
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {available.map(tab => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`workspace-panel-${tab.id}`}
          aria-labelledby={`workspace-tab-${tab.id}`}
          hidden={tab.id !== active.id}
        >
          {tab.id === active.id && tab.content}
        </div>
      ))}
    </div>
  );
}
