import { ChevronRight, FlaskConical, History } from 'lucide-react';

// Agent-only home screen (docs/remove-single-turn-flow.md). The single-turn
// probe entry cards, the "Assessment flow" 5-step strip (probe-only), and the
// "Evidence coverage" cluster section are gone along with the flow they
// described. "Run agent case" is the only real entry point now, so this reads
// as one clear CTA rather than a grid of competing options.
//
// Headline copy leads with the control-profile comparison rather than the
// old single-turn-vs-agent framing. Outcomes remain observations: independent
// model runs can decline to act, fail, degrade, or leave controls unexercised.
export default function DossierHome({ C, onAgentLab, agentRunsCount = 0 }) {
  return (
    <main style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: '64px 24px 96px', display: 'flex', flexDirection: 'column', gap: 34 }}>
      <section>
        <div style={{ fontSize: 11, color: C.text3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
          Local-first agent assurance
        </div>
        <h1 style={{ fontFamily: C.sans, fontSize: 52, color: C.text1, fontWeight: 600, letterSpacing: '0.05em', lineHeight: 1, margin: 0 }}>SLEEPER</h1>
        <p style={{ fontSize: 17, color: C.text1, lineHeight: 1.65, maxWidth: 680, marginTop: 16, marginBottom: 0 }}>
          SLEEPER tests whether a tool-using agent can be manipulated into taking an action it should not take,
          and turns the result into reviewable evidence mapped to control frameworks.
        </p>
        <p style={{ fontSize: 14, color: C.text3, lineHeight: 1.7, maxWidth: 700, marginTop: 10, marginBottom: 0 }}>
          Run the same case under <strong style={{ color: C.text2 }}>Baseline</strong>,{' '}
          <strong style={{ color: C.text2 }}>Partial</strong>, and <strong style={{ color: C.text2 }}>Reference</strong>{' '}
          postures, then compare what the target attempted, what each deterministic control actually did, and what
          evidence survived. Use the disclosed Sample Replay for a reliable no-key harness walkthrough, or a live/local
          model when you need evidence of model decisions.
          Outcomes are observed, not guaranteed: a run can fail, hold within a stated scope, degrade, or remain{' '}
          <strong style={{ color: C.blue }}>INCONCLUSIVE</strong> when the model never exercises the control.
        </p>
      </section>

      <button onClick={onAgentLab} style={{
        textAlign: 'left', background: C.surface, border: `1px solid ${C.brass}`,
        borderTop: `3px solid ${C.brass}`, borderRadius: 2, padding: '22px 24px',
        cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 2, background: `${C.brass}1F`, border: `1px solid ${C.brass}55`, color: C.brass, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FlaskConical size={19} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.brass, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
              Agent case &middot; multi-step
            </div>
            <div style={{ fontSize: 19, color: C.text1, fontWeight: 800 }}>Run agent case</div>
          </div>
        </div>
        <div style={{ fontSize: 13.5, color: C.text3, lineHeight: 1.65, maxWidth: 600 }}>
          Pick one of four threat cases and a control profile, then use the no-key Sample Replay or point it at a
          live/local model. Follow tool intent, authorization decisions, and simulated results through to a verdict
          and an Evidence Contract.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{ color: C.brass, fontSize: 12.5, fontWeight: 900, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            Run agent case <ChevronRight size={13} />
          </span>
          {agentRunsCount > 0 && (
            <span style={{ color: C.text3, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <History size={12} /> {agentRunsCount} run{agentRunsCount === 1 ? '' : 's'} saved in this browser
            </span>
          )}
        </div>
      </button>
    </main>
  );
}
