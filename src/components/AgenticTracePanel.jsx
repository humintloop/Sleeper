// Renders the real event stream from runAgentCase (src/harness/runAgentCase.js),
// not ORPHEUS's flat tool_sequence — this is a new component in shape, though it
// keeps AgenticTracePanel's card-per-event visual pattern.
import { AlertTriangle, ArrowRight, Ban, MessageSquare, Radar, ShieldAlert, Wrench } from 'lucide-react';

// Three tiers, per the investigation-workspace spec: `observed` is a literal
// record of what happened (a prompt sent, a call proposed, a result
// returned) with no judgment applied; `derived` is computed from observed
// facts by this harness's own deterministic policy (a gate decision, a
// detection match, the case-condition evaluator); `analyst_interpretation`
// is reserved for a human or secondary-model opinion layered on top — no
// event type emits one today (the secondary judge's opinion is a separate
// contract field, not a trace event), so the legend says that plainly
// rather than forcing something into a tier it doesn't belong in.
const CLASSIFICATION_LABEL = {
  observed: 'OBSERVED',
  derived: 'DERIVED',
  analyst_interpretation: 'ANALYST INTERPRETATION',
};

const EVENT_META = {
  prompt: { icon: MessageSquare, label: 'Control gate', tone: 'text3', classification: 'observed' },
  model_turn: { icon: MessageSquare, label: 'Model turn', tone: 'text1', classification: 'observed' },
  tool_call: { icon: Wrench, label: 'Tool call proposed', tone: 'brass', classification: 'observed' },
  authorization_decision: { icon: ShieldAlert, label: 'Authorization decision', tone: 'brass', classification: 'derived' },
  tool_result: { icon: ArrowRight, label: 'Tool result', tone: 'text2', classification: 'observed' },
  detection: { icon: Radar, label: 'Adversarial detection', tone: 'brass', classification: 'derived' },
  case_evaluation: { icon: Radar, label: 'Case-condition evaluation', tone: 'ochre', classification: 'derived' },
  loop_guard: { icon: Ban, label: 'Loop guard', tone: 'red', classification: 'derived' },
  turn_cap: { icon: AlertTriangle, label: 'Turn cap reached', tone: 'red', classification: 'derived' },
  target_error: { icon: AlertTriangle, label: 'Target error', tone: 'red', classification: 'observed' },
  response: { icon: MessageSquare, label: 'Final response', tone: 'text1', classification: 'observed' },
};

// Plain-language glosses for the enum values the harness emits. The raw code
// stays visible in the JSON export; the trace is where a first-time reader
// actually looks, so it gets translated rather than left as snake_case.
const STOP_REASON_LABEL = {
  no_tool_call: 'Model answered without calling a tool',
  turn_cap: 'Stopped at the turn limit',
  repeated_call: 'Stopped — the model repeated an identical call',
  target_error: 'Stopped — the target could not be reached',
};

const TOOL_STATUS_LABEL = {
  ok: 'executed',
  denied: 'denied',
  no_such_tool: 'no such tool',
};

const DETECTION_ACTION_LABEL = {
  not_configured: 'detection was off',
  not_triggered: 'scanned, nothing matched',
  detected_only: 'matched, not blocked (detect-only)',
  blocked_or_constrained: 'matched and blocked',
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
          <code style={codeStyle(C)}>{event.tool}</code> — instruction source:{' '}
          {/* Deny-by-default in the UI too: anything short of an explicit `true`
              from the gate reads as untrusted, matching authorityRegistry.js's
              own rule that unknown provenance is never treated as trusted. */}
          <span style={{ color: event.instruction_source_trusted === true ? C.text2 : C.red, fontWeight: 700 }}>
            {event.instruction_source ?? 'unattributed'}
            {event.instruction_source_trusted !== true && ' (untrusted)'}
          </span>
        </span>
      );
    case 'authorization_decision':
      return (
        <span>
          <code style={codeStyle(C)}>{event.tool}</code> —{' '}
          {event.required ? 'authorization required' : 'no authorization required'},{' '}
          gate {event.enforcing ? 'enforcing' : 'not enforcing'}
          {event.blocked && <span style={{ color: C.red, fontWeight: 700 }}> — BLOCKED</span>}
          {event.reason && <div style={{ marginTop: 4, color: C.text3 }}>{event.reason}</div>}
        </span>
      );
    case 'tool_result':
      return (
        <span>
          <code style={codeStyle(C)}>{event.tool}</code> — {TOOL_STATUS_LABEL[event.status] || event.status}
          {event.simulated_only && <span style={{ color: C.text3 }}> (simulated — no real action was taken)</span>}
        </span>
      );
    case 'detection':
      return (
        <span>
          <code style={codeStyle(C)}>{event.tool}</code> — {DETECTION_ACTION_LABEL[event.action] || event.action}
          {event.signals?.length > 0 && <div style={{ marginTop: 4, color: C.text3 }}>Matched: {event.signals.join(', ')}</div>}
        </span>
      );
    case 'case_evaluation':
      return (
        <span>
          Derived from recorded runtime fields — attack success: <strong>{event.attack_success}</strong>; partial control failure: <strong>{event.partial_control_failure}</strong>.
          {event.unsupported_signals?.length > 0 && (
            <div style={{ marginTop: 4, color: C.ochre }}>Unsupported signals: {event.unsupported_signals.join(', ')}</div>
          )}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11.5, color: C.text3 }}>
        <span>{run.turns} of {run.maxTurns} turns</span>
        <span>&middot;</span>
        <span>{STOP_REASON_LABEL[run.stopReason] || run.stopReason}</span>
        {run.degraded && (
          <>
            <span>&middot;</span>
            <span style={{ color: C.red, fontWeight: 700 }}>DEGRADED</span>
          </>
        )}
      </div>
      {run.degraded && run.degradations?.length > 0 && (
        <div style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.5 }}>
          {run.degradations.map((note, i) => <div key={i}>{note}</div>)}
        </div>
      )}

      <div style={{ fontSize: 10.5, color: C.text3, lineHeight: 1.5, padding: '8px 10px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2 }}>
        <strong style={{ color: C.text2 }}>OBSERVED</strong> — a literal record of what happened, no judgment applied.{' '}
        <strong style={{ color: C.text2 }}>DERIVED</strong> — computed from observed facts by this harness&rsquo;s own
        deterministic policy (a gate decision, a detection match, the case-condition evaluator). No event below is an{' '}
        <strong style={{ color: C.text2 }}>analyst interpretation</strong> — that tier exists in this taxonomy but nothing
        in this trace produces one; a secondary-model opinion, if enabled, lives on the Evidence Contract, not here.
      </div>

      {events.map((event, i) => {
        const meta = EVENT_META[event.type] || EVENT_META.model_turn;
        const Icon = meta.icon;
        const color = C[meta.tone] || C.text2;
        const classification = event.classification || meta.classification;
        return (
          <div key={i} style={{ display: 'flex', gap: 10, background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}`, borderRadius: 2, padding: '10px 12px' }}>
            <Icon size={14} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                <span style={{ color, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>{meta.label}</span>
                <span style={{ color: C.text3, fontSize: 10, fontFamily: C.mono }}>T{event.turn}</span>
                {classification && (
                  <span style={{ color: C.text3, fontSize: 9, fontWeight: 700, letterSpacing: .8, border: `1px solid ${C.borderHi}`, borderRadius: 2, padding: '1px 5px' }}>
                    {CLASSIFICATION_LABEL[classification] || classification.toUpperCase()}
                  </span>
                )}
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
