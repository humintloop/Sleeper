import {
  ASSURANCE_PROFILE,
  CONTROL_SET,
  FRAMEWORK_REFERENCES,
  buildCaseMapping,
} from '../data/frameworkMappings';
import { getMitigationMapping } from '../data/mitigationMappings';

export default function FrameworkMappingExplainer({
  C,
  techniqueId,
  techniqueName,
  owasp,
  payload,
  finding,
  compact = false,
}) {
  const mapping = finding ? {
    mapped_controls: finding.mappedControls || finding.mapped_controls || [],
    nist_ai_rmf: finding.nistAiRmf || finding.nist_ai_rmf || [],
    eu_ai_act_relevance: finding.euAiActRelevance || finding.eu_ai_act_relevance || [],
    eu_ai_act_scope: finding.euAiActScope || finding.eu_ai_act_scope || ASSURANCE_PROFILE.eu_ai_act_scope.default_status,
    iso_42001_relevance: finding.iso42001Relevance || finding.iso_42001_relevance || [],
    readiness_gaps: finding.readinessGaps || finding.readiness_gaps || [],
  } : buildCaseMapping(techniqueId, payload || {});
  const mitigation = getMitigationMapping(techniqueId);
  const mappedControls = (mapping.mapped_controls || []).map(id => CONTROL_SET[id]).filter(Boolean);
  const officialMitigations = finding?.officialMitigations || finding?.official_mitigations || mitigation.official_mitigations || [];
  const recommendedMitigations = finding?.recommendedMitigations || finding?.recommended_mitigations || mitigation.recommended_mitigations || [];
  const retestGuidance = finding?.retestGuidance || finding?.retest_guidance || mitigation.retest_guidance || [];
  const mitreLabel = FRAMEWORK_REFERENCES.mitre_atlas[techniqueId] || techniqueName || techniqueId;
  const owaspLabel = FRAMEWORK_REFERENCES.owasp[owasp] || owasp;

  return (
    <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ padding: '9px 12px', borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,.012)' }}>
        <div style={{ fontSize: 11, color: C.text2, letterSpacing: 1.4, fontWeight: 800, textTransform: 'uppercase' }}>Control relevance</div>
        <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.45, marginTop: 4 }}>
          Traceability aid only. These mappings are not legal conclusions, certification evidence, or automatic noncompliance findings.
        </div>
      </div>
      <div style={{ padding: 12, display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
          <Mini C={C} label="MITRE ATLAS" value={mitreLabel} detail={techniqueId} />
          <Mini C={C} label="OWASP LLM Top 10" value={owaspLabel || 'Not mapped'} detail={owasp || 'No category'} />
          <Mini C={C} label="Profile" value={ASSURANCE_PROFILE.label} detail={mapping.eu_ai_act_scope || 'conditional-readiness'} />
        </div>

        <ListSection C={C} title="Mapped SLEEPER controls" items={mappedControls.map(control => ({
          key: control.id,
          title: `${control.id} - ${control.name}`,
          text: `${control.domain}: ${control.objective}`,
        }))} />

        {!compact && (
          <FrameworkGapTable
            C={C}
            techniqueId={techniqueId}
            mitreLabel={mitreLabel}
            owasp={owasp}
            owaspLabel={owaspLabel}
            mapping={mapping}
            finding={finding}
          />
        )}

        <ListSection C={C} title="Readiness gaps" items={(mapping.readiness_gaps || []).map((text, idx) => ({ key: idx, title: `Gap ${idx + 1}`, text }))} />
        {!compact && officialMitigations.length > 0 && (
          <ListSection C={C} title="Official mitigation references" items={officialMitigations.map(item => ({
            key: item.id,
            title: `${item.source}: ${item.id}`,
            text: item.name,
          }))} />
        )}
        {!compact && recommendedMitigations.length > 0 && (
          <ListSection C={C} title="Recommended actions" items={recommendedMitigations.map((text, idx) => ({ key: idx, title: `Action ${idx + 1}`, text }))} />
        )}
        {!compact && retestGuidance.length > 0 && (
          <ListSection C={C} title="Retest guidance" items={retestGuidance.map((text, idx) => ({ key: idx, title: `Retest ${idx + 1}`, text }))} />
        )}
      </div>
    </section>
  );
}

function FrameworkGapTable({ C, techniqueId, mitreLabel, owasp, owaspLabel, mapping, finding }) {
  const effectiveness = finding?.effectivenessAssessment || finding?.effectiveness_assessment || 'NOT ASSESSED';
  const controlGap = finding?.controlGapStatement || 'Control gap statement not completed — finding is not audit-ready.';
  const success = ['SUCCESS', 'PARTIAL'].includes(finding?.verdict);
  const isoClauses = mapping.iso_42001_relevance || [];
  const euArticles = mapping.eu_ai_act_relevance || [];
  const nistFunctions = mapping.nist_ai_rmf || [];
  const row = (framework, clause, summary, gap, applicable = true) => ({
    framework,
    clause,
    summary,
    gap,
    applicable,
  });
  const rows = [
    row(
      'MITRE ATLAS',
      techniqueId || 'Unmapped',
      mitreLabel || 'Mapped adversarial technique',
      success ? 'Technique confirmed in this case' : 'Technique considered for this probe',
      Boolean(techniqueId),
    ),
    row(
      'OWASP LLM',
      owasp || 'Not mapped',
      owaspLabel || 'No OWASP LLM Top 10 category mapped',
      owasp ? 'Direct evidence reviewed against this exposure category' : 'Not applicable to this assurance profile',
      Boolean(owasp),
    ),
    row(
      'ISO/IEC 42001',
      isoClauses.join(', ') || 'Not mapped',
      isoClauses.map(id => `${id}: ${FRAMEWORK_REFERENCES.iso_42001[id] || id}`).join(' ') || 'No Clause 9 relevance mapped for this case',
      isoClauses.length ? controlGap : 'Not applicable to this assurance profile',
      isoClauses.length > 0,
    ),
    row(
      'EU AI Act',
      euArticles.join(', ') || 'Not mapped',
      euArticles.map(id => `${id}: ${FRAMEWORK_REFERENCES.eu_ai_act[id] || id}`).join(' ') || 'No high-risk readiness article mapped for this case',
      euArticles.length ? `Conformity-readiness gap if system is high-risk; control assessed as ${effectiveness.replaceAll('_', ' ')}` : 'Not applicable to this assurance profile',
      euArticles.length > 0,
    ),
    row(
      'NIST AI RMF',
      nistFunctions.join(', ') || 'Not mapped',
      nistFunctions.map(id => `${id}: ${FRAMEWORK_REFERENCES.nist_ai_rmf[id] || id}`).join(' ') || 'No AI RMF function mapped for this case',
      nistFunctions.length ? `Monitoring or risk-treatment gap indicated; control assessed as ${effectiveness.replaceAll('_', ' ')}` : 'Not applicable to this assurance profile',
      nistFunctions.length > 0,
    ),
  ];

  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 2.2fr 2.2fr', background: C.surface, borderBottom: `1px solid ${C.border}`, minWidth: 760 }}>
        {['Framework', 'Clause / Category', 'Requirement Summary', 'Gap'].map(label => (
          <div key={label} style={{ padding: '7px 8px', fontSize: 10, color: C.text3, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 900 }}>{label}</div>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        {rows.map(item => (
          <div key={item.framework} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.1fr 2.2fr 2.2fr',
            minWidth: 760,
            borderTop: `1px solid ${C.border}`,
            opacity: item.applicable ? 1 : .48,
            background: item.applicable ? 'transparent' : 'rgba(255,255,255,.015)',
          }}>
            <Cell C={C} strong>{item.framework}</Cell>
            <Cell C={C}>{item.clause}</Cell>
            <Cell C={C}>{item.summary}</Cell>
            <Cell C={C} accent={item.applicable}>{item.gap}</Cell>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cell({ C, children, strong, accent }) {
  return (
    <div style={{ padding: '8px 9px', fontSize: 12, color: accent ? C.amber : strong ? C.text1 : C.text2, lineHeight: 1.45 }}>
      {children}
    </div>
  );
}

function Mini({ C, label, value, detail }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2, padding: '9px 10px' }}>
      <div style={{ fontSize: 10, color: C.text3, letterSpacing: 1.3, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, color: C.text1, fontWeight: 800, lineHeight: 1.4, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>{detail}</div>
    </div>
  );
}

function ListSection({ C, title, items }) {
  if (!items.length) return null;
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 2, padding: '9px 10px' }}>
      <div style={{ fontSize: 10, color: C.text3, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 7 }}>{title}</div>
      <div style={{ display: 'grid', gap: 7 }}>
        {items.map(item => (
          <div key={item.key}>
            <div style={{ fontSize: 12, color: C.amber, fontWeight: 800 }}>{item.title}</div>
            <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.45, marginTop: 2 }}>{item.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
