import { useEffect, useState } from 'react';
import { Download, FileText, Trash2 } from 'lucide-react';
import { getVerdictColor, getVerdictLabel } from './VerdictBanner';

export default function FindingsReport({
  C,
  findings,
  exportFindings,
  exportReport,
  exportAuditBrief,
  clearFindings,
  children,
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const counts = findings.reduce((acc, finding) => {
    const key = finding.verdict || 'REVIEW';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const activeCount = findings.filter(f => (f.reviewerDecision || f.reviewer_decision) !== 'FALSE_POSITIVE').length;
  const clearMessage = activeCount === 1
    ? 'This will remove SLEEPER-owned local case data, 1 locally stored finding, assessment metadata, and locally persisted evidence from this browser. Downloaded exports are not deleted.'
    : `This will remove SLEEPER-owned local case data, ${activeCount} locally stored findings, assessment metadata, and locally persisted evidence from this browser. Downloaded exports are not deleted.`;
  const clearAnyway = () => {
    setConfirmClear(false);
    clearFindings();
  };
  const confirmedCount = findings.filter(f => (f.reviewerDecision || f.reviewer_decision) === 'CONFIRMED').length;
  const mappedControlCount = new Set(findings.flatMap(f => f.mappedControls || f.mapped_controls || f.selectedControlIds || [])).size;
  const retestCount = findings.filter(f => (f.reviewerDecision || f.reviewer_decision) === 'NEEDS_RETEST' || (f.retestGuidance || f.retest_guidance || []).length > 0).length;

  useEffect(() => {
    if (!activeCount) return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [activeCount]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: C.text2, letterSpacing: 1.5, fontWeight: 700, flex: 1 }}>
          REPORT · {findings.length} FINDING{findings.length !== 1 ? 'S' : ''}
        </span>
        {findings.length > 0 && (
          <div className="report-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={exportReport} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
              background: C.amber, border: `1px solid ${C.amber}`, color: C.ink,
              fontSize: 14, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', borderRadius: 2,
            }}>
              <FileText size={11} /> EXPORT REPORT
            </button>
            <button onClick={exportFindings} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
              background: C.surface, border: `1px solid ${C.borderHi}`, color: C.text2,
              fontSize: 14, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', borderRadius: 2,
            }}>
              <Download size={11} /> EXPORT JSON
            </button>
            <button onClick={exportAuditBrief} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
              background: C.surface, border: `1px solid ${C.borderHi}`, color: C.text2,
              fontSize: 14, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', borderRadius: 2,
            }}>
              <FileText size={11} /> AUDIT BRIEF
            </button>
            <button onClick={() => setConfirmClear(true)} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
              background: 'transparent', border: `1px solid ${C.border}`, color: C.text3,
              fontSize: 14, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', borderRadius: 2,
            }}>
              <Trash2 size={11} /> CLEAR LOCAL DATA
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {findings.length > 0 && (
          <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${confirmedCount ? C.red : C.teal}`, borderRadius: 3, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: C.text1, fontWeight: 800, marginBottom: 6 }}>Assessment summary</div>
            <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>
              This report connects model-response evidence to reviewer decisions, impacted controls, mitigation actions, and retest guidance.
              {confirmedCount > 0 ? ` ${confirmedCount} confirmed finding${confirmedCount === 1 ? '' : 's'} should be reviewed as control-gap evidence.` : ' Findings still need reviewer confirmation before they become audit-ready evidence.'}
              {mappedControlCount > 0 && ` ${mappedControlCount} mapped control${mappedControlCount === 1 ? '' : 's'} appear in the current evidence set.`}
              {retestCount > 0 && ` ${retestCount} finding${retestCount === 1 ? '' : 's'} include retest guidance so fixes can be verified.`}
            </div>
          </section>
        )}

        {findings.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            {['SUCCESS', 'PARTIAL', 'FAILURE', 'REVIEW'].map(verdict => {
              const color = getVerdictColor(verdict, C);
              return (
                <div key={verdict} style={{ background: C.panel, border: `1px solid ${C.border}`, borderTop: `2px solid ${color}`, padding: '10px 12px', borderRadius: 3 }}>
                  <div style={{ fontSize: 22, color, fontWeight: 900 }}>{counts[verdict] || 0}</div>
                  <div style={{ fontSize: 11, color: C.text3, letterSpacing: 1 }}>{getVerdictLabel(verdict)}</div>
                </div>
              );
            })}
          </div>
        )}

        {children}
      </div>

      {confirmClear && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(10,12,22,.78)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 18,
        }}>
          <div style={{
            width: 'min(520px, 100%)',
            background: C.panel,
            border: `1px solid ${C.amber}55`,
            borderLeft: `3px solid ${C.amber}`,
            borderRadius: 4,
            padding: '18px 20px',
            boxShadow: '0 24px 80px rgba(0,0,0,.42)',
          }}>
            <div style={{ fontSize: 12, color: C.amber, letterSpacing: 1.4, fontWeight: 900, marginBottom: 8 }}>
              CLEAR LOCAL ASSESSMENT DATA
            </div>
            <div style={{ fontSize: 14, color: C.text1, lineHeight: 1.55, marginBottom: 16 }}>
              {clearMessage}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={exportFindings} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px',
                background: C.surface, border: `1px solid ${C.borderHi}`, color: C.text2,
                fontSize: 12, fontWeight: 800, letterSpacing: 1, cursor: 'pointer', borderRadius: 2,
              }}>
                <Download size={11} /> EXPORT JSON
              </button>
              <button onClick={exportReport} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px',
                background: C.amberBg, border: `1px solid ${C.amber}55`, color: C.amber,
                fontSize: 12, fontWeight: 800, letterSpacing: 1, cursor: 'pointer', borderRadius: 2,
              }}>
                <FileText size={11} /> EXPORT REPORT
              </button>
              <button onClick={clearAnyway} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px',
                background: C.redBg, border: `1px solid ${C.red}55`, color: C.red,
                fontSize: 12, fontWeight: 800, letterSpacing: 1, cursor: 'pointer', borderRadius: 2,
              }}>
                <Trash2 size={11} /> DELETE LOCAL DATA
              </button>
              <button onClick={() => setConfirmClear(false)} style={{
                marginLeft: 'auto',
                padding: '8px 12px',
                background: 'transparent',
                border: `1px solid ${C.border}`,
                color: C.text3,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1,
                cursor: 'pointer',
                borderRadius: 2,
              }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
