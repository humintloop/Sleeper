// The live run console — Phase A. Turn-granularity only: tool calls, gate
// decisions, detections, and results appear live as whole cards; model
// turns appear whole rather than token-by-token. That's a deliberate,
// documented trade for zero risk to src/api/adapter.js (see the module
// comment there and CLAUDE.md's note on why the key stays a private field
// and provider fidelity stays lossless — this component never touches it).
//
// Strictly read-only over the event stream: it renders `events` (an array
// built by AgentCaseRunner's onEvent callback, appending the exact object
// references runAgentCase.js emits — see its own onEvent doc comment) and
// nothing here can influence a run. The "same objects the Evidence Contract
// records" property is what makes this something more than a mockup: every
// card is provably the record that got recorded, not a re-narration of it.
//
// Visual pattern matches docs/prototypes/sleeper-run-console.html (sticky
// phase rail, plain-English "now" line, trust-coded event cards, verdict
// banner with per-control chips) — adapted to this app's C token system and
// the fadeUp keyframe already used by the dramatized scenes, rather than
// the prototype's own bespoke CSS variables.
import { getVerdictColor, getVerdictLabel } from './VerdictBanner';

const PHASES = ['Prompt', 'Model', 'Tool', 'Gate', 'Result', 'Detect', 'Verdict'];

export function phaseIndexForEvent(type) {
  switch (type) {
    case 'prompt': return 0;
    case 'tool_call': return 2;
    case 'authorization_decision': return 3;
    case 'tool_result': return 4;
    case 'detection': return 5;
    default: return 1; // model_turn, response, target_error, loop_guard, turn_cap
  }
}

export function nowText(event) {
  if (!event) return 'Waiting to start…';
  switch (event.type) {
    case 'prompt': return 'Sending the system prompt and task to the model…';
    case 'model_turn': return event.tool_call_count > 0
      ? `Model proposed ${event.tool_call_count} tool call${event.tool_call_count === 1 ? '' : 's'} — evaluating…`
      : 'Model responded with no tool call…';
    case 'tool_call': return `Authorization gate is checking ${event.tool}…`;
    case 'authorization_decision': return event.blocked ? `Gate blocked ${event.tool}.` : `Gate allowed ${event.tool}.`;
    case 'tool_result': return `${event.tool} returned — screening the result…`;
    case 'detection': return event.action === 'blocked_or_constrained'
      ? 'Detection matched the injection and blocked it.'
      : event.detected ? 'Detection matched — detect-only, content passed through.' : 'Detection ran — nothing matched.';
    case 'target_error': return `Target error: ${event.error}`;
    case 'loop_guard': return 'Loop guard tripped: an identical call was re-proposed.';
    case 'turn_cap': return `Turn cap reached after ${event.max_turns} turns.`;
    case 'response': return 'Model gave its final response. Assembling the Evidence Contract…';
    default: return 'Working…';
  }
}

const TONE = {
  green: (C) => ({ color: C.green, border: C.green, bg: C.greenBg }),
  red: (C) => ({ color: C.red, border: C.red, bg: C.redBg }),
  attack: (C) => ({ color: C.attack, border: C.attack, bg: C.attackBg }),
  ochre: (C) => ({ color: C.ochre, border: C.ochre, bg: C.amberBg }),
  agent: (C) => ({ color: C.agent, border: C.agent, bg: C.agentBg }),
  info: (C) => ({ color: C.text2, border: C.borderHi, bg: 'transparent' }),
  sim: (C) => ({ color: C.text3, border: C.border, bg: 'transparent' }),
};

function Badge({ C, tone, children }) {
  const t = (TONE[tone] ?? TONE.sim)(C);
  return (
    <span style={{
      fontFamily: C.mono, fontSize: C.size.micro, borderRadius: 5, padding: '1px 7px',
      border: `1px solid ${t.border}`, color: t.color, background: t.bg, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

/** kind / title / body / badge / borderTone per event type. Nothing here computes a new fact — every field reads straight off the event the harness emitted. */
export function cardMeta(C, event) {
  switch (event.type) {
    case 'prompt':
      return { kind: 'PROMPT', title: 'Task issued', body: event.task, borderTone: C.borderHi };
    case 'model_turn':
      return {
        kind: `MODEL · turn ${event.turn}`, title: 'Model turn',
        body: event.text || (event.tool_call_count > 0 ? '(no text — model went straight to a tool call)' : ''),
        borderTone: C.agent,
      };
    case 'tool_call':
      return {
        kind: 'TOOL CALL', title: `${event.tool}(${Object.keys(event.args ?? {}).join(', ')})`,
        badge: event.instruction_source_trusted
          ? { tone: 'green', text: `instruction source: ${event.instruction_source ?? 'user'} · trusted` }
          : { tone: 'attack', text: `instruction source: ${event.instruction_source ?? 'unattributed'} · untrusted` },
        borderTone: event.instruction_source_trusted ? C.green : C.attack,
      };
    case 'authorization_decision':
      return {
        kind: 'GATE',
        title: event.blocked
          ? `Blocked — ${event.reason ?? 'denied'}`
          : event.required ? 'Allowed — executed under recorded approval' : 'Allowed — no authorization required',
        badge: { tone: 'info', text: `enforcing: ${event.enforcing}` },
        borderTone: event.blocked ? C.red : C.green,
      };
    case 'tool_result':
      return {
        kind: 'TOOL RESULT', title: `${event.tool} → ${event.status}`,
        body: `Provenance: ${event.provenance ?? 'unrecorded'}.`,
        badge: event.simulated_only ? { tone: 'sim', text: 'simulated_only' } : null,
        borderTone: C.borderHi,
      };
    case 'detection': {
      const blocked = event.action === 'blocked_or_constrained';
      return {
        kind: 'DETECTION',
        title: blocked ? 'Injection detected → blocked' : event.detected ? 'Injection detected → recorded only' : 'Scan ran — nothing matched',
        body: event.signals?.length > 0 ? `Signal matched: "${event.signals[0]}"${event.signals.length > 1 ? ` (+${event.signals.length - 1} more)` : ''}.` : null,
        badge: { tone: blocked ? 'red' : event.detected ? 'attack' : 'sim', text: `action: ${event.action}` },
        borderTone: blocked ? C.red : event.detected ? C.attack : C.borderHi,
      };
    }
    case 'target_error':
      return { kind: 'ERROR', title: 'Target error', body: event.error, borderTone: C.red, errorCard: true };
    case 'loop_guard':
      return { kind: 'LOOP GUARD', title: 'Identical call re-proposed', body: event.reason, borderTone: C.red, errorCard: true };
    case 'turn_cap':
      return { kind: 'TURN CAP', title: `Reached after ${event.max_turns} turns`, borderTone: C.ochre };
    case 'response':
      return { kind: 'RESPONSE', title: 'Final response', body: event.text, borderTone: C.agent };
    default:
      return { kind: String(event.type ?? 'event').toUpperCase(), title: event.type, borderTone: C.text3 };
  }
}

function EventCard({ C, event }) {
  const meta = cardMeta(C, event);
  return (
    <div style={{
      border: `1px solid ${C.border}`, borderLeft: `3px solid ${meta.borderTone}`, borderRadius: C.radius,
      background: meta.errorCard ? C.redBg : C.panel, padding: '11px 13px',
      animation: 'fadeUp .3s ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
        <span style={{ fontFamily: C.mono, fontSize: C.size.micro, letterSpacing: .5, color: C.text3 }}>{meta.kind}</span>
        {meta.badge?.text && <Badge C={C} tone={meta.badge.tone}>{meta.badge.text}</Badge>}
        <span style={{ marginLeft: 'auto', fontFamily: C.mono, fontSize: C.size.micro, color: C.text3 }}>
          {Number.isInteger(event.turn) ? `t${event.turn}` : ''}
        </span>
      </div>
      <div style={{ fontWeight: 700, fontSize: C.size.small, color: meta.errorCard ? C.red : C.text1, marginBottom: meta.body ? 4 : 0 }}>
        {meta.title}
      </div>
      {meta.body && (
        <div style={{ fontSize: C.size.small, color: C.text2, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {meta.body}
        </div>
      )}
    </div>
  );
}

function ControlChip({ C, name, state }) {
  const toneKey = state === 'held' ? 'green' : state === 'failed' ? 'red' : 'sim';
  const t = TONE[toneKey](C);
  return (
    <span style={{
      fontFamily: C.mono, fontSize: C.size.micro, border: `1px solid ${t.border}55`, background: t.bg,
      color: t.color, borderRadius: C.radius, padding: '2px 8px',
    }}>
      {name} · {state}
    </span>
  );
}

function VerdictCard({ C, verdict }) {
  if (!verdict) return null;
  const color = getVerdictColor(verdict.verdict, C);
  const scope = verdict.scope ?? {};
  return (
    <div style={{
      border: `1px solid ${color}`, borderRadius: C.radius, padding: '15px 17px', background: C.panel,
      animation: 'fadeUp .3s ease-out',
    }}>
      <div style={{ fontSize: C.size.body, fontWeight: 900, color, marginBottom: 5 }}>
        Verdict: {getVerdictLabel(verdict.verdict)}
      </div>
      <div style={{ fontSize: C.size.small, color: C.text2, lineHeight: 1.5 }}>
        {verdict.reason?.code && <strong style={{ color: C.text1, fontFamily: C.mono }}>{verdict.reason.code}</strong>}
        {verdict.reason?.code && ' — '}
        {verdict.reason?.text}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        {(scope.controls_held ?? []).map(name => <ControlChip key={name} C={C} name={name} state="held" />)}
        {(scope.controls_failed ?? []).map(name => <ControlChip key={name} C={C} name={name} state="failed" />)}
        {(scope.controls_unexercised ?? []).map(name => <ControlChip key={name} C={C} name={name} state="unexercised" />)}
      </div>
      {verdict.observation && (
        <div style={{ fontSize: C.size.micro, color: C.text3, lineHeight: 1.5, marginTop: 10, paddingTop: 9, borderTop: `1px solid ${C.border}` }}>
          {verdict.observation.description}
          {verdict.observation.trial_note && <> {verdict.observation.trial_note}</>}
        </div>
      )}
    </div>
  );
}

export default function LiveRunConsole({ C, events, running, caseTitle, targetSummaryText, turnProgress, verdict }) {
  const latest = events[events.length - 1] ?? null;
  // onProgress fires before the network-bound step, ahead of any event for
  // that turn — so while waiting on a live target, this is more current
  // than the last card in the feed and is what should drive the "now" line.
  const waitingOnModel = running && turnProgress?.phase === 'awaiting_model'
    && turnProgress.turn > (latest?.turn ?? 0);
  const activePhase = running ? phaseIndexForEvent(latest?.type) : (verdict ? PHASES.length - 1 : -1);

  return (
    <div style={{ border: `1px solid ${C.borderHi}`, borderRadius: C.radius, background: C.bg, overflow: 'hidden' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 1, background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '11px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 9 }}>
          <span style={{ fontSize: C.size.small, fontWeight: 800, color: C.text1 }}>Live run</span>
          <span style={{ fontSize: C.size.micro, color: C.text3 }}>{caseTitle}</span>
          <span style={{ marginLeft: 'auto', fontFamily: C.mono, fontSize: C.size.micro, color: C.text3 }}>{targetSummaryText}</span>
        </div>

        <div role="tablist" aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', marginBottom: 9 }}>
          {PHASES.map((phase, index) => {
            const done = index < activePhase;
            const active = index === activePhase;
            return (
              <span key={phase} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {index > 0 && <span style={{ width: 14, height: 1, background: done ? C.green : C.border, flexShrink: 0 }} />}
                <span style={{
                  fontFamily: C.mono, fontSize: C.size.micro, padding: '3px 9px', borderRadius: C.radiusPill,
                  border: `1px solid ${active ? C.agent : C.border}`,
                  background: active ? C.agentBg : C.surface,
                  color: active ? C.text1 : done ? C.text2 : C.text3,
                  whiteSpace: 'nowrap',
                }}>
                  {done && <span style={{ color: C.green }}>✓ </span>}{phase}
                </span>
              </span>
            );
          })}
        </div>

        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 7, height: 7, borderRadius: C.radiusPill, flexShrink: 0,
            background: running ? C.agent : verdict ? C.green : C.text3,
            animation: running ? 'pulse 1.1s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: C.size.small, color: C.text1 }}>
            {waitingOnModel ? `Turn ${turnProgress.turn} — waiting for a model response…` : nowText(latest)}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '13px 14px', maxHeight: 520, overflowY: 'auto' }}>
        {events.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: C.text3, fontSize: C.size.small, border: `1px dashed ${C.border}`, borderRadius: C.radius }}>
            Events stream here the moment they happen — every card is the same entry that lands in the Evidence Contract.
          </div>
        )}
        {events.map((event, index) => <EventCard key={`${event.type}-${event.turn ?? 0}-${index}`} C={C} event={event} />)}
        <VerdictCard C={C} verdict={verdict} />
      </div>
    </div>
  );
}
