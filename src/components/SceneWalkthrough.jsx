// The demo screen: direction A.
//
// The scene is NOT a mock of the attack. It runs the real thing — a Sample
// Replay of NR-AGT-001 under the Baseline profile, through runAgentAssessment,
// the same call the lab makes — and renders that run's own event stream as the
// interface it would have happened in. Every tool call, argument, trust
// verdict and result on screen is read back out of the run. The scene cannot
// show a step the harness did not take, and the result it hands to the lab is
// the same object, not a re-run.
//
// That is the whole reason to build it this way. A scripted animation of an
// attack is a video; this is the harness with a different skin on, and it
// stays true when the fixtures change.
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import {
  SCENE_INBOX,
  SCENE_TASK,
  STORY_CASE_ID,
  deriveSceneBeats,
  finalReply,
  replyMentionsUntrustedCalls,
  splitInjectedEmail,
  storyRunParams,
} from '../data/storyScene';
import { runAgentAssessment } from '../harness/runAgentAssessment';
import { FIXTURE_PERSONA } from '../data/agentCases';
import SleeperBrand from './SleeperBrand';

const BEAT_INTERVAL_MS = 950;

const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function SceneWalkthrough({ C, onHome, onEvidence }) {
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(0);
  const [replayToken, setReplayToken] = useState(0);
  const timers = useRef([]);

  useEffect(() => {
    let active = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setOutcome(null);
    setError(null);
    setRevealed(0);

    (async () => {
      try {
        const result = await runAgentAssessment(storyRunParams());
        if (!active) return;
        setOutcome(result);

        const beats = deriveSceneBeats(result.run);
        if (prefersReducedMotion()) {
          setRevealed(beats.length + 1);
          return;
        }
        beats.forEach((_, index) => {
          timers.current.push(setTimeout(() => {
            if (active) setRevealed(index + 1);
          }, BEAT_INTERVAL_MS * (index + 1)));
        });
        timers.current.push(setTimeout(() => {
          if (active) setRevealed(beats.length + 1);
        }, BEAT_INTERVAL_MS * (beats.length + 1)));
      } catch (err) {
        if (active) setError(err?.message || String(err));
      }
    })();

    return () => {
      active = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [replayToken]);

  const beats = deriveSceneBeats(outcome?.run);
  const email = splitInjectedEmail();
  const reply = finalReply(outcome?.run);
  const replyCovers = replyMentionsUntrustedCalls(outcome?.run);
  const settled = revealed > beats.length && beats.length > 0;

  return (
    <div className="scene" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 56px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div className="lab-masthead">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
          <SleeperBrand compact style={{ width: 205, maxWidth: '48vw' }} />
          <span className="brand-kicker lab-masthead-tagline" style={{ color: C.text3 }}>Live incident replay</span>
        </div>
        <button onClick={onHome} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: C.text3, fontSize: C.size.small, cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={14} /> BACK TO THE MEMO
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: C.size.micro, color: C.text3, letterSpacing: 2, textTransform: 'uppercase' }}>
          {STORY_CASE_ID} &middot; Baseline profile &middot; Sample Replay
        </div>
        <h1 className="display-type" style={{ fontSize: 42, color: C.text1, fontWeight: 780, letterSpacing: '-0.02em', margin: 0, textTransform: 'uppercase' }}>
          What {FIXTURE_PERSONA.name.split(' ')[0]} saw
        </h1>
        <p style={{ fontSize: C.size.small, color: C.text3, lineHeight: 1.6, maxWidth: 780, margin: 0 }}>
          This is a live run, not a recording. Every call, argument and decision below is read back out of the
          run&rsquo;s own event stream, and the same result opens in the evidence workspace.
        </p>
      </div>

      {error && (
        <div role="alert" style={{ padding: '12px 14px', background: C.redBg, border: `1px solid ${C.red}55`, borderLeft: `3px solid ${C.red}`, borderRadius: C.radius, color: C.red, fontSize: C.size.small }}>
          The scene could not run: {error}
        </div>
      )}

      {/* flexShrink: 0 matters here, not just tidiness. This box is a flex
          item of `.scene` (flex-direction: column, overflowY: auto). A flex
          item's automatic minimum size is content-based UNLESS the item's own
          `overflow` is anything but visible — this one sets `overflow:hidden`
          (to clip the header row to the rounded corners), so its auto-minimum
          silently drops to zero. Without flexShrink:0, whenever `.scene`'s
          total content exceeds the viewport, flexbox crushes THIS box down to
          whatever space is left (every sibling keeps its content-based floor)
          and the excess is clipped with no scrollbar — worse, the clipped
          height never counts toward `.scene`'s own scrollHeight, so `.scene`
          reports nothing to scroll while the trace, the final response, and
          the CTA context below it are simply gone. Reproduced at both 889×718
          and 390×844. Confirmed via computed styles, not guessed. */}
      <div style={{ border: `1px solid ${C.borderHi}`, borderRadius: C.radius, background: C.bg, overflow: 'hidden', flexShrink: 0 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderBottom: `1px solid ${C.border}`, background: C.panel }}>
          <span style={{ display: 'flex', gap: 5 }}>
            {[0, 1, 2].map(dot => (
              <span key={dot} style={{ width: 9, height: 9, borderRadius: C.radiusPill, background: C.border }} />
            ))}
          </span>
          <span style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3 }}>
            mail.halcyon-edge.example &mdash; Inbox
          </span>
        </div>

        <div className="scene-grid" style={{ display: 'grid', gridTemplateColumns: '190px minmax(0, 1fr) 340px' }}>

          <div style={{ borderRight: `1px solid ${C.border}`, padding: '13px 0', display: 'flex', flexDirection: 'column' }}>
            {SCENE_INBOX.map(item => (
              <div key={item.subject} style={{
                padding: '9px 14px', display: 'flex', flexDirection: 'column', gap: 3,
                background: item.active ? C.surface : 'transparent',
                borderLeft: `2px solid ${item.active ? C.brass : 'transparent'}`,
              }}>
                <span style={{ fontSize: C.size.small, color: item.active ? C.text1 : C.text2, fontWeight: item.active ? 600 : 400 }}>{item.from}</span>
                <span style={{ fontSize: C.size.micro, color: C.text3 }}>{item.subject}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13, borderRight: `1px solid ${C.border}`, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {email.header.map(line => (
                <div key={line} style={{
                  fontFamily: /^Subject:/.test(line) ? C.sans : C.mono,
                  fontSize: /^Subject:/.test(line) ? C.size.head : C.size.micro,
                  fontWeight: /^Subject:/.test(line) ? 600 : 400,
                  color: /^Subject:/.test(line) ? C.text1 : C.text3,
                  overflowWrap: 'anywhere',
                }}>
                  {line.replace(/^Subject:\s*/, '')}
                </div>
              ))}
            </div>
            <div style={{ fontSize: C.size.small, color: C.text2, lineHeight: 1.6 }}>{email.body}</div>
            {email.footer && (
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 11 }}>
                <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, marginBottom: 7 }}>
                  --- external message footer ---
                </div>
                <div style={{
                  fontFamily: C.mono, fontSize: C.size.micro, lineHeight: 1.6, color: C.red,
                  background: C.redBg, borderLeft: `3px solid ${C.red}`, padding: '10px 12px',
                  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                }}>
                  {email.footer}
                </div>
              </div>
            )}
            <div style={{ fontSize: C.size.small, color: C.text3, lineHeight: 1.55, marginTop: 'auto' }}>
              {FIXTURE_PERSONA.name.split(' ')[0]} never scrolled this far. She asked for a summary.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', background: C.panel, minWidth: 0 }}>
            <div style={{ padding: '12px 15px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                Connected
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {FIXTURE_PERSONA.connected.map(tool => (
                  <span key={tool} style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text2, border: `1px solid ${C.borderHi}`, borderRadius: C.radius, padding: '2px 7px' }}>
                    {tool}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              <div style={{ background: C.surface, borderRadius: C.radius, padding: '10px 12px', fontSize: C.size.small, lineHeight: 1.5 }}>
                {SCENE_TASK}
              </div>

              <div role="log" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {beats.slice(0, revealed).map(beat => (
                  <div key={beat.key} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, animation: 'fadeUp .3s ease-out',
                    background: beat.tone === 'alarm' ? C.redBg : 'transparent',
                    borderLeft: `3px solid ${beat.tone === 'alarm' ? C.red : beat.tone === 'blocked' ? C.green : 'transparent'}`,
                    padding: beat.tone === 'quiet' ? '0 0 0 3px' : '7px 9px',
                    marginLeft: beat.tone === 'quiet' ? 0 : -12,
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: C.radiusPill, marginTop: 6, flexShrink: 0,
                      background: beat.tone === 'alarm' ? C.red : beat.tone === 'blocked' ? C.green : C.borderHi,
                    }} />
                    <span style={{ fontFamily: C.mono, fontSize: C.size.micro, lineHeight: 1.5, overflowWrap: 'anywhere', minWidth: 0 }}>
                      {/* The alarm tone lives on the rail and the dot. Red text
                          on the red tint measured 4.05:1 against the blended
                          background — below AA, at 11px. */}
                      <span style={{ color: beat.tone === 'alarm' ? C.text1 : C.text2 }}>
                        {beat.action} {beat.subject}
                      </span>
                      {beat.detail && <><br /><span style={{ color: C.text2 }}>{beat.detail}</span></>}
                      {beat.status === 'denied' && <span style={{ color: C.green }}> &mdash; refused at the gate</span>}
                    </span>
                  </div>
                ))}
                {!settled && !error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.text3, fontFamily: C.mono, fontSize: C.size.micro }}>
                    <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> working
                  </div>
                )}
              </div>

              {settled && reply && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 11, display: 'flex', flexDirection: 'column', gap: 5, animation: 'fadeUp .3s ease-out' }}>
                  {/* Labelled for what it is. Sample Replay is a scripted
                      target, so this is the run's recorded closing text and
                      not a summary a model wrote — saying otherwise would be
                      the one thing this screen must not do. */}
                  <span style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                    Final response recorded by the run
                  </span>
                  <span style={{ fontSize: C.size.small, color: C.text2, lineHeight: 1.55 }}>{reply}</span>
                </div>
              )}

              {settled && replyCovers === false && (
                <div style={{ marginTop: 'auto', fontSize: C.size.small, color: C.text1, lineHeight: 1.5, borderLeft: `3px solid ${C.brass}`, paddingLeft: 11, animation: 'fadeUp .3s ease-out' }}>
                  Nothing in that response names the address the record was sent to. The step that mattered
                  is visible in the trace and nowhere in the answer.
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg, padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.ochre, letterSpacing: 1.2, textTransform: 'uppercase' }}>Simulated</span>
          <span style={{ fontSize: C.size.small, color: C.text3 }}>
            No message was sent and no record moved. Every address and identifier is a synthetic fixture.
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => onEvidence?.(outcome)}
          disabled={!outcome}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '11px 20px',
            cursor: outcome ? 'pointer' : 'not-allowed', borderRadius: C.radius,
            background: C.signal, border: `1px solid ${C.signal}`, color: C.ink,
            fontSize: C.size.small, fontWeight: 800, letterSpacing: .5,
            opacity: outcome ? 1 : .5,
          }}
        >
          OPEN THE EVIDENCE FOR THIS RUN <ChevronRight size={14} />
        </button>
        <button
          onClick={() => setReplayToken(token => token + 1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px', cursor: 'pointer',
            background: 'transparent', border: `1px solid ${C.borderHi}`, borderRadius: C.radius, color: C.text2,
            fontSize: C.size.small, fontWeight: 700, letterSpacing: .5,
          }}
        >
          <RefreshCw size={13} /> PLAY IT AGAIN
        </button>
        <span style={{ fontSize: C.size.small, color: C.text3, lineHeight: 1.5 }}>
          The evidence workspace opens on this run, with the Reference profile one click away for the comparison.
        </span>
      </div>
    </div>
  );
}
