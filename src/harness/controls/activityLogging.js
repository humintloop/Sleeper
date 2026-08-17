// Activity Logging
//
// Deterministic control: records what the run retained. Maps to AIUC-1 E015
// (log AI system activity); ATLAS AML.M0024.
//
// Ported from ORPHEUS `src/harness/controls/activityLogging.js`. Changes on
// port: a missing/invalid event list no longer throws (ORPHEUS called
// `events.slice` unguarded), and the retained-field set is shaped to the E015
// optional controls named in docs/agent-module-plan.md — provenance, tool-call
// parameters and results, authorization and approval events, reasoning traces.
// Shaping the trace to E015 is what lets the crosswalk cite it directly.
//
// `minimal` retains the first event only. That is deliberately inadequate: the
// point of the Baseline profile is to show what an under-logged run cannot
// evidence after the fact.

const RETAINED_NONE = {
  prompt_preserved: false,
  response_preserved: false,
  tool_trace_preserved: false,
  tool_parameters_preserved: false,
  authorization_decision_logged: false,
  provenance_preserved: false,
  reasoning_trace_preserved: false,
};

const RETAINED_FULL = {
  prompt_preserved: true,
  response_preserved: true,
  tool_trace_preserved: true,
  tool_parameters_preserved: true,
  authorization_decision_logged: true,
  provenance_preserved: true,
  reasoning_trace_preserved: true,
};

/**
 * @param {'off'|'minimal'|'full'} mode
 * @param {Array} events  ordered event stream for the run.
 * @returns {object} flat logging record for the Evidence Contract.
 */
export function runActivityLogging(mode, events) {
  const stream = Array.isArray(events) ? events : [];

  if (mode === 'off' || !mode) {
    return {
      ...RETAINED_NONE,
      activity_logged: false,
      review_required: false,
      log_entries: [],
      events_seen: stream.length,
      events_retained: 0,
    };
  }

  if (mode === 'minimal') {
    const retained = stream.slice(0, 1);
    return {
      ...RETAINED_NONE,
      activity_logged: true,
      review_required: false,
      log_entries: retained,
      events_seen: stream.length,
      events_retained: retained.length,
    };
  }

  return {
    ...RETAINED_FULL,
    activity_logged: true,
    review_required: true,
    log_entries: stream,
    events_seen: stream.length,
    events_retained: stream.length,
  };
}
