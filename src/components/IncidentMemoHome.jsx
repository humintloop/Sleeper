// The opening screen: direction C.
//
// Replaces DossierHome, whose name was a leftover from ELICIT's dossier
// framing and whose copy led with the control-profile comparison — accurate,
// and an answer to a question the visitor has not asked yet. This leads with
// the consequence instead, in the format the person who signs off on a rollout
// actually reads, and lets them click down into how and then into the proof.
//
// Everything factual on this screen comes from src/data/storyScene.js, which
// derives it from the case fixtures. The one thing this component must never
// do is read as a real incident report: the simulated marker is in the header
// rule, not in a footnote, and the provenance line names the run, the profile
// and the target that produced the claim.
import { ChevronRight, History } from 'lucide-react';
import { MEMO, STORY_CASE_ID } from '../data/storyScene';

export default function IncidentMemoHome({ C, onScene, onAgentLab, agentRunsCount = 0 }) {
  return (
    <main style={{ width: '100%', maxWidth: 900, margin: '0 auto', padding: '52px 24px 88px', display: 'flex', flexDirection: 'column', gap: 26 }}>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: C.sans, fontSize: C.size.head, color: C.text1, fontWeight: 600, letterSpacing: '0.02em' }}>
          Sleeper
        </span>
        <span style={{ fontSize: C.size.micro, color: C.text3, letterSpacing: 2, textTransform: 'uppercase' }}>
          Local-first agent assurance
        </span>
      </div>

      <article style={{ background: C.panel, border: `1px solid ${C.borderHi}`, borderRadius: C.radius, padding: '30px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}`, paddingBottom: 13 }}>
          <span style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            {MEMO.employer} &middot; internal
          </span>
          <span style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.ochre, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            Simulated exercise &mdash; nothing here occurred
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <h1 style={{
            // The one display size on this screen, as the wordmark used to be.
            // It is the sentence the whole app exists to earn, so it is sized
            // to be read across a room and clamped so it never wraps to five
            // lines on a phone.
            fontSize: 'clamp(27px, 4.4vw, 40px)', fontWeight: 600, lineHeight: 1.2,
            letterSpacing: '-0.01em', color: C.text1, margin: 0,
          }}>
            {MEMO.headline}
          </h1>
          <p style={{ fontSize: C.size.head, color: C.text2, lineHeight: 1.5, margin: 0, maxWidth: 720 }}>
            {MEMO.standfirst}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '22px 38px' }}>
          {MEMO.blocks.map(block => (
            <div key={block.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                {block.label}
              </div>
              <div style={{ fontSize: C.size.body, color: C.text1, lineHeight: 1.6 }}>{block.text}</div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, lineHeight: 1.65, flex: '1 1 380px', minWidth: 0 }}>
            {MEMO.provenance}<br />{MEMO.disclaimer}
          </div>
          <button onClick={onScene} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '11px 20px', cursor: 'pointer',
            background: C.brassBg, border: `1px solid ${C.brass}`, borderRadius: C.radius, color: C.brass,
            fontFamily: C.mono, fontSize: C.size.small, fontWeight: 800, letterSpacing: .5, whiteSpace: 'nowrap',
          }}>
            SHOW ME THE RUN <ChevronRight size={14} />
          </button>
        </div>
      </article>

      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* The second audience. A reviewer who already believes the premise
            should not have to walk through the story to reach the evidence. */}
        <button onClick={onAgentLab} style={{
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          color: C.text2, fontSize: C.size.small, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          Skip the story &mdash; open the lab and run any of the four cases <ChevronRight size={13} />
        </button>
        {agentRunsCount > 0 && (
          <span style={{ color: C.text3, fontSize: C.size.small, display: 'flex', alignItems: 'center', gap: 5 }}>
            <History size={12} /> {agentRunsCount} run{agentRunsCount === 1 ? '' : 's'} saved in this browser
          </span>
        )}
      </div>

      <p style={{ fontSize: C.size.small, color: C.text3, lineHeight: 1.7, margin: 0, maxWidth: 700 }}>
        Sleeper tests whether a tool-using agent can be manipulated into taking an action it should not take, and
        turns the result into reviewable evidence mapped to control frameworks. {STORY_CASE_ID} is one of four
        cases. Results are observed, not guaranteed, and an unexercised control stays{' '}
        <strong style={{ color: C.slate }}>INCONCLUSIVE</strong>.
      </p>
    </main>
  );
}
