import { describe, expect, it } from 'vitest';
import { runActivityLogging } from './activityLogging';

const EVENTS = [
  { type: 'prompt', turn: 0 },
  { type: 'tool_call', turn: 1, tool: 'send_email' },
  { type: 'authorization_decision', turn: 1, blocked: true },
  { type: 'response', turn: 2 },
];

describe('mode: off', () => {
  it('retains nothing and says so', () => {
    const result = runActivityLogging('off', EVENTS);
    expect(result.activity_logged).toBe(false);
    expect(result.log_entries).toEqual([]);
    expect(result.events_retained).toBe(0);
  });

  it('still records how many events it saw and dropped', () => {
    expect(runActivityLogging('off', EVENTS).events_seen).toBe(4);
  });

  it('treats a missing mode as off', () => {
    expect(runActivityLogging(undefined, EVENTS).activity_logged).toBe(false);
  });
});

describe('mode: minimal', () => {
  it('logs, but retains only the first event', () => {
    const result = runActivityLogging('minimal', EVENTS);
    expect(result.activity_logged).toBe(true);
    expect(result.log_entries).toEqual([EVENTS[0]]);
    expect(result.events_retained).toBe(1);
    expect(result.events_seen).toBe(4);
  });

  it('preserves none of the E015 fields', () => {
    // Baseline's point: an under-logged run cannot evidence what happened,
    // and the authorization decision is exactly what is lost.
    const result = runActivityLogging('minimal', EVENTS);
    expect(result.authorization_decision_logged).toBe(false);
    expect(result.tool_trace_preserved).toBe(false);
    expect(result.provenance_preserved).toBe(false);
    expect(result.review_required).toBe(false);
  });
});

describe('mode: full', () => {
  it('retains the whole event stream', () => {
    const result = runActivityLogging('full', EVENTS);
    expect(result.log_entries).toEqual(EVENTS);
    expect(result.events_retained).toBe(4);
  });

  it('preserves the fields AIUC-1 E015 names', () => {
    const result = runActivityLogging('full', EVENTS);
    expect(result.prompt_preserved).toBe(true);
    expect(result.response_preserved).toBe(true);
    expect(result.tool_trace_preserved).toBe(true);
    expect(result.tool_parameters_preserved).toBe(true);
    expect(result.authorization_decision_logged).toBe(true);
    expect(result.provenance_preserved).toBe(true);
    expect(result.reasoning_trace_preserved).toBe(true);
    expect(result.review_required).toBe(true);
  });
});

describe('inputs', () => {
  it('does not throw when the event stream is missing', () => {
    expect(() => runActivityLogging('minimal')).not.toThrow();
    expect(() => runActivityLogging('full')).not.toThrow();
    expect(runActivityLogging('minimal').log_entries).toEqual([]);
    expect(runActivityLogging('full').events_seen).toBe(0);
  });

  it('does not throw when the event stream is not an array', () => {
    expect(runActivityLogging('full', 'not-an-array').log_entries).toEqual([]);
  });

  it('does not mutate the caller event stream', () => {
    const events = [...EVENTS];
    runActivityLogging('full', events);
    expect(events).toEqual(EVENTS);
  });
});
