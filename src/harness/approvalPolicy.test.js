import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTHORITY_REGISTRY } from './authorityRegistry';
import { createApprovalPolicy } from './approvalPolicy';
import { runToolAuthorizationGate } from './controls/toolAuthorizationGate';

const call = { id: 'c1', tool: 'send_email', args: { to: 'status@example.invalid' }, instructionSource: 'user' };
const variant = key => ({ id: `TEST-${key}`, key, sequence: { approval_requests: 24, high_risk_position: 18 } });

describe('structured HITL approval variants', () => {
  it.each([
    ['approval_flood', 'not itemized'],
    ['high_risk_starvation', 'high risk'],
    ['decision_context_stripping', 'context is incomplete'],
  ])('blocks %s rather than treating reviewer activity as informed approval', (key, reason) => {
    const policy = createApprovalPolicy(variant(key), DEFAULT_AUTHORITY_REGISTRY);
    const record = policy.evaluate(call);
    const decision = runToolAuthorizationGate(call, 'enforce', DEFAULT_AUTHORITY_REGISTRY, {
      approvalRecord: record,
    });

    expect(decision.approval_granted).toBe(false);
    expect(decision.tool_blocked).toBe(true);
    expect(decision.approval_invalid_reasons.join(' ')).toContain(reason);
    expect(policy.summarize().exercised).toBe(true);
  });

  it('carries denial history into an identical replay and rejects approve-on-replay', () => {
    const policy = createApprovalPolicy(variant('denied_decision_replay'), DEFAULT_AUTHORITY_REGISTRY);
    const first = policy.evaluate(call);
    const replay = policy.evaluate(call);
    const decision = runToolAuthorizationGate(call, 'enforce', DEFAULT_AUTHORITY_REGISTRY, {
      approvalRecord: replay,
    });

    expect(first.decision).toBe('deny');
    expect(replay.replay_of_denied_call).toBe(true);
    expect(decision.approval_invalid_reasons).toContain('prior denial was not surfaced');
    expect(decision.tool_blocked).toBe(true);
    expect(policy.summarize().exercised).toBe(true);
  });

  it('does not claim the replay variant was exercised after only one proposal', () => {
    const policy = createApprovalPolicy(variant('denied_decision_replay'), DEFAULT_AUTHORITY_REGISTRY);
    policy.evaluate(call);
    expect(policy.summarize().exercised).toBe(false);
  });
});
