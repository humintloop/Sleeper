// Gate conformance suite — deterministic evidence about Sleeper's own
// authorization gate, exercised directly, with no model in the loop at all.
//
// The gate does not need a model to fall for bait to be testable: it is a
// pure function of (call, mode, registry, options). This runs the same kind
// of synthetic proposals toolAuthorizationGate.test.js already covers, but as
// a runnable, demonstrable suite rather than only as CI assertions — the case
// this exists for is showing someone the gate actually enforces what this
// project claims it enforces, in under a second, with no API key and no
// target of any kind.
//
// Evidence discipline: this is enforcement evidence about Sleeper's own gate
// — the same distinction the README already draws for every mock-tool run
// ("that is enforcement by Sleeper's own gate, and evidence about the
// target's behavior only... a mock-tool run does not establish that a
// production system would have blocked anything"). It says nothing about any
// target, live or otherwise, and nothing here is a case run: no Evidence
// Contract, no verdict, no case_evaluation. A pass/fail table is the whole
// claim.
import { DEFAULT_AUTHORITY_REGISTRY } from './authorityRegistry.js';
import { runToolAuthorizationGate } from './controls/toolAuthorizationGate.js';

const call = (tool, instructionSource, args = {}) => ({ tool, args, instructionSource });

const approvalRecord = toolCall => ({
  decision: 'approve',
  call_fingerprint: `${toolCall.tool}:${JSON.stringify(toolCall.args ?? {})}`,
  itemized: true,
  context_complete: true,
  risk_surfaced: true,
  prior_denial_surfaced: true,
  current: true,
});

/**
 * One conformance case: a synthetic proposal, the mode it is run under, and
 * the one fact being asserted about the gate's decision. `expect` reads a
 * single field off the gate's own record — never a re-derivation of the
 * gate's logic, so a case can only pass by the gate actually deciding that
 * way, not by this file re-implementing the decision and comparing to itself.
 */
export const GATE_CONFORMANCE_CASES = [
  {
    id: 'trusted-low-risk-allowed',
    description: 'A low-risk call sourced from the user executes under an enforcing gate.',
    run: () => runToolAuthorizationGate(call('retrieve_document', 'user'), 'enforce', DEFAULT_AUTHORITY_REGISTRY),
    field: 'tool_call_executed',
    expected: true,
  },
  {
    id: 'untrusted-high-risk-blocked',
    description: 'A high-risk call sourced from retrieved content is blocked under an enforcing gate.',
    run: () => runToolAuthorizationGate(call('send_email', 'retrieved_content'), 'enforce', DEFAULT_AUTHORITY_REGISTRY),
    field: 'tool_blocked',
    expected: true,
  },
  {
    id: 'trusted-high-risk-still-blocked',
    description: 'A high-risk call is blocked even when the user asked for it directly — risk, not just provenance, gates it.',
    run: () => runToolAuthorizationGate(call('send_email', 'user'), 'enforce', DEFAULT_AUTHORITY_REGISTRY),
    field: 'tool_blocked',
    expected: true,
  },
  {
    id: 'untrusted-low-risk-still-blocked',
    description: 'A low-risk call is still blocked when sourced from retrieved content — provenance, not just risk, gates it.',
    run: () => runToolAuthorizationGate(call('retrieve_document', 'retrieved_content'), 'enforce', DEFAULT_AUTHORITY_REGISTRY),
    field: 'tool_blocked',
    expected: true,
  },
  {
    id: 'unattributed-source-blocked',
    description: 'A call with no declared instruction source is treated as untrusted and blocked.',
    run: () => runToolAuthorizationGate({ tool: 'retrieve_document', args: {} }, 'enforce', DEFAULT_AUTHORITY_REGISTRY),
    field: 'tool_blocked',
    expected: true,
  },
  {
    id: 'unknown-tool-blocked',
    description: 'A tool absent from the authority registry is blocked, not silently allowed.',
    run: () => runToolAuthorizationGate(call('drop_database', 'user'), 'enforce', DEFAULT_AUTHORITY_REGISTRY),
    field: 'tool_blocked',
    expected: true,
  },
  {
    id: 'gate-off-lets-untrusted-high-risk-through',
    description: 'With the gate off, the same high-risk untrusted call executes — the control has to be able to evidence what an off posture lets through.',
    run: () => runToolAuthorizationGate(call('send_email', 'retrieved_content'), 'off', DEFAULT_AUTHORITY_REGISTRY),
    field: 'tool_call_executed',
    expected: true,
  },
  {
    id: 'approved-call-proceeds',
    description: 'A call requiring approval proceeds once a valid, itemized approval record is presented.',
    run: () => {
      const toolCall = call('send_email', 'user');
      return runToolAuthorizationGate(toolCall, 'enforce', DEFAULT_AUTHORITY_REGISTRY, { approvalRecord: approvalRecord(toolCall) });
    },
    field: 'tool_call_executed',
    expected: true,
  },
  {
    id: 'legacy-unbound-approval-rejected',
    description: 'A legacy boolean approval, not bound to the specific call, is rejected rather than trusted.',
    run: () => runToolAuthorizationGate(call('send_email', 'user'), 'enforce', DEFAULT_AUTHORITY_REGISTRY, { approvalGranted: true }),
    field: 'tool_blocked',
    expected: true,
  },
  {
    id: 'unsanctioned-server-denial-not-overridable',
    description: 'An unsanctioned MCP server’s denial cannot be overridden by a per-call approval.',
    run: () => {
      const registry = {
        ...DEFAULT_AUTHORITY_REGISTRY,
        servers: { hostile: { provenance: 'unsanctioned', review_status: 'never_reviewed' } },
        tools: {
          ...DEFAULT_AUTHORITY_REGISTRY.tools,
          hostile_mcp: { name: 'hostile_mcp', server: 'hostile', allowed: true, risk: 'low', requiresApproval: false },
        },
      };
      return runToolAuthorizationGate(call('hostile_mcp', 'user'), 'enforce', registry, { approvalGranted: true });
    },
    field: 'tool_blocked',
    expected: true,
  },
];

/** Runs every declared case and returns a flat pass/fail report. Synchronous — no target, no network, no model. */
export function runGateConformanceSuite(cases = GATE_CONFORMANCE_CASES) {
  const results = cases.map(testCase => {
    const record = testCase.run();
    const actual = record?.[testCase.field];
    return {
      id: testCase.id,
      description: testCase.description,
      field: testCase.field,
      expected: testCase.expected,
      actual,
      passed: actual === testCase.expected,
      record,
    };
  });
  return {
    generated_at: new Date().toISOString(),
    target: 'sleeper_gate_direct',
    claim_scope: 'Enforcement evidence about Sleeper’s own authorization gate. No target, live or otherwise, is exercised or characterized by this suite.',
    results,
    summary: {
      total: results.length,
      passed: results.filter(item => item.passed).length,
      failed: results.filter(item => !item.passed).length,
    },
  };
}
