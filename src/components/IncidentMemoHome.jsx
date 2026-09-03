import { ArrowRight, History, Radio, ShieldAlert, TriangleAlert, UserRound } from 'lucide-react';
import { MEMO, STORY_CASE_ID } from '../data/storyScene';
import SleeperBrand from './SleeperBrand';

const FACT_ICONS = [UserRound, Radio, ShieldAlert];

export default function IncidentMemoHome({ C, onScene, onAgentLab, agentRunsCount = 0 }) {
  return (
    <main className="incident-home">
      <aside className="incident-rail" aria-label="Sleeper introduction">
        <div className="rail-brand">
          <SleeperBrand kind="mark" className="rail-brand-mark" style={{ width: 100 }} />
          <SleeperBrand className="rail-brand-wordmark" />
          <div className="rail-brand-rule" style={{ width: '100%', borderTop: `1px solid ${C.border}`, marginTop: 2 }} />
          <div className="brand-kicker rail-brand-caption" style={{ color: C.text3, lineHeight: 1.8 }}>
            Local-first agent<br />assurance lab
          </div>
        </div>

        <div className="rail-detail" style={{ marginTop: 'auto' }}>
          <p style={{ color: C.text2, fontSize: C.size.small, lineHeight: 1.62, margin: '0 0 18px', maxWidth: 210 }}>
            Sleeper is a local-first lab for security leaders and technical reviewers.
          </p>
          <p style={{ color: C.text3, fontSize: C.size.small, lineHeight: 1.62, margin: 0 }}>
            Simulate incidents.<br />Inspect the run.<br />Open the evidence.
          </p>
          {agentRunsCount > 0 && (
            <div style={{ color: C.text3, fontFamily: C.mono, fontSize: C.size.micro, marginTop: 24, display: 'flex', alignItems: 'center', gap: 7 }}>
              <History size={12} /> {agentRunsCount} local run{agentRunsCount === 1 ? '' : 's'}
            </div>
          )}
        </div>

        <div className="rail-detail" style={{ color: C.text3, fontFamily: C.mono, fontSize: C.size.micro, marginTop: 30, lineHeight: 1.6 }}>
          v0.1.0<br />LOCAL ONLY
        </div>
      </aside>

      <div className="incident-main">
        <header className="incident-masthead">
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
            <SleeperBrand compact style={{ width: 215, maxWidth: '48vw' }} />
            <span className="masthead-tagline-rule" style={{ height: 25, borderLeft: `1px solid ${C.borderHi}` }} aria-hidden="true" />
            <span className="brand-kicker masthead-tagline" style={{ color: C.text2, whiteSpace: 'nowrap' }}>Local-first agent assurance</span>
          </div>
          <span className="brand-kicker" style={{ color: C.text2 }}>Incident memo · I<sub>1</sub></span>
        </header>

        <article className="incident-sheet" aria-labelledby="incident-headline">
          <div className="incident-number display-type" aria-hidden="true">001</div>

          <div className="incident-content">
            <div className="brand-kicker" style={{ color: C.red, fontWeight: 750, marginTop: 6 }}>
              Simulated incident&nbsp; —
            </div>
            <h1 id="incident-headline" className="incident-headline display-type" style={{ color: C.text1 }}>
              {MEMO.headline}
            </h1>
            <p style={{ color: C.text2, fontSize: C.size.head, lineHeight: 1.48, margin: 0, maxWidth: 650 }}>
              {MEMO.standfirst}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, padding: '12px 0', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
              <TriangleAlert size={20} color={C.red} aria-hidden="true" />
              <strong style={{ color: C.text1, fontStretch: '72%', letterSpacing: '.055em', textTransform: 'uppercase' }}>
                Simulated exercise — nothing here occurred
              </strong>
            </div>

            <div className="incident-facts">
              {MEMO.blocks.map((block, index) => {
                const Icon = FACT_ICONS[index] ?? Radio;
                return (
                  <div className="incident-fact" key={block.label}>
                    <Icon size={19} color={C.text2} aria-hidden="true" />
                    <div className="brand-kicker" style={{ color: C.signal, fontWeight: 800 }}>{block.label}</div>
                    <div style={{ color: C.text2, fontSize: C.size.body, lineHeight: 1.5 }}>{block.text}</div>
                  </div>
                );
              })}
            </div>

            <div className="incident-actions">
              <button
                className="field-button display-type"
                aria-label="SHOW ME THE RUN — replay the incident"
                onClick={onScene}
                style={{ background: C.signal, border: `1px solid ${C.signal}`, color: C.ink }}
              >
                <span>Replay the incident</span><ArrowRight size={24} />
              </button>
              <button
                className="field-button display-type"
                aria-label="Skip the story — open the lab and run any of the four cases"
                onClick={onAgentLab}
                style={{ background: 'transparent', border: `1px solid ${C.borderHi}`, color: C.text1 }}
              >
                <span>Open the evidence lab</span><ArrowRight size={24} color={C.text3} />
              </button>
            </div>

            <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, marginTop: 15, lineHeight: 1.62 }}>
              {MEMO.provenance}<br />{MEMO.disclaimer}
            </div>

            <p style={{ fontSize: C.size.small, color: C.text3, lineHeight: 1.65, margin: '18px 0 0', maxWidth: 760 }}>
              Sleeper tests whether a tool-using agent can be manipulated into taking an action it should not take,
              then turns the result into reviewable evidence. {STORY_CASE_ID} is one of four cases. Results are
              observed, not guaranteed, and an unexercised control stays <strong style={{ color: C.slate }}>INCONCLUSIVE</strong>.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
