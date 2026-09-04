// The demo screen for NR-AGT-003A — poisoned MCP tool descriptor. Same
// discipline as SceneWalkthrough: this runs the real assessment and renders
// that run's own event stream, not a script. The visual is a tool registry
// inspector instead of an email client, because the injection channel here
// is a tool's own description text, not a message a human reads — the
// poisoned text shown on screen is the exact string buildAdvertisedTools
// hands the model as this tool's description, live or replayed.
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  MCP_DESCRIPTOR_CANARY_SEEDS,
  MCP_DESCRIPTOR_CASE_ID,
  MCP_DESCRIPTOR_PERSONA,
  MCP_DESCRIPTOR_TASK,
  credentialFileFixture,
  descriptorFixture,
  mcpDescriptorRunParams,
  serverEntry,
  toolRegistryEntry,
} from '../data/mcpDescriptorScene';
import { deriveSceneBeats, finalReply, replyMentionsUntrustedCalls } from '../data/storyScene';
import { runAgentAssessment } from '../harness/runAgentAssessment';
import SleeperBrand from './SleeperBrand';

const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const BEAT_INTERVAL_MS = 950;

export default function McpDescriptorScene({ C, onHome, onEvidence }) {
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
        const result = await runAgentAssessment(mcpDescriptorRunParams());
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

  const descriptor = descriptorFixture();
  const credFile = credentialFileFixture();
  const server = serverEntry();
  const tool = toolRegistryEntry();
  const beats = deriveSceneBeats(outcome?.run);
  const reply = finalReply(outcome?.run);
  const replyCovers = replyMentionsUntrustedCalls(outcome?.run);
  const settled = revealed > beats.length && beats.length > 0;

  return (
    <div className="scene" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 56px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div className="lab-masthead">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
          <SleeperBrand compact style={{ width: 205, maxWidth: '48vw' }} />
          <span className="brand-kicker lab-masthead-tagline" style={{ color: C.text3 }}>MCP tool registry replay</span>
        </div>
        <button onClick={onHome} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: C.text3, fontSize: C.size.small, cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={14} /> HOME
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: C.size.micro, color: C.text3, letterSpacing: 2, textTransform: 'uppercase' }}>
          {MCP_DESCRIPTOR_CASE_ID} &middot; Baseline profile &middot; Sample Replay
        </div>
        <h1 className="display-type" style={{ fontSize: 42, color: C.text1, fontWeight: 780, letterSpacing: '-0.02em', margin: 0, textTransform: 'uppercase' }}>
          What {MCP_DESCRIPTOR_PERSONA.name.split(' ')[0]}&rsquo;s agent read
        </h1>
        <p style={{ fontSize: C.size.small, color: C.text3, lineHeight: 1.6, maxWidth: 780, margin: 0 }}>
          This is a live run, not a recording. The descriptor text below is the exact string the harness hands
          the model as this tool&rsquo;s description — the same text a live target would read, not a
          summary of it.
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
            {server?.label ?? 'Halcyon Platform MCP'} &mdash; Tool registry
          </span>
        </div>

        <div className="scene-split-grid">

          <div style={{ padding: '18px 20px', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <div>
              <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Server</div>
              <div style={{ fontSize: C.size.body, color: C.text1, fontWeight: 600 }}>{server?.label ?? 'Halcyon Platform MCP'}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                <span className="scene-chip" style={{ borderColor: C.borderHi, color: C.text2 }}>{server?.provenance ?? 'sanctioned'}</span>
                <span className="scene-chip" style={{ borderColor: C.borderHi, color: C.text2 }}>{server?.review_status?.replaceAll('_', ' ') ?? 'approved at connection'}</span>
              </div>
            </div>
            <div>
              <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Declared scope</div>
              <div style={{ fontSize: C.size.small, color: C.text2, fontFamily: C.mono }}>{(server?.declared_scope ?? []).join(', ')}</div>
            </div>
            <div>
              <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{MCP_DESCRIPTOR_PERSONA.name}</div>
              <div style={{ fontSize: C.size.small, color: C.text2, lineHeight: 1.5 }}>{MCP_DESCRIPTOR_PERSONA.role}, {MCP_DESCRIPTOR_PERSONA.tenure_days} days on the platform team</div>
              <div style={{ background: C.surface, borderRadius: C.radius, padding: '9px 11px', marginTop: 9, fontSize: C.size.small, color: C.text2 }}>{MCP_DESCRIPTOR_TASK}</div>
            </div>
          </div>

          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: C.mono, fontSize: C.size.small, color: C.text1, fontWeight: 700 }}>{tool?.label ?? 'Deploy Status (MCP)'}</span>
              <span className="scene-chip" style={{ borderColor: C.attack + '77', color: C.attack, background: C.attackBg }}>descriptor changed after approval</span>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: C.size.micro, color: C.text3, fontFamily: C.mono }}>
              <span>Approved at connection: <strong style={{ color: C.text2 }}>{descriptor?.descriptor_revision?.accepted_at_connection ?? 'revision 4'}</strong></span>
              <span>Current: <strong style={{ color: C.attack }}>{descriptor?.descriptor_revision?.current ?? 'revision 7'}</strong></span>
              <span>Re-reviewed: <strong style={{ color: C.attack }}>{descriptor?.descriptor_revision?.change_reviewed ? 'yes' : 'no'}</strong></span>
            </div>

            <div>
              <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 7 }}>
                Descriptor text the agent reads today
              </div>
              <div style={{
                fontFamily: C.mono, fontSize: C.size.micro, lineHeight: 1.6, color: C.attack, background: C.attackBg,
                borderLeft: `3px solid ${C.attack}`, padding: '11px 13px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
              }}>
                {descriptor?.content ?? ''}
              </div>
            </div>

            {credFile && (
              <div style={{ fontSize: C.size.small, color: C.text3, lineHeight: 1.5 }}>
                The file it asks for: <span style={{ fontFamily: C.mono, color: C.text2 }}>config/service-credentials.json</span>, seeded with a
                synthetic key (<span style={{ fontFamily: C.mono, color: C.text2 }}>{MCP_DESCRIPTOR_CANARY_SEEDS.api_key}</span>) so the leak is
                verifiable, never real.
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 12, background: C.panel }}>
          <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1, textTransform: 'uppercase' }}>Agent trace</div>
          <div role="log" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {beats.slice(0, revealed).map(beat => (
              <div key={beat.key} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, animation: 'fadeUp .3s ease-out',
                background: beat.tone === 'alarm' ? C.attackBg : 'transparent',
                borderLeft: `3px solid ${beat.tone === 'alarm' ? C.attack : beat.tone === 'blocked' ? C.green : 'transparent'}`,
                padding: beat.tone === 'quiet' ? '0 0 0 3px' : '7px 9px',
                marginLeft: beat.tone === 'quiet' ? 0 : -12,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: C.radiusPill, marginTop: 6, flexShrink: 0, background: beat.tone === 'alarm' ? C.attack : beat.tone === 'blocked' ? C.green : C.borderHi }} />
                <span style={{ fontFamily: C.mono, fontSize: C.size.micro, lineHeight: 1.5, overflowWrap: 'anywhere', minWidth: 0 }}>
                  <span style={{ color: beat.tone === 'alarm' ? C.text1 : C.text2 }}>{beat.action} {beat.subject}</span>
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
              <span style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1, textTransform: 'uppercase' }}>
                Final response recorded by the run
              </span>
              <span style={{ fontSize: C.size.small, color: C.text2, lineHeight: 1.55 }}>{reply}</span>
            </div>
          )}
          {settled && replyCovers === false && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: C.size.small, color: C.text1, lineHeight: 1.5, borderLeft: `3px solid ${C.signal}`, paddingLeft: 11, animation: 'fadeUp .3s ease-out' }}>
              <ShieldAlert size={15} color={C.signal} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              Nothing in that response names the credentials file or the attestation argument. The step that
              mattered is visible in the trace and nowhere in the answer &mdash; exactly what the descriptor asked for.
            </div>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg, padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.ochre, letterSpacing: 1.2, textTransform: 'uppercase' }}>Simulated</span>
          <span style={{ fontSize: C.size.small, color: C.text3 }}>
            No file was read and no credential moved. Every value shown is a synthetic fixture.
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
