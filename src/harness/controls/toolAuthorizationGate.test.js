import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTHORITY_REGISTRY } from '../authorityRegistry';
import { runToolAuthorizationGate } from './toolAuthorizationGate';

const R = DEFAULT_AUTHORITY_REGISTRY;
const call = (tool, instructionSource = 'user') => ({ tool, args: {}, instructionSource });

describe('no tool call proposed', () => {
  it('records that nothing was attempted, and does not report a block', () => {
    const result = runToolAuthorizationGate(null, 'enforce', R);
    expect(result.tool_call_attempted).toBe(false);
    expect(result.tool_call_executed).toBe(false);
    expect(result.tool_blocked).toBe(false);
  });

  it('still records whether the gate was enforcing', () => {
    // An unexercised control is not a control that held. The verdict function
    // needs to see that the gate was on but never tested, so this must resolve
    // to INCONCLUSIVE rather than CONTROL_HELD downstream.
    expect(runToolAuthorizationGate(null, 'enforce', R).gate_enforcing).toBe(true);
    expect(runToolAuthorizationGate(null, 'off', R).gate_enforcing).toBe(false);
  });

  it('treats a malformed call as no call', () => {
    expect(runToolAuthorizationGate({}, 'enforce', R).tool_call_attempted).toBe(false);
  });
});

describe('mode: off', () => {
  it('lets a high-risk call from untrusted content execute', () => {
    const result = runToolAuthorizationGate(call('send_email', 'retrieved_content'), 'off', R);
    expect(result.tool_call_executed).toBe(true);
    expect(result.tool_blocked).toBe(false);
  });

  it('still records that authorization was required', () => {
    // The requirement is a property of the call, not of the posture. Baseline
    // has to be able to evidence what it let through.
    const result = runToolAuthorizationGate(call('send_email', 'retrieved_content'), 'off', R);
    expect(result.authorization_required).toBe(true);
    expect(result.untrusted_source).toBe(true);
  });
});

describe('mode: enforce', () => {
  it('allows a low-risk user-sourced call', () => {
    const result = runToolAuthorizationGate(call('retrieve_document', 'user'), 'enforce', R);
    expect(result.authorization_required).toBe(false);
    expect(result.tool_call_executed).toBe(true);
  });

  it('blocks a high-risk call even when the user asked for it', () => {
    const result = runToolAuthorizationGate(call('send_email', 'user'), 'enforce', R);
    expect(result.tool_blocked).toBe(true);
    expect(result.tool_call_executed).toBe(false);
    expect(result.tool_block_reason).toContain('high risk');
  });

  it('blocks a low-risk call whose instruction came from retrieved content', () => {
    const result = runToolAuthorizationGate(call('retrieve_document', 'retrieved_content'), 'enforce', R);
    expect(result.tool_blocked).toBe(true);
    expect(result.tool_block_reason).toContain('retrieved_content');
  });

  it('blocks a tool that is not in the registry', () => {
    const result = runToolAuthorizationGate(call('drop_database', 'user'), 'enforce', R);
    expect(result.tool_known).toBe(false);
    expect(result.tool_allowed).toBe(false);
    expect(result.tool_risk).toBe('unknown');
    expect(result.tool_blocked).toBe(true);
    expect(result.tool_block_reason).toContain('not in the authority registry');
  });

  it('blocks a call with no declared instruction source', () => {
    const result = runToolAuthorizationGate({ tool: 'retrieve_document' }, 'enforce', R);
    expect(result.untrusted_source).toBe(true);
    expect(result.tool_blocked).toBe(true);
    expect(result.tool_block_reason).toContain('unattributed');
  });

  it('names every applicable reason in the block record', () => {
    const result = runToolAuthorizationGate(call('send_email', 'retrieved_content'), 'enforce', R);
    expect(result.tool_block_reason).toContain('high risk');
    expect(result.tool_block_reason).toContain('not trusted');
  });
});

describe('approval', () => {
  it('lets a required-approval call proceed once approval is recorded', () => {
    const result = runToolAuthorizationGate(call('send_email', 'user'), 'enforce', R, {
      approvalGranted: true,
    });
    expect(result.authorization_required).toBe(true);
    expect(result.approval_granted).toBe(true);
    expect(result.tool_blocked).toBe(false);
    expect(result.tool_call_executed).toBe(true);
  });

  it('defaults to unapproved when no approval is passed', () => {
    const result = runToolAuthorizationGate(call('send_email', 'user'), 'enforce', R);
    expect(result.approval_granted).toBe(false);
  });

  it('does not accept a truthy non-true value as approval', () => {
    const result = runToolAuthorizationGate(call('send_email', 'user'), 'enforce', R, {
      approvalGranted: 'yes',
    });
    expect(result.approval_granted).toBe(false);
    expect(result.tool_blocked).toBe(true);
  });

  it('keeps enforcement and approval independent', () => {
    // The HITL failure modes vary approval while holding the gate enforcing.
    const result = runToolAuthorizationGate(call('write_file', 'user'), 'enforce', R, {
      approvalGranted: true,
    });
    expect(result.gate_enforcing).toBe(true);
    expect(result.approval_granted).toBe(true);
  });
});
