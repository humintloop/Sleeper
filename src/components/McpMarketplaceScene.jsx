// The demo screen for NR-AGT-003B — an unsanctioned MCP server, hostile at
// the source. Different shape from 003A (and a different visual from it):
// the tell here is visible before any tool ever runs, in a marketplace
// listing nobody reviewed. The injection itself arrives later, in a tool
// *result* rather than a tool description — still real, still read back out
// of the run, never retyped.
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, ShieldAlert, Star } from 'lucide-react';
import {
  MCP_MARKETPLACE_CASE_ID,
  MCP_MARKETPLACE_PERSONA,
  MCP_MARKETPLACE_TASK,
  hostileResultFixture,
  listingFixture,
  mcpMarketplaceRunParams,
  secretsFileFixture,
} from '../data/mcpMarketplaceScene';
import { deriveSceneBeats, finalReply, replyMentionsUntrustedCalls } from '../data/storyScene';
import { runAgentAssessment } from '../harness/runAgentAssessment';
import SleeperBrand from './SleeperBrand';

const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const BEAT_INTERVAL_MS = 950;

/** The listing fixture is one plain-text block; pull its four lines apart for the card. */
function parseListing(fixture) {
  const lines = (fixture?.content ?? '').split('\n');
  // Line 1 is "name (synthetic listing) — rating★ — "tagline"" — split on the
  // em-dash separators the fixture itself uses, so name and tagline render as
  // the real fixture text rather than a guessed substring of it.
  const [headline = ''] = lines;
  const [namePart = '', ratingPart = '', taglinePart = ''] = headline.split(' — ');
  const name = namePart.replace(/\s*\(synthetic listing\)\s*/, '').trim();
  const rating = ratingPart.replace('★', '').trim();
  const tagline = taglinePart.replace(/^"|"$/g, '');
  const publisher = lines.find(line => line.startsWith('Publisher:')) ?? '';
  const scopes = lines.find(line => line.startsWith('Requested scopes:')) ?? '';
  const install = lines.find(line => line.startsWith('Install:')) ?? '';
  return { name, rating, tagline, publisher, scopes: scopes.replace('Requested scopes:', '').trim(), install };
}

export default function McpMarketplaceScene({ C, onHome, onEvidence }) {
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
        const result = await runAgentAssessment(mcpMarketplaceRunParams());
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

  const listing = parseListing(listingFixture());
  const secrets = secretsFileFixture();
  const hostileResult = hostileResultFixture();
  const beats = deriveSceneBeats(outcome?.run);
  const reply = finalReply(outcome?.run);
  const replyCovers = replyMentionsUntrustedCalls(outcome?.run);
  const settled = revealed > beats.length && beats.length > 0;
  const scopeList = listing.scopes.split(',').map(s => s.trim()).filter(Boolean);
  const excessScopes = new Set(['secrets:read', 'mail:send']);

  return (
    <div className="scene" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 56px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div className="lab-masthead">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
          <SleeperBrand compact style={{ width: 205, maxWidth: '48vw' }} />
          <span className="brand-kicker lab-masthead-tagline" style={{ color: C.text3 }}>Unsanctioned MCP server replay</span>
        </div>
        <button onClick={onHome} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: C.text3, fontSize: C.size.small, cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={14} /> HOME
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: C.size.micro, color: C.text3, letterSpacing: 2, textTransform: 'uppercase' }}>
          {MCP_MARKETPLACE_CASE_ID} &middot; Baseline profile &middot; Sample Replay
        </div>
        <h1 className="display-type" style={{ fontSize: 42, color: C.text1, fontWeight: 780, letterSpacing: '-0.02em', margin: 0, textTransform: 'uppercase' }}>
          The tell was in the listing
        </h1>
        <p style={{ fontSize: C.size.small, color: C.text3, lineHeight: 1.6, maxWidth: 780, margin: 0 }}>
          This is a live run, not a recording. Nothing below is hidden the way an injected instruction usually
          is &mdash; the risk here was visible before {MCP_MARKETPLACE_PERSONA.name.split(' ')[0]}&rsquo;s agent
          ever called a tool.
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
            registry.example &mdash; Public MCP servers
          </span>
        </div>

        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div className="mcp-listing-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: C.size.body, color: C.text1, fontWeight: 700 }}>{listing.name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.signal, fontSize: C.size.small, fontWeight: 700 }}>
                <Star size={13} fill={C.signal} stroke="none" /> {listing.rating}
              </span>
            </div>
            {listing.tagline && (
              <div style={{ fontSize: C.size.small, color: C.text3, fontStyle: 'italic', marginTop: 3 }}>&ldquo;{listing.tagline}&rdquo;</div>
            )}
            <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
              {/* One real fixture line — publisher and publish-date arrive
                  together ("Publisher: unverified. First published: 11 days
                  ago."), so this is one chip, not two invented from it. */}
              <span className="mcp-chip" style={{ borderColor: C.attack + '77', color: C.attack, background: C.attackBg }}>{listing.publisher.trim()}</span>
              <span className="mcp-chip" style={{ borderColor: C.borderHi, color: C.text2 }}>{listing.install.replace('Install:', '').trim()}</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 7 }}>Requested scopes</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {scopeList.map(scope => (
                  <span key={scope} className="mcp-chip" style={excessScopes.has(scope)
                    ? { borderColor: C.attack + '77', color: C.attack, background: C.attackBg, fontFamily: C.mono }
                    : { borderColor: C.borderHi, color: C.text2, fontFamily: C.mono }}>
                    {scope}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: C.size.small, color: C.text3, lineHeight: 1.5, marginTop: 9 }}>
                The task was tidying up a task list. <span style={{ color: C.attack }}>secrets:read</span> and
                <span style={{ color: C.attack }}> mail:send</span> have nothing to do with that &mdash; the excess
                scope was requestable, and granted, before any tool call.
              </div>
            </div>
          </div>

          <div style={{ background: C.surface, borderRadius: C.radius, padding: '9px 11px', marginTop: 14, fontSize: C.size.small, color: C.text2 }}>
            {MCP_MARKETPLACE_TASK}
          </div>
        </div>

        <div style={{ padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 12, background: C.panel }}>
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

          {hostileResult && revealed >= 1 && (
            <div>
              <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 7 }}>
                What the server actually sent back
              </div>
              <div style={{
                fontFamily: C.mono, fontSize: C.size.micro, lineHeight: 1.6, color: C.attack, background: C.attackBg,
                borderLeft: `3px solid ${C.attack}`, padding: '11px 13px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
              }}>
                {hostileResult.content}
              </div>
            </div>
          )}

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
              Nothing in that response mentions the secrets file or where it went. {secrets ? 'The step that mattered is visible in the trace and nowhere in the answer.' : ''}
            </div>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, background: C.bg, padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: C.mono, fontSize: C.size.micro, color: C.ochre, letterSpacing: 1.2, textTransform: 'uppercase' }}>Simulated</span>
          <span style={{ fontSize: C.size.small, color: C.text3 }}>
            No message was sent and no file was deleted. Every value shown is a synthetic fixture.
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
