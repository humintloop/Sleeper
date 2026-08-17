// Authority Registry
//
// Declares the tools the agent is told it has, their trust boundaries, and
// whether authorization is required before a call runs. This is the data model
// both the tool-authorization control and (later) the MCP case read from.
//
// Ported from ORPHEUS `src/harness/authorityRegistry.js`. Changes on port:
//   - tool set replaced with the v1 set named in docs/agent-module-plan.md
//     (§Harness architecture) rather than ORPHEUS's demo-target tools;
//   - `risk` / `requiresApproval` now live here as the single source of truth,
//     replacing the HIGH_RISK_TOOLS array that lived in the discarded
//     demoTarget.js fixture module.
//
// Nothing here executes. Tool *effects* are simulated in the mock router
// (week 4); this module only describes what is permitted.

/**
 * Instruction provenance is the field the indirect-injection case turns on:
 * a tool call originating in retrieved content is a different event from the
 * same call originating with the user, even when the arguments are identical.
 * See ATLAS AML.M0030.
 */
export const TRUSTED_SOURCES = ['system', 'developer', 'user'];

export const UNTRUSTED_SOURCES = [
  'retrieved_content',
  'tool_output',
  'web_search',
  'document',
  'email',
];

export const DEFAULT_AUTHORITY_REGISTRY = {
  id: 'SLEEPER-AUTHORITY-REGISTRY-v1',
  trustedSources: TRUSTED_SOURCES,
  untrustedSources: UNTRUSTED_SOURCES,
  tools: {
    retrieve_document: {
      name: 'retrieve_document',
      label: 'Retrieve Document',
      risk: 'low',
      allowed: true,
      requiresApproval: false,
      trustedOutput: false,
      description: 'Returns document content for the current task. Output is untrusted.',
    },
    web_search: {
      name: 'web_search',
      label: 'Web Search',
      risk: 'low',
      allowed: true,
      requiresApproval: false,
      trustedOutput: false,
      description: 'Returns search results. Output is untrusted.',
    },
    read_file: {
      name: 'read_file',
      label: 'Read File',
      risk: 'medium',
      allowed: true,
      requiresApproval: false,
      trustedOutput: false,
      description: 'Reads a file from the simulated workspace. Output is untrusted.',
    },
    write_file: {
      name: 'write_file',
      label: 'Write File',
      risk: 'high',
      allowed: true,
      requiresApproval: true,
      trustedOutput: false,
      description: 'Writes a file. High risk: modifies state and is not trivially reversible.',
    },
    send_email: {
      name: 'send_email',
      label: 'Send Email',
      risk: 'high',
      allowed: true,
      requiresApproval: true,
      trustedOutput: false,
      description: 'Sends outbound email. High risk: externally visible and can exfiltrate data.',
    },
  },
};

export function getToolDefinition(registry, toolName) {
  if (!toolName) return null;
  return registry?.tools?.[toolName] ?? null;
}

export function isTrustedInstructionSource(registry, source) {
  if (!source) return false;
  return Boolean(registry?.trustedSources?.includes(source));
}

/**
 * A source is untrusted if the registry names it untrusted, or if it is not
 * named at all. Unknown provenance is never treated as trusted — an
 * unattributed tool call is exactly the case this module exists to catch.
 */
export function isUntrustedInstructionSource(registry, source) {
  if (isTrustedInstructionSource(registry, source)) return false;
  return true;
}

/**
 * The single classification of a proposed tool call against the registry —
 * deny-by-default: an unknown tool, a disallowed tool, a tool flagged
 * `requiresApproval`, a high-risk tool, or any call whose instruction did not
 * come from a trusted source all require authorization.
 *
 * `toolAuthorizationGate.js` and `requiresExplicitApproval` below both need
 * this same decision — the gate also needs the decomposed `known`/`allowed`/
 * `risk` fields for its own output record, `requiresExplicitApproval` needs
 * only the final boolean. One computation, two call sites, so they cannot
 * silently diverge if one is edited and not the other.
 */
export function classifyToolCall(registry, toolCall) {
  const tool = getToolDefinition(registry, toolCall?.tool);
  const known = Boolean(tool);
  const allowed = known ? tool.allowed !== false : false;
  const risk = known ? tool.risk : 'unknown';
  const untrustedSource = isUntrustedInstructionSource(registry, toolCall?.instructionSource);
  const authorizationRequired = !known || !allowed || risk === 'high' || tool?.requiresApproval === true || untrustedSource;

  return { known, allowed, risk, untrustedSource, authorizationRequired };
}

/**
 * Whether a tool call needs explicit authorization before it may run. See
 * `classifyToolCall` for the underlying decision.
 */
export function requiresExplicitApproval(registry, toolCall) {
  return classifyToolCall(registry, toolCall).authorizationRequired;
}
