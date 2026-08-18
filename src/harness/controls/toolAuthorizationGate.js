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
import { fingerprintToolCall } from '../approvalPolicy.js';

const IDLE_RESULT = {
  tool_call_attempted: false,
  tool_call_executed: false,
  tool_known: false,
  tool_allowed: false,
  tool_risk: null,
  server_id: null,
  server_known: true,
  server_sanctioned: true,
  server_policy_denied: false,
  instruction_source: null,
  untrusted_source: false,
  authorization_required: false,
  gate_enforcing: false,
  approval_granted: false,
  approval_valid: false,
  approval_invalid_reasons: [],
  approval_record: null,
  tool_blocked: false,
  tool_block_reason: null,
};

/**
 * @param {object|null} toolCall  `{ tool, args, instructionSource }`, or null when
 *   the model proposed no tool call on this turn.
 * @param {'off'|'enforce'} mode  the profile's `controls.toolAuthorization`.
 * @param {object} registry       authority registry to evaluate against.
 * @param {object} [options]
 * @param {object} [options.approvalRecord] structured, item-bound approval.
 * @param {boolean} [options.approvalGranted] legacy unbound input; retained only
 *   so callers receive an explicit rejection rather than a silent reinterpretation.
 * @returns {object} a flat, serializable decision record for the Evidence Contract.
 */
export function runToolAuthorizationGate(toolCall, mode, registry, options = {}) {
  if (!toolCall?.tool) {
    return { ...IDLE_RESULT, gate_enforcing: mode === 'enforce' };
  }

  const gateEnforcing = mode === 'enforce';
  const source = toolCall.instructionSource ?? null;

  const {
    known,
    allowed,
    risk,
    untrustedSource,
    authorizationRequired,
    serverId,
    serverKnown,
    serverSanctioned,
  } = classifyToolCall(registry, toolCall);

  const approval = validateApprovalRecord(toolCall, risk, authorizationRequired, options);
  const approvalGranted = approval.valid;

  const serverPolicyDenied = Boolean(serverId) && (!serverKnown || !serverSanctioned);
  const blocked = gateEnforcing && (serverPolicyDenied || (authorizationRequired && !approvalGranted));

  return {
    tool_call_attempted: true,
    tool_call_executed: !blocked,
    tool_known: known,
    tool_allowed: allowed,
    tool_risk: risk,
    server_id: serverId,
    server_known: serverKnown,
    server_sanctioned: serverSanctioned,
    server_policy_denied: serverPolicyDenied,
    instruction_source: source,
    untrusted_source: untrustedSource,
    authorization_required: authorizationRequired,
    gate_enforcing: gateEnforcing,
    approval_granted: approvalGranted,
    approval_valid: approval.valid,
    approval_invalid_reasons: approval.reasons,
    approval_record: approval.record,
    tool_blocked: blocked,
    tool_block_reason: blocked
      ? describeBlock(toolCall.tool, known, allowed, risk, untrustedSource, source, serverId, serverKnown, serverSanctioned, serverPolicyDenied)
      : null,
  };
}

function validateApprovalRecord(toolCall, risk, authorizationRequired, options) {
  if (!authorizationRequired) return { valid: false, reasons: [], record: null };
  const record = options.approvalRecord;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return {
      valid: false,
      reasons: options.approvalGranted === true
        ? ['legacy boolean approval is not item-bound and is rejected']
        : ['no structured approval record'],
      record: null,
    };
  }

  const reasons = [];
  if (record.decision !== 'approve') reasons.push('approval decision is not approve');
  if (record.call_fingerprint !== fingerprintToolCall(toolCall)) reasons.push('approval is bound to a different call');
  if (record.itemized !== true || record.bulk_approval === true) reasons.push('approval is not itemized');
  if (record.context_complete !== true) reasons.push('approval context is incomplete');
  if (risk === 'high' && record.risk_surfaced !== true) reasons.push('high risk was not surfaced to the reviewer');
  if (record.prior_denial_surfaced === false) reasons.push('prior denial was not surfaced');
  if (record.current !== true) reasons.push('approval is stale');
  return { valid: reasons.length === 0, reasons, record };
}

function describeBlock(toolName, known, allowed, risk, untrustedSource, source, serverId, serverKnown, serverSanctioned, serverPolicyDenied) {
  const reasons = [];
  if (!known) reasons.push('tool is not in the authority registry');
  else if (!allowed) reasons.push('tool is disallowed by the authority registry');
  else if (risk === 'high') reasons.push('tool is high risk');
  if (serverId && !serverKnown) reasons.push(`MCP server '${serverId}' is not registered`);
  else if (serverId && !serverSanctioned) reasons.push(`MCP server '${serverId}' is not sanctioned`);
  if (untrustedSource) {
    reasons.push(`instruction source '${source ?? 'unattributed'}' is not trusted`);
  }
  if (reasons.length === 0) reasons.push('tool requires approval');
  return `Blocked '${toolName}': ${reasons.join('; ')}. ${
    serverPolicyDenied ? 'Server policy denials cannot be overridden by per-call approval.' : 'No approval recorded.'
  }`;
}
