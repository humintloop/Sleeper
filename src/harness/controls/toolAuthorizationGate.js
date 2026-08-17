// Tool Authorization Gate
//
// Deterministic control: decides whether a proposed tool call may execute.
// Maps to AIUC-1 B006 (prevent unauthorized AI agent actions) and D003
// (restrict unsafe tool calls); ATLAS AML.M0028 / AML.M0030.
//
// Ported from ORPHEUS `src/harness/controls/toolAuthorizationGate.js`.
// Changes on port:
//   - risk is read from the authority registry instead of the HIGH_RISK_TOOLS
//     array in the discarded demoTarget.js fixture module;
//   - untrusted provenance is the registry's full untrusted-source set, not a
//     literal comparison against 'retrieved_content';
//   - ORPHEUS's `authorization_present` conflated "the gate is enforcing" with
//     "an approval exists". Those are now two fields: `gate_enforcing` and
//     `approval_granted`. The HITL failure modes in case 2 need to vary the
//     second while holding the first fixed, which the old shape could not
//     express.
//
// The known/allowed/risk/authorization-required decision itself is
// `authorityRegistry.js`'s `classifyToolCall` — this gate used to recompute it
// inline, which briefly diverged from `requiresExplicitApproval`'s copy of the
// same logic. One computation now; this file only adds enforcement.
//
// This control decides only. It never executes a tool.

import { classifyToolCall } from '../authorityRegistry.js';

const IDLE_RESULT = {
  tool_call_attempted: false,
  tool_call_executed: false,
  tool_known: false,
  tool_allowed: false,
  tool_risk: null,
  instruction_source: null,
  untrusted_source: false,
  authorization_required: false,
  gate_enforcing: false,
  approval_granted: false,
  tool_blocked: false,
  tool_block_reason: null,
};

/**
 * @param {object|null} toolCall  `{ tool, args, instructionSource }`, or null when
 *   the model proposed no tool call on this turn.
 * @param {'off'|'enforce'} mode  the profile's `controls.toolAuthorization`.
 * @param {object} registry       authority registry to evaluate against.
 * @param {object} [options]
 * @param {boolean} [options.approvalGranted=false]  whether a human approval was
 *   recorded for this specific call. Week 2 has no approval UI, so callers pass
 *   nothing and the gate treats the call as unapproved.
 * @returns {object} a flat, serializable decision record for the Evidence Contract.
 */
export function runToolAuthorizationGate(toolCall, mode, registry, options = {}) {
  if (!toolCall?.tool) {
    return { ...IDLE_RESULT, gate_enforcing: mode === 'enforce' };
  }

  const approvalGranted = options.approvalGranted === true;
  const gateEnforcing = mode === 'enforce';
  const source = toolCall.instructionSource ?? null;

  const { known, allowed, risk, untrustedSource, authorizationRequired } = classifyToolCall(registry, toolCall);

  const blocked = gateEnforcing && authorizationRequired && !approvalGranted;

  return {
    tool_call_attempted: true,
    tool_call_executed: !blocked,
    tool_known: known,
    tool_allowed: allowed,
    tool_risk: risk,
    instruction_source: source,
    untrusted_source: untrustedSource,
    authorization_required: authorizationRequired,
    gate_enforcing: gateEnforcing,
    approval_granted: approvalGranted,
    tool_blocked: blocked,
    tool_block_reason: blocked ? describeBlock(toolCall.tool, known, allowed, risk, untrustedSource, source) : null,
  };
}

function describeBlock(toolName, known, allowed, risk, untrustedSource, source) {
  const reasons = [];
  if (!known) reasons.push('tool is not in the authority registry');
  else if (!allowed) reasons.push('tool is disallowed by the authority registry');
  else if (risk === 'high') reasons.push('tool is high risk');
  if (untrustedSource) {
    reasons.push(`instruction source '${source ?? 'unattributed'}' is not trusted`);
  }
  if (reasons.length === 0) reasons.push('tool requires approval');
  return `Blocked '${toolName}': ${reasons.join('; ')}. No approval recorded.`;
}
