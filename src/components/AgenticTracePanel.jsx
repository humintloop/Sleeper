// Renders the real event stream from runAgentCase (src/harness/runAgentCase.js),
// not ORPHEUS's flat tool_sequence — this is a new component in shape, though it
// keeps AgenticTracePanel's card-per-event visual pattern.
import { AlertTriangle, ArrowRight, Ban, MessageSquare, Radar, ShieldAlert, Wrench } from 'lucide-react';

const EVENT_META = {
  prompt: { icon: MessageSquare, label: 'Control gate', tone: 'text3' },
  model_turn: { icon: MessageSquare, label: 'Model turn', tone: 'text1' },
  tool_call: { icon: Wrench, label: 'Tool call proposed', tone: 'brass' },
  authorization_decision: { icon: ShieldAlert, label: 'Authorization decision', tone: 'brass' },
  tool_result: { icon: ArrowRight, label: 'Tool result', tone: 'text2' },
  detection: { icon: Radar, label: 'Adversarial detection', tone: 'brass' },
  loop_guard: { icon: Ban, label: 'Loop guard', tone: 'red' },
  turn_cap: { icon: AlertTriangle, label: 'Turn cap reached', tone: 'red' },
  target_error: { icon: AlertTriangle, label: 'Target error', tone: 'red' },
  response: { icon: MessageSquare, label: 'Final response', tone: 'text1' },
};

function EventDetail({ C, event }) {
  switch (event.type) {
    case 'prompt':
      return <span>Task: <code style={codeStyle(C)}>{truncate(event.task, 140)}</code></span>;
    case 'model_turn':
      return (
        <span>
          {event.tool_call_count > 0
            ? `Proposed ${event.tool_call_count} tool call${event.tool_call_count > 1 ? 's' : ''}.`
            : 'No tool call — answered directly.'}
          {event.text && <> <code style={codeStyle(C)}>{truncate(event.text, 140)}</code></>}
        </span>
      );
    case 'tool_call':
      return (
        <span>
          <code style={codeStyle(C)}>{event.tool}</code> — instruction_source:{' '}
          <span style={{ color: isUntrustedSource(event.instruction_source) ? C.red : C.text2, fontWeight: 700 }}>
            {event.instruction_source ?? 'unattributed'}
          </span>
        </span>
      );
    case 'authorization_decision':
      return (
        <span>
          <code style={codeStyle(C)}>{event.tool}</code> — required: {String(event.required)}, enforcing: {String(event.enforcing)}
          {event.blocked && <span style={{ color: C.red, fontWeight: 700 }}> — BLOCKED</span>}
          {event.reason && <div style={{ marginTop: 4, color: C.text3 }}>{event.reason}</div>}
        </span>
      );
    case 'tool_result':
      return (
        <span>
          <code style={codeStyle(C)}>{event.tool}</code> — status: {event.status}
          {event.simulated_only && <span style={{ color: C.text3 }}> (simulated_only)</span>}
        </span>
      );
    case 'detection':
      return (
        <span>
          <code style={codeStyle(C)}>{event.tool}</code> — {event.detected ? 'matched' : 'no match'} ({event.action})
          {event.signals?.length > 0 && <div style={{ marginTop: 4, color: C.text3 }}>Signals: {event.signals.join(', ')}</div>}
        </span>
      );
    case 'loop_guard':
      return <span>{event.reason}</span>;
    case 'turn_cap':
      return <span>Stopped after {event.max_turns} turns.</span>;
    case 'target_error':
      return <span style={{ color: C.red }}>{event.error}</span>;
    case 'response':
      return <span>{truncate(event.text, 240) || '(empty)'}</span>;
    default:
      return null;
  }
}

function truncate(text, max) {
  if (typeof text !== 'string') return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function isUntrustedSource(source) {
  return !source || !['system', 'developer', 'user'].includes(source);
}

function codeStyle(C) {
  return { fontFamily: C.mono, fontSize: 11.5, background: C.ink, border: `1px solid ${C.border}`, borderRadius: 2, padding: '1px 5px', color: C.text1 };
}

export default function AgenticTracePanel({ C, run }) {
  if (!run) {
    return (
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2, padding: 18 }}>
        <div style={{ color: C.text3, fontSize: 13 }}>Run a case to see the ReAct loop&rsquo;s event stream here — every model turn, tool call, authorization decision, and result, in order.</div>
      </div>
    );
  }

  const events = run.events || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11, color: C.text3, fontFamily: C.mono, letterSpacing: .5 }}>
        <span>TURNS: {run.turns}/{run.maxTurns}</span>
        <span>STOP: {run.stopReason}</span>
        {run.degraded && <span style={{ color: C.red }}>DEGRADED: {run.degradations?.join(', ')}</span>}
      </div>

      {events.map((event, i) => {
        const meta = EVENT_META[event.type] || EVENT_META.model_turn;
        const Icon = meta.icon;
        const color = C[meta.tone] || C.text2;
        return (
          <div key={i} style={{ display: 'flex', gap: 10, background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}`, borderRadius: 2, padding: '10px 12px' }}>
            <Icon size={14} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ color, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>{meta.label}</span>
                <span style={{ color: C.text3, fontSize: 10, fontFamily: C.mono }}>T{event.turn}</span>
              </div>
              <div style={{ color: C.text2, fontSize: 12.5, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                <EventDetail C={C} event={event} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
