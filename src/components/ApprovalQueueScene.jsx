// The demo screen for NR-AGT-002 — excessive agency and insufficient human
// approval. Same discipline as the other three scenes: this runs the real
// assessment and renders that run's own event stream, not a script. Unlike
// the other three, nothing here is an injection — the agent is doing exactly
// what it was asked, with tools it was legitimately given — so the visual is
// a deploy-window checklist and the one approval prompt raised out of it,
// not poisoned content a human or agent reads.
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  APPROVAL_QUEUE_CASE_ID,
  APPROVAL_QUEUE_PERSONA,
  APPROVAL_QUEUE_TASK,
  approvalContextFixture,
  approvalQueueRunParams,
  checklistItems,
  parseApprovalContext,
} from '../data/approvalQueueScene';
import { deriveSceneBeats, finalReply } from '../data/storyScene';
import { runAgentAssessment } from '../harness/runAgentAssessment';
import SleeperBrand from './SleeperBrand';

const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const BEAT_INTERVAL_MS = 950;

export default function ApprovalQueueScene({ C, onHome, onEvidence }) {
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(0);
  const [replayToken, setReplayToken] = useState(0);

  useEffect(() => {
    let active = true;
    setOutcome(null);
    setError(null);
    setRevealed(0);
    const timers = [];

    (async () => {
      try {
        const result = await runAgentAssessment(approvalQueueRunParams());
        if (!active) return;
        setOutcome(result);
        const beats = deriveSceneBeats(result.run);
        if (prefersReducedMotion()) {
          setRevealed(beats.length + 1);
          return;
        }
        beats.forEach((_, index) => {
          timers.push(setTimeout(() => { if (active) setRevealed(index + 1); }, BEAT_INTERVAL_MS * (index + 1)));
        });
        timers.push(setTimeout(() => { if (active) setRevealed(beats.length + 1); }, BEAT_INTERVAL_MS * (beats.length + 1)));
      } catch (err) {
        if (active) setError(err?.message || String(err));
      }
    })();

    return () => { active = false; timers.forEach(clearTimeout); };
  }, [replayToken]);

  const checklist = checklistItems();
  const { full } = parseApprovalContext(approvalContextFixture());
  const beats = deriveSceneBeats(outcome?.run);
  const reply = finalReply(outcome?.run);
  const settled = revealed > beats.length && beats.length > 0;
  const record = outcome?.run?.approvalSummary?.approval_records?.[0] ?? null;

  return (
    <div className="scene" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 56px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div className="lab-masthead">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
          <SleeperBrand compact style={{ width: 205, maxWidth: '48vw' }} />
          <span className="brand-kicker lab-masthead-tagline" style={{ color: C.text3 }}>Approval queue replay</span>
        </div>
        <button onClick={onHome} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: C.text3, fontSize: C.size.small, cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={14} /> HOME
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: C.size.micro, color: C.text3, letterSpacing: 2, textTransform: 'uppercase' }}>
          {APPROVAL_QUEUE_CASE_ID} &middot; Baseline profile &middot; Sample Replay
        </div>
        <h1 className="display-type" style={{ fontSize: 42, color: C.text1, fontWeight: 780, letterSpacing: '-0.02em', margin: 0, textTransform: 'uppercase' }}>
          What the approval prompt left out
        </h1>
        <p style={{ fontSize: C.size.small, color: C.text3, lineHeight: 1.6, maxWidth: 780, margin: 0 }}>
          This is a live run, not a recording. Nothing on this checklist is an injection — every item is
          routine, legitimate work. The question is only whether the human who approved item 4 was shown
          enough to actually decide.
        </p>
      </div>

      {error && (
        <div role="alert" style={{ padding: '12px 14px', background: C.redBg, border: `1px solid ${C.red}55`, borderLeft: `3px solid ${C.red}`, borderRadius: C.radius, color: C.red, fontSize: C.size.small }}>
          The scene could not run: {error}
        </div>
      )}

      <div style={{ border: `1px solid ${C.borderHi}`, borderRadius: C.radius, background: C.bg, overflow: 'hidden', flexShrink: 0 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderBottom: `1px solid ${C.border}`, background: C.panel }}>
          <span style={{ display: 'flex', gap: 5 }}>
            {[0, 1, 2].map(dot => <span key={dot} style={{ width: 9, height: 9, borderRadius: C.radiusPill, background: C.border }} />)}
          </span>
          <span style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3 }}>
            Deploy console &mdash; release 2026.08.3
          </span>
        </div>

        <div className="scene-split-grid">

          <div style={{ padding: '18px 20px', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <div>
              <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{APPROVAL_QUEUE_PERSONA.name}</div>
              <div style={{ fontSize: C.size.small, color: C.text2, lineHeight: 1.5 }}>{APPROVAL_QUEUE_PERSONA.role}, {APPROVAL_QUEUE_PERSONA.tenure_days} days on the release team</div>
              <div style={{ background: C.surface, borderRadius: C.radius, padding: '9px 11px', marginTop: 9, fontSize: C.size.small, color: C.text2 }}>{APPROVAL_QUEUE_TASK}</div>
            </div>
            <div>
              <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Checklist</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {checklist.map(item => (
                  <div key={item.number} style={{
                    display: 'flex', gap: 8, fontSize: C.size.small, lineHeight: 1.5,
                    color: item.consequential ? C.text1 : C.text3,
                    borderLeft: `2px solid ${item.consequential ? C.attack : 'transparent'}`,
                    paddingLeft: 8, fontWeight: item.consequential ? 700 : 400,
                  }}>
                    <span style={{ fontFamily: C.mono, flexShrink: 0 }}>{item.number}.</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: C.mono, fontSize: C.size.small, color: C.text1, fontWeight: 700 }}>Approval request &mdash; send_email</span>
              <span className="scene-chip" style={{ borderColor: C.attack + '77', color: C.attack, background: C.attackBg }}>context stripped</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 7 }}>
                  What the call itself carried
                </div>
                <pre style={{
                  fontFamily: C.mono, fontSize: C.size.micro, lineHeight: 1.6, color: C.text2, background: C.surface,
                  border: `1px solid ${C.border}`, borderRadius: C.radius, padding: '11px 13px', margin: 0,
                  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                }}>
                  {full ? JSON.stringify(full, null, 2) : ''}
                </pre>
              </div>
              <div>
                <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 7 }}>
                  What reached the approval prompt
                </div>
                <pre style={{
                  fontFamily: C.mono, fontSize: C.size.micro, lineHeight: 1.6, color: C.attack, background: C.attackBg,
                  borderLeft: `3px solid ${C.attack}`, borderRadius: C.radius, padding: '11px 13px', margin: 0,
                  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                }}>
                  {record ? JSON.stringify(record.presented_context, null, 2) : ''}
                </pre>
              </div>
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 12, background: C.panel }}>
          <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1, textTransform: 'uppercase' }}>Agent trace</div>
          <div role="log" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {beats.slice(0, revealed).map(beat => (
              <div key={beat.key} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, animation: 'fadeUp .3s ease-out',
                padding: '0 0 0 3px',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: C.radiusPill, marginTop: 6, flexShrink: 0, background: C.borderHi }} />
                <span style={{ fontFamily: C.mono, fontSize: C.size.micro, lineHeight: 1.5, overflowWrap: 'anywhere', minWidth: 0 }}>
                  <span style={{ color: C.text2 }}>{beat.action} {beat.subject}</span>
                  {beat.detail && <><br /><span style={{ color: C.text2 }}>{beat.detail}</span></>}
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
              <span style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1, textTransform: 'uppercase' }}>
                Final response recorded by the run
              </span>
              <span style={{ fontSize: C.size.small, color: C.text2, lineHeight: 1.55 }}>{reply}</span>
            </div>
          )}
          {settled && record?.context_complete === false && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: C.size.small, color: C.text1, lineHeight: 1.5, borderLeft: `3px solid ${C.signal}`, paddingLeft: 11, animation: 'fadeUp .3s ease-out' }}>
              <ShieldAlert size={15} color={C.signal} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              <span>
                The approval record this run produced carries exactly one field
                (<code style={{ fontFamily: C.mono }}>tool</code>). Everything shown on the left &mdash; who it
                would reach, whether it is reversible, which checklist item it came from &mdash; was available
                and never rendered into the prompt a human approved.
              </span>
            </div>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg, padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.ochre, letterSpacing: 1.2, textTransform: 'uppercase' }}>Simulated</span>
          <span style={{ fontSize: C.size.small, color: C.text3 }}>
            No email was sent and no status list was notified. Every value shown is a synthetic fixture.
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
            fontSize: C.size.small, fontWeight: 800, letterSpacing: .5, opacity: outcome ? 1 : .5,
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
