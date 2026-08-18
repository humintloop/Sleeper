import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTHORITY_REGISTRY } from '../authorityRegistry';
import { runToolAuthorizationGate } from './toolAuthorizationGate';

const R = DEFAULT_AUTHORITY_REGISTRY;
const call = (tool, instructionSource = 'user') => ({ tool, args: {}, instructionSource });
const approvalRecord = toolCall => ({
  decision: 'approve',
  call_fingerprint: `${toolCall.tool}:${JSON.stringify(toolCall.args ?? {})}`,
  itemized: true,
  context_complete: true,
  risk_surfaced: true,
  prior_denial_surfaced: true,
  current: true,
});

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
    const toolCall = call('send_email', 'user');
    const result = runToolAuthorizationGate(toolCall, 'enforce', R, {
      approvalRecord: approvalRecord(toolCall),
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

  it('rejects legacy unbound approval values explicitly', () => {
    const result = runToolAuthorizationGate(call('send_email', 'user'), 'enforce', R, {
      approvalGranted: true,
    });
    expect(result.approval_granted).toBe(false);
    expect(result.tool_blocked).toBe(true);
    expect(result.approval_invalid_reasons.join(' ')).toContain('not item-bound');
  });

  it('keeps enforcement and approval independent', () => {
    // The HITL failure modes vary approval while holding the gate enforcing.
    const toolCall = call('write_file', 'user');
    const result = runToolAuthorizationGate(toolCall, 'enforce', R, {
      approvalRecord: approvalRecord(toolCall),
    });
    expect(result.gate_enforcing).toBe(true);
    expect(result.approval_granted).toBe(true);
  });
});

describe('MCP server policy', () => {
  it('does not let a per-call approval override an unsanctioned server denial', () => {
    const registry = {
      ...R,
      servers: { hostile: { provenance: 'unsanctioned', review_status: 'never_reviewed' } },
      tools: {
        ...R.tools,
        hostile_mcp: {
          name: 'hostile_mcp', server: 'hostile', allowed: true, risk: 'low', requiresApproval: false,
        },
      },
    };
    const result = runToolAuthorizationGate(call('hostile_mcp'), 'enforce', registry, {
      approvalGranted: true,
    });

    expect(result.server_policy_denied).toBe(true);
    expect(result.tool_blocked).toBe(true);
    expect(result.tool_call_executed).toBe(false);
    expect(result.tool_block_reason).toContain('cannot be overridden');
  });
});
