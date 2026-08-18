import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUTHORITY_REGISTRY,
  classifyToolCall,
  getToolDefinition,
  isTrustedInstructionSource,
  isUntrustedInstructionSource,
  requiresExplicitApproval,
} from './authorityRegistry';
import { runToolAuthorizationGate } from './controls/toolAuthorizationGate';

const R = DEFAULT_AUTHORITY_REGISTRY;

describe('authority registry shape', () => {
  it('declares the v1 tool set from the plan', () => {
    expect(Object.keys(R.tools).sort()).toEqual(
      ['read_file', 'retrieve_document', 'retrieve_email', 'send_email', 'web_search', 'write_file']
    );
  });

  it('gives every tool a complete trust-boundary record', () => {
    for (const [key, tool] of Object.entries(R.tools)) {
      expect(tool.name).toBe(key);
      expect(['low', 'medium', 'high']).toContain(tool.risk);
      expect(typeof tool.allowed).toBe('boolean');
      expect(typeof tool.requiresApproval).toBe('boolean');
      expect(typeof tool.trustedOutput).toBe('boolean');
    }
  });

  it('treats no tool output as trusted', () => {
    // Tool output is untrusted content by construction; a tool whose output was
    // trusted would silently defeat the indirect-injection case.
    expect(Object.values(R.tools).every(t => t.trustedOutput === false)).toBe(true);
  });

  it('marks every high-risk tool as requiring approval', () => {
    for (const tool of Object.values(R.tools)) {
      if (tool.risk === 'high') expect(tool.requiresApproval).toBe(true);
    }
  });

  it('shares no source between the trusted and untrusted sets', () => {
    const overlap = R.trustedSources.filter(s => R.untrustedSources.includes(s));
    expect(overlap).toEqual([]);
  });
});

describe('getToolDefinition', () => {
  it('returns the definition for a known tool', () => {
    expect(getToolDefinition(R, 'send_email').label).toBe('Send Email');
  });

  it('returns null for unknown tools and missing input', () => {
    expect(getToolDefinition(R, 'launch_missiles')).toBeNull();
    expect(getToolDefinition(R, undefined)).toBeNull();
    expect(getToolDefinition(undefined, 'send_email')).toBeNull();
  });
});

describe('instruction source provenance', () => {
  it('trusts only the declared trusted sources', () => {
    expect(isTrustedInstructionSource(R, 'user')).toBe(true);
    expect(isTrustedInstructionSource(R, 'system')).toBe(true);
    expect(isTrustedInstructionSource(R, 'retrieved_content')).toBe(false);
  });

  it('treats unattributed provenance as untrusted, not trusted', () => {
    expect(isUntrustedInstructionSource(R, undefined)).toBe(true);
    expect(isUntrustedInstructionSource(R, null)).toBe(true);
    expect(isUntrustedInstructionSource(R, 'some_source_nobody_declared')).toBe(true);
  });
});

describe('requiresExplicitApproval', () => {
  it('does not require approval for a low-risk tool called by the user', () => {
    expect(
      requiresExplicitApproval(R, { tool: 'retrieve_document', instructionSource: 'user' })
    ).toBe(false);
  });

  it('requires approval for a high-risk tool even from a trusted source', () => {
    expect(
      requiresExplicitApproval(R, { tool: 'send_email', instructionSource: 'user' })
    ).toBe(true);
  });

  it('requires approval for a low-risk tool when the instruction came from retrieved content', () => {
    expect(
      requiresExplicitApproval(R, { tool: 'retrieve_document', instructionSource: 'retrieved_content' })
    ).toBe(true);
  });

  it('requires approval for unknown tools and malformed calls', () => {
    expect(requiresExplicitApproval(R, { tool: 'exfiltrate_all', instructionSource: 'user' })).toBe(true);
    expect(requiresExplicitApproval(R, {})).toBe(true);
    expect(requiresExplicitApproval(R, null)).toBe(true);
  });

  it('requires approval for a tool the registry disallows', () => {
    const registry = {
      ...R,
      tools: { ...R.tools, read_file: { ...R.tools.read_file, allowed: false } },
    };
    expect(
      requiresExplicitApproval(registry, { tool: 'read_file', instructionSource: 'user' })
    ).toBe(true);
  });
});

describe('classifyToolCall is the one source of truth for the authorization decision', () => {
  // requiresExplicitApproval and the tool authorization gate used to each
  // compute known/allowed/risk/authorizationRequired independently. Both now
  // delegate to classifyToolCall; this pins the invariant so a future edit to
  // one path can't silently diverge from the other again.
  it('requiresExplicitApproval returns exactly classifyToolCall(...).authorizationRequired', () => {
    const calls = [
      { tool: 'retrieve_document', instructionSource: 'user' },
      { tool: 'send_email', instructionSource: 'user' },
      { tool: 'retrieve_document', instructionSource: 'retrieved_content' },
      { tool: 'nonexistent_tool', instructionSource: 'user' },
      {},
    ];
    for (const call of calls) {
      expect(requiresExplicitApproval(R, call)).toBe(classifyToolCall(R, call).authorizationRequired);
    }
  });

  it('the gate’s authorization_required field matches classifyToolCall for the same call', () => {
    const calls = [
      { tool: 'send_email', args: {}, instructionSource: 'user' },
      { tool: 'retrieve_document', args: {}, instructionSource: 'retrieved_content' },
      { tool: 'write_file', args: {}, instructionSource: 'user' },
    ];
    for (const call of calls) {
      const gateResult = runToolAuthorizationGate(call, 'enforce', R);
      expect(gateResult.authorization_required).toBe(classifyToolCall(R, call).authorizationRequired);
      expect(gateResult.tool_known).toBe(classifyToolCall(R, call).known);
      expect(gateResult.tool_risk).toBe(classifyToolCall(R, call).risk);
    }
  });
});

describe('MCP server policy', () => {
  const mcpRegistry = {
    ...R,
    servers: {
      sanctioned: { provenance: 'sanctioned', review_status: 'approved_at_connection' },
      hostile: { provenance: 'unsanctioned', review_status: 'never_reviewed' },
    },
    tools: {
      ...R.tools,
      safe_mcp: { name: 'safe_mcp', server: 'sanctioned', allowed: true, risk: 'low', requiresApproval: false },
      hostile_mcp: { name: 'hostile_mcp', server: 'hostile', allowed: true, risk: 'low', requiresApproval: false },
      orphan_mcp: { name: 'orphan_mcp', server: 'missing', allowed: true, risk: 'low', requiresApproval: false },
    },
  };

  it('allows a sanctioned reviewed server under ordinary tool policy', () => {
    const result = classifyToolCall(mcpRegistry, { tool: 'safe_mcp', instructionSource: 'user' });
    expect(result.serverKnown).toBe(true);
    expect(result.serverSanctioned).toBe(true);
    expect(result.authorizationRequired).toBe(false);
  });

  it('requires authorization for unsanctioned and unknown servers', () => {
    expect(classifyToolCall(mcpRegistry, { tool: 'hostile_mcp', instructionSource: 'user' }).authorizationRequired).toBe(true);
    expect(classifyToolCall(mcpRegistry, { tool: 'orphan_mcp', instructionSource: 'user' }).authorizationRequired).toBe(true);
  });
});
