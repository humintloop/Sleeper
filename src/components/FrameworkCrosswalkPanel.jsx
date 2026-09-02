// Surfaces an agent case's framework mappings (src/data/agentCases.js
// `mappings[]`, `published_crosswalk`, `asi_cross_references`) — a different
// shape from the single-turn FrameworkMappingExplainer's `buildCaseMapping`,
// so this is a new component rather than a reuse.
//
// Per docs/agent-module-plan.md §"Display priority": one framework is primary
// per case, the rest collapse into "additional mappings". Every mapping is
// labeled direct or inferred — almost everything is inferred; the only direct
// material is the OWASP-published crosswalk and the as-published half of an
// ASI cross-reference. The two must never read as the same kind of claim.

const FRAMEWORK_LABEL = {
  mitre_atlas: 'MITRE ATLAS',
  mitre_atlas_mitigation: 'MITRE ATLAS Mitigation',
  owasp_llm: 'OWASP LLM Top 10',
  owasp_asi: 'OWASP Agentic (ASI)',
  aiuc_1: 'AIUC-1',
};

function RelationshipTag({ C, relationship }) {
  const direct = relationship === 'direct';
  const color = direct ? C.green : C.text3;
  return (
    <span style={{
      fontSize: C.size.micro, color, fontWeight: 800, letterSpacing: .2,
      border: `1px solid ${color}55`, borderRadius: 2, padding: '1px 6px',
    }}>
      {direct ? 'direct' : 'inferred'}
    </span>
  );
}

function MappingRow({ C, mapping }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 10px', borderBottom: `1px solid ${C.border}`, alignItems: 'flex-start' }}>
      <div style={{ flex: '0 0 130px', fontFamily: C.mono, fontSize: C.size.micro, color: mapping.role === 'primary' ? C.brass : C.text2, fontWeight: mapping.role === 'primary' ? 800 : 600 }}>
        {mapping.id}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
          <span style={{ fontSize: C.size.small, color: C.text1, fontWeight: 600 }}>{mapping.name || mapping.id}</span>
          {mapping.role === 'primary' && (
            <span style={{ fontSize: C.size.micro, color: C.brass, fontWeight: 800, letterSpacing: .2 }}>lead</span>
          )}
          <RelationshipTag C={C} relationship={mapping.relationship} />
        </div>
        {mapping.rationale && <div style={{ fontSize: C.size.micro, color: C.text3, lineHeight: 1.5 }}>{mapping.rationale}</div>}
      </div>
    </div>
  );
}

function FrameworkGroup({ C, framework, mappings, defaultOpen }) {
  return (
    <details open={defaultOpen} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
      <summary style={{ cursor: 'pointer', padding: '9px 12px', fontSize: C.size.micro, color: C.text2, fontWeight: 800, letterSpacing: .2, background: C.surface }}>
        {FRAMEWORK_LABEL[framework] || framework} <span style={{ color: C.text3, fontWeight: 500, textTransform: 'none' }}>({mappings.length})</span>
      </summary>
      <div>
        {mappings.map((m, i) => <MappingRow C={C} mapping={m} key={`${m.id}-${i}`} />)}
      </div>
    </details>
  );
}

export default function FrameworkCrosswalkPanel({ C, agentCase }) {
  if (!agentCase) return null;
  const mappings = agentCase.mappings || [];
  const byFramework = new Map();
  for (const m of mappings) {
    if (!byFramework.has(m.framework)) byFramework.set(m.framework, []);
    byFramework.get(m.framework).push(m);
  }
  const primaryFramework = agentCase.primary_framework;
  const orderedFrameworks = [...byFramework.keys()].sort((a, b) => (a === primaryFramework ? -1 : b === primaryFramework ? 1 : 0));

  const crosswalk = agentCase.published_crosswalk;
  const asiRefs = agentCase.asi_cross_references || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {agentCase.primary_framework_note && (
        <div style={{ fontSize: C.size.small, color: C.text2, lineHeight: 1.55, background: C.surface, border: `1px solid ${C.brass}44`, borderLeft: `3px solid ${C.brass}`, borderRadius: 2, padding: '9px 12px' }}>
          <span style={{ color: C.brass, fontWeight: 800, letterSpacing: .2, fontSize: C.size.micro, marginRight: 6 }}>
            {FRAMEWORK_LABEL[primaryFramework] || primaryFramework} leads
          </span>
          {agentCase.primary_framework_note}
        </div>
      )}

      {orderedFrameworks.map(framework => (
        <FrameworkGroup
          C={C}
          key={framework}
          framework={framework}
          mappings={byFramework.get(framework)}
          defaultOpen={framework === primaryFramework}
        />
      ))}

      {crosswalk?.rows?.length > 0 && (
        <div style={{ background: C.panel, border: `1px solid ${C.green}44`, borderRadius: 2, padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: C.size.micro, color: C.green, fontWeight: 800, letterSpacing: .2 }}>OWASP-published crosswalk</span>
            <RelationshipTag C={C} relationship="direct" />
          </div>
          <div style={{ fontSize: C.size.micro, color: C.text3, lineHeight: 1.5, marginBottom: 8 }}>{crosswalk.note}</div>
          {crosswalk.rows.map((row, i) => (
            <div key={i} style={{ fontSize: C.size.micro, color: C.text2, padding: '6px 0', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ fontFamily: C.mono, color: C.text1, fontWeight: 700, marginBottom: 4 }}>{row.owasp_llm}</div>
              {row.asi?.length > 0 && <div>ASI: <span style={{ fontFamily: C.mono }}>{row.asi.join(', ')}</span></div>}
              {row.atlas_tactics_primary?.length > 0 && <div>ATLAS tactics: <span style={{ fontFamily: C.mono }}>{row.atlas_tactics_primary.join(', ')}</span></div>}
              {row.nist_ai_rmf_categories?.length > 0 && <div>NIST AI RMF: <span style={{ fontFamily: C.mono }}>{row.nist_ai_rmf_categories.join(', ')}</span></div>}
            </div>
          ))}
        </div>
      )}

      {asiRefs.length > 0 && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2, padding: '10px 12px' }}>
          <div style={{ fontSize: C.size.micro, color: C.text3, fontWeight: 800, letterSpacing: .2, marginBottom: 4 }}>ASI cross-reference</div>
          <div style={{ fontSize: C.size.micro, color: C.text3, lineHeight: 1.5, marginBottom: 8 }}>
            OWASP&rsquo;s Agentic (ASI) top 10 was published before the 2026 LLM edition, so its own text cites the
            older LLM numbering. The ID as OWASP printed it stays exact; the current-edition equivalent is
            this project&rsquo;s own translation, kept alongside rather than substituted in.
          </div>
          {asiRefs.map((ref, i) => (
            <div key={i} style={{ fontSize: C.size.micro, color: C.text2, lineHeight: 1.6, marginBottom: i < asiRefs.length - 1 ? 8 : 0 }}>
              <span style={{ color: C.brass, fontFamily: C.mono }}>{ref.asi}</span> ({ref.asi_name}) published against{' '}
              <span style={{ fontFamily: C.mono }}>{ref.published?.llm_id}</span> <RelationshipTag C={C} relationship="direct" />, current edition equivalent{' '}
              <span style={{ fontFamily: C.mono }}>{ref.current_edition?.llm_id}</span> <RelationshipTag C={C} relationship="inferred" />
            </div>
          ))}
        </div>
      )}

      {agentCase.claim_boundary && (
        <div style={{ fontSize: C.size.micro, color: C.text3, fontStyle: 'italic', lineHeight: 1.5 }}>{agentCase.claim_boundary}</div>
      )}
    </div>
  );
}
