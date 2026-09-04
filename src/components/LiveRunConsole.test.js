import { describe, expect, it } from 'vitest';
import { cardMeta, nowText, phaseIndexForEvent } from './LiveRunConsole';

// A minimal stand-in for the C token object — just the fields cardMeta reads.
const C = {
  green: '#0f0', greenBg: '#0f01', red: '#f00', redBg: '#f001',
  attack: '#f0f', attackBg: '#f0f1', ochre: '#fa0', amberBg: '#fa01',
  agent: '#0ff', agentBg: '#0ff1', borderHi: '#888', border: '#444', text3: '#999',
};

describe('phaseIndexForEvent', () => {
  it('maps every real execution_chain event type to a phase on the rail', () => {
    expect(phaseIndexForEvent('prompt')).toBe(0);
    expect(phaseIndexForEvent('tool_call')).toBe(2);
    expect(phaseIndexForEvent('authorization_decision')).toBe(3);
    expect(phaseIndexForEvent('tool_result')).toBe(4);
    expect(phaseIndexForEvent('detection')).toBe(5);
  });

  it('keeps model turns, the final response, and stop conditions on the Model phase', () => {
    // These are all things a model turn produces or that stop the loop mid-turn
    // — none of them belongs to a later, more specific phase.
    ['model_turn', 'response', 'target_error', 'loop_guard', 'turn_cap', 'unknown_future_type'].forEach(type => {
      expect(phaseIndexForEvent(type)).toBe(1);
    });
  });
});

describe('nowText', () => {
  it('describes the two detection actions the resolved-observation fix distinguishes', () => {
    expect(nowText({ type: 'detection', action: 'blocked_or_constrained', detected: true }))
      .toMatch(/blocked it/);
    expect(nowText({ type: 'detection', action: 'detected_only', detected: true }))
      .toMatch(/detect-only/);
  });

  it('names the tool for a gate decision either way', () => {
    expect(nowText({ type: 'authorization_decision', blocked: true, tool: 'send_email' })).toBe('Gate blocked send_email.');
    expect(nowText({ type: 'authorization_decision', blocked: false, tool: 'retrieve_email' })).toBe('Gate allowed retrieve_email.');
  });

  it('falls back to a waiting message when there is no event yet', () => {
    expect(nowText(null)).toMatch(/waiting/i);
  });
});

describe('cardMeta', () => {
  it('marks a tool call sourced from untrusted content distinctly from a trusted one', () => {
    const untrusted = cardMeta(C, { type: 'tool_call', tool: 'send_email', args: {}, instruction_source_trusted: false, instruction_source: 'retrieved_content' });
    const trusted = cardMeta(C, { type: 'tool_call', tool: 'retrieve_email', args: {}, instruction_source_trusted: true, instruction_source: 'user' });
    expect(untrusted.badge.tone).toBe('attack');
    expect(untrusted.borderTone).toBe(C.attack);
    expect(trusted.badge.tone).toBe('green');
    expect(trusted.borderTone).toBe(C.green);
  });

  it('gives the two detection outcomes the fix distinguishes visibly different borders and badges', () => {
    const blocked = cardMeta(C, { type: 'detection', action: 'blocked_or_constrained', detected: true, signals: ['x'] });
    const flaggedOnly = cardMeta(C, { type: 'detection', action: 'detected_only', detected: true, signals: ['x'] });
    const clean = cardMeta(C, { type: 'detection', action: 'not_triggered', detected: false });

    expect(blocked.title).toBe('Injection detected → blocked');
    expect(blocked.borderTone).toBe(C.red);
    expect(flaggedOnly.title).toBe('Injection detected → recorded only');
    expect(flaggedOnly.borderTone).toBe(C.attack);
    expect(clean.title).toBe('Scan ran — nothing matched');
    expect(clean.borderTone).toBe(C.borderHi);

    // Same underlying fact (an injection signal was matched), different
    // borders — this is exactly the presentation-layer distinction the fix
    // is for: the two postures must not look identical.
    expect(blocked.borderTone).not.toBe(flaggedOnly.borderTone);
  });

  it('renders a gate denial and an unauthorized-required allow with opposite tones', () => {
    const blocked = cardMeta(C, { type: 'authorization_decision', blocked: true, tool: 'send_email', reason: 'not trusted', enforcing: true });
    const allowed = cardMeta(C, { type: 'authorization_decision', blocked: false, required: false, tool: 'retrieve_email', enforcing: true });
    expect(blocked.borderTone).toBe(C.red);
    expect(allowed.borderTone).toBe(C.green);
  });

  it('flags a target error as an error card', () => {
    const meta = cardMeta(C, { type: 'target_error', error: 'connection reset' });
    expect(meta.errorCard).toBe(true);
    expect(meta.body).toBe('connection reset');
  });

  it('never throws on an event type it does not recognize', () => {
    expect(() => cardMeta(C, { type: 'some_future_event' })).not.toThrow();
  });
});
