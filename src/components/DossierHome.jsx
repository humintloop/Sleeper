import { ChevronRight, FileText, FolderOpen, Play, RefreshCw } from 'lucide-react';
import { getVerdictColor, getVerdictLabel } from './VerdictBanner';

function groupFindingsByCase(findings = []) {
  const grouped = new Map();
  findings.forEach(finding => {
    const key = finding.caseFileId || finding.caseId || 'unassigned';
    const entry = grouped.get(key) || { caseFileId: key, count: 0, latestTimestamp: finding.timestamp, verdictCounts: {}, needsReview: false };
    entry.count += 1;
    if (!entry.latestTimestamp || new Date(finding.timestamp) > new Date(entry.latestTimestamp)) entry.latestTimestamp = finding.timestamp;
    entry.verdictCounts[finding.verdict || 'REVIEW'] = (entry.verdictCounts[finding.verdict || 'REVIEW'] || 0) + 1;
    if (!finding.reviewerDecision || finding.reviewerDecision === 'UNREVIEWED') entry.needsReview = true;
    grouped.set(key, entry);
  });
  return [...grouped.values()].sort((a, b) => new Date(b.latestTimestamp || 0) - new Date(a.latestTimestamp || 0));
}

function groupFindingsByCluster(findings = [], clusters = []) {
  const counts = {};
  findings.forEach(f => {
    const technique = f.techniqueId || '';
    const cluster = clusters.find(cl => cl.payloads.some(p => p.technique === technique || p.id === f.probeId));
    const label = cluster?.name || 'Other';
    counts[label] = (counts[label] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export default function DossierHome({ C, findings, clusters, activeCase, onEnter, onDemo, onSampleReport, onResume, onReport }) {
  const cases = groupFindingsByCase(findings);
  const coverage = groupFindingsByCluster(findings, clusters);
  const totalProbes = clusters.reduce((n, cl) => n + cl.payloads.length, 0);

  return (
    <main style={{ width: '100%', maxWidth: 980, margin: '0 auto', padding: '44px 24px 72px', display: 'flex', flexDirection: 'column', gap: 34 }}>
      {activeCase?.caseId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: C.amberBg, border: `1px solid ${C.amber}55`, borderLeft: `3px solid ${C.amber}`, borderRadius: 5, padding: '12px 16px' }}>
          <div style={{ flex: 1, minWidth: 220, fontSize: 14, color: C.text1, fontWeight: 600 }}>
            Resume <span style={{ color: C.amber, fontFamily: C.mono }}>{activeCase.caseId}</span> — probe {Math.min((activeCase.probeIndex || 0) + 1, activeCase.total || 1)}/{activeCase.total || 0} · {activeCase.findingsCount || 0} findings
          </div>
          <button onClick={onResume} style={primaryBtn(C)}>
            <RefreshCw size={13} /> Continue <ChevronRight size={13} />
          </button>
        </div>
      )}

      <section>
        <div style={{ fontSize: 11, color: C.text3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
          Local-first adversarial assurance
        </div>
        <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 52, color: C.amber, fontWeight: 700, letterSpacing: 10, lineHeight: 1, margin: 0 }}>NETRUNNER</h1>
        <p style={{ fontSize: 17, color: C.text1, lineHeight: 1.65, maxWidth: 720, marginTop: 16, marginBottom: 0 }}>
          NETRUNNER turns local LLM red-team runs into reviewable evidence, mapped control gaps, and retestable findings.
        </p>
        <p style={{ fontSize: 14, color: C.text3, lineHeight: 1.65, maxWidth: 760, marginTop: 10, marginBottom: 0 }}>
          Run structured probes in your browser, preserve the prompt and response evidence, classify the behavior, map it to controls and frameworks, then export a report a security or GRC reviewer can actually use.
        </p>
      </section>

      <section className="home-hero-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <EntryCard
          C={C}
          accent={C.amber}
          icon={<Play size={17} />}
          title="Run demo assessment"
          text="Use TinyLlama and a starter prompt-injection probe so you can see the attack → evidence → review path quickly."
          action="Start demo"
          onClick={onDemo}
          primary
        />
        <EntryCard
          C={C}
          accent={C.teal}
          icon={<FolderOpen size={17} />}
          title="Start local case"
          text="Configure the target prompt, model, probe set, judge review, evidence settings, and controls for a real assessment."
          action="Configure case"
          onClick={onEnter}
        />
        <EntryCard
          C={C}
          accent={C.blue}
          icon={<FileText size={17} />}
          title="Review sample report"
          text="Skip model loading and inspect a completed sample finding with evidence, mappings, mitigation, and retest guidance."
          action="Open sample"
          onClick={onSampleReport}
        />
      </section>

      <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 5, padding: '18px 20px' }}>
        <SectionHeading C={C} label="Assessment flow" />
        <div className="home-hero-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
          {[
            ['Attack', 'Run a structured local probe against the selected model.'],
            ['Evidence', 'Preserve payload, prompt hash, model/runtime metadata, and full response.'],
            ['Review', 'Compare heuristic and judge signals, then record the reviewer decision.'],
            ['Control gap', 'Map behavior to controls, frameworks, and plain-English risk statements.'],
            ['Mitigate + retest', 'Use recommended actions and rerun the same probe after changes.'],
          ].map(([title, text]) => (
            <div key={title} style={{ background: C.bg, border: `1px solid ${C.border}`, borderTop: `2px solid ${C.teal}66`, borderRadius: 4, padding: '12px 13px' }}>
              <div style={{ fontSize: 13, color: C.text1, fontWeight: 800, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12.5, color: C.text3, lineHeight: 1.55 }}>{text}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <Stat C={C} value={clusters.length} label="technique clusters" />
        <Stat C={C} value={totalProbes} label="probes available" />
        <Stat C={C} value={findings.length} label="findings captured" />
      </div>

      {cases.length > 0 && (
        <section>
          <SectionHeading C={C} icon={<FolderOpen size={14} />} label="Recent assessments" />
          <div style={{ display: 'grid', gap: 8 }}>
            {cases.slice(0, 8).map(item => (
              <button key={item.caseFileId} onClick={onReport} style={{
                textAlign: 'left', background: C.panel, border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${item.needsReview ? C.amber : C.teal}`,
                borderRadius: 4, padding: '12px 14px', cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, color: C.amber, fontWeight: 700, fontFamily: C.mono }}>{item.caseFileId}</span>
                  <span style={{ fontSize: 13, color: C.text3 }}>{item.count} finding{item.count !== 1 ? 's' : ''}</span>
                  {item.needsReview && <span style={{ fontSize: 12, color: C.amber }}>needs review</span>}
                  <span style={{ fontSize: 13, color: C.text3, marginLeft: 'auto' }}>{new Date(item.latestTimestamp).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {Object.entries(item.verdictCounts).map(([verdict, count]) => (
                    <span key={verdict} style={{ fontSize: 11, color: getVerdictColor(verdict, C), border: `1px solid ${getVerdictColor(verdict, C)}44`, padding: '2px 7px', borderRadius: 2 }}>
                      {getVerdictLabel(verdict)} {count}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {coverage.length > 0 && (
        <section>
          <SectionHeading C={C} label="Evidence coverage" />
          <div style={{ display: 'grid', gap: 6 }}>
            {coverage.map(([label, count]) => {
              const cluster = clusters.find(cl => cl.name === label);
              const color = cluster ? (C[cluster.colorKey] || C.amber) : C.text3;
              const pct = Math.round((count / findings.length) * 100);
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                  <div style={{ flex: 1, fontSize: 14, color: C.text1, fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: 13, color, fontWeight: 700, fontFamily: C.mono }}>{count} {count === 1 ? 'finding' : 'findings'}</div>
                  <div style={{ width: 80, height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

function EntryCard({ C, accent, icon, title, text, action, onClick, primary }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', background: primary ? `${accent}18` : C.panel,
      border: `1px solid ${primary ? accent : C.border}`,
      borderTop: `3px solid ${accent}`, borderRadius: 5, padding: '16px 16px 15px',
      cursor: 'pointer', minHeight: 210, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 4, background: `${accent}1F`, border: `1px solid ${accent}55`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 17, color: C.text1, fontWeight: 800, marginBottom: 7 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6 }}>{text}</div>
      </div>
      <div style={{ marginTop: 'auto', color: primary ? C.amber : accent, fontSize: 12, fontWeight: 900, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        {action} <ChevronRight size={13} />
      </div>
    </button>
  );
}

function SectionHeading({ C, icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.text3, letterSpacing: 1.6, fontWeight: 700, textTransform: 'uppercase', marginBottom: 14 }}>
      {icon}{label}
    </div>
  );
}

function Stat({ C, value, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 22, color: C.text1, fontWeight: 800 }}>{value}</span>
      <span style={{ fontSize: 12, color: C.text3 }}>{label}</span>
    </div>
  );
}

function primaryBtn(C) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '11px 18px', background: C.amber, color: C.ink,
    border: `1px solid ${C.amber}`, borderRadius: 4, cursor: 'pointer',
    fontSize: 13, fontWeight: 800, letterSpacing: 1.2,
  };
}
