// Evidence Contract
//
// What a SLEEPER artifact permits its author to claim, made structural rather
// than left to prose disclaimers. Three orthogonal axes, adopted from the
// evidence-class taxonomy in `msaleme/red-team-blue-team-agent-fabric`
// (Apache 2.0) and specified in docs/agent-module-plan.md §"Borrowed" and
// §"Reporting":
//
//   - evidence class E1–E5: what kind of artifact this is;
//   - oracle independence I0–I2: who produced the oracle;
//   - status: mapped / executed / independently reviewed / certified.
//
// Two rules from that section are load-bearing and are enforced here rather than
// documented:
//
//   1. A tool call blocked at SLEEPER's own gate is **E3 for our gate and
//      still E2 for the target**. The enforcement observed is ours. Reporting a
//      single merged class would let our own control point's enforcement read as
//      the target's.
//   2. **Nothing this project produces reaches E4 or E5.** E4 (persistence and
//      replay resistance) and E5 (isolation and security boundary) require
//      evidence a local-first browser lab against a mock tool router cannot
//      produce. That is an invariant with a test, not a comment.
//
// The scope field follows ORPHEUS's `scope: 'detection_and_pii_only'` precedent:
// an agent-mode CONTROL_HELD covers tool authorization, a single-turn one does
// not, and the contract has to say which.
//
// The execution chain is shaped to AIUC-1 E015 (log AI system activity), whose
// optional controls cover retaining agent provenance, tool-call parameters and
// results, authorization and approval events, and reasoning traces where they
// exist. Requirement IDs and short names are cited; the control text is
// paraphrased. Read from the 2026-07-15 release.
//
// Output is evidence supporting control review and framework relevance. It is
// not an audit determination, not a certification decision, and does not
// establish whether any legal or regulatory obligation was met.
//
// Pure and deterministic: no I/O, no clock, no randomness. A caller that wants a
// timestamp passes one in.

import { CONTROL_VERDICTS, VERDICT_CONTROLS } from './computeVerdict.js';

export const CONTRACT_VERSION = '1.0.0';

/** The release of AIUC-1 these citations were read from. Carried on every
 *  contract as a standard-currency note, per the plan's §"Standard-currency
 *  notes on crosswalks". */
export const AIUC1_RELEASE_READ = '2026-07-15';

export const EVIDENCE_CLASSES = {
  E1: 'observation',
  E2: 'runtime characterization',
  E3: 'enforcement',
  E4: 'persistence and replay resistance',
  E5: 'isolation and security boundary',
};

/** Classes this project can produce. */
export const CLAIMABLE_EVIDENCE_CLASSES = ['E1', 'E2', 'E3'];

/** Classes this project can never produce, at any run mode, under any profile. */
export const UNREACHABLE_EVIDENCE_CLASSES = ['E4', 'E5'];

export const EVIDENCE_CLASS_CEILING = 'E3';

export const INDEPENDENCE_LEVELS = {
  I0: 'self-authored oracle',
  I1: 'independently reimplemented oracle',
  I2: 'independent sensor the target does not control',
};

export const ORACLE_INDEPENDENCE = {
  self_authored: 'I0',
  independently_reimplemented: 'I1',
  independent_sensor: 'I2',
};

export const EVIDENCE_STATUSES = ['mapped', 'executed', 'independently_reviewed', 'certified'];

/** The run modes in the plan's normative class-assignment table. */
export const RUN_MODES = {
  MOCK_TOOL_HARNESS: 'mock_tool_harness',
  LIVE_API_SINGLE_TURN: 'live_api_single_turn',
  FRAMEWORK_CROSSWALK: 'framework_crosswalk',
};

export const CONTRACT_MODES = {
  AGENT: 'agent',
  SINGLE_TURN: 'single_turn',
  MAPPING: 'mapping',
};

/** Which verdict vocabulary the finding is written in. The report labels this so
 *  the control vocabulary is never read as the single-turn probe vocabulary. */
export const VERDICT_VOCABULARIES = {
  agent: 'control',
  single_turn: 'probe',
  mapping: 'none',
};

const DEFAULT_MODE_FOR_RUN_MODE = {
  [RUN_MODES.MOCK_TOOL_HARNESS]: CONTRACT_MODES.AGENT,
  [RUN_MODES.LIVE_API_SINGLE_TURN]: CONTRACT_MODES.SINGLE_TURN,
  [RUN_MODES.FRAMEWORK_CROSSWALK]: CONTRACT_MODES.MAPPING,
};

/** Short scope names, in the order a scope summary renders them. */
const SCOPE_NAMES = {
  tool_authorization: 'tool_authorization',
  adversarial_detection: 'detection',
  pii_leakage_guard: 'pii',
};
const SCOPE_ORDER = ['tool_authorization', 'adversarial_detection', 'pii_leakage_guard'];

export const CLAIM_BOUNDARY =
  'Evidence supporting control review and framework relevance. This record describes control traceability and potential control weakness for the run it documents. It is not an audit determination, not a certification decision, and does not establish whether any legal or regulatory obligation was met.';

export const SIMULATION_BOUNDARY =
  'Tool effects in this run were simulated. Nothing was sent, written, or fetched, and a simulated effect must not be presented as a real one.';

/**
 * @param {string} evidenceClass
 * @returns {boolean} whether the class is one this project can claim.
 */
export function isWithinEvidenceCeiling(evidenceClass) {
  return CLAIMABLE_EVIDENCE_CLASSES.includes(evidenceClass);
}

/**
 * The E4/E5 invariant, enforced rather than documented. Every class this module
 * emits passes through here, so a future run-mode row cannot raise the ceiling
 * without tripping it.
 *
 * @throws {Error} if the class is not one this project can claim.
 */
export function assertClaimableEvidenceClass(evidenceClass) {
  if (!isWithinEvidenceCeiling(evidenceClass)) {
    throw new Error(
      `Evidence class ${evidenceClass} is above the ceiling ${EVIDENCE_CLASS_CEILING}: SLEEPER produces no persistence, replay-resistance, or isolation evidence.`
    );
  }
  return evidenceClass;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return isRecord(value) ? [value] : [];
}

/**
 * Was a proposed tool call denied at SLEEPER's own authorization gate?
 *
 * Read from both sides of the harness: the gate's own decision records, and the
 * router results, whose `status: 'denied'` and `authorization.tool_blocked`
 * mirror the decision the gate handed them.
 */
function gateBlockedSomething(authorizationDecisions, toolResults) {
  const fromDecisions = authorizationDecisions.some(decision => decision?.tool_blocked === true);
  // Deliberately NOT `result?.status === 'denied'`: the mock router denies by
  // default when no authorization decision was ever supplied for a call
  // (see mockToolRouter.js's routeMockToolCall), and that default-deny result
  // carries the identical `status: 'denied'` a real gate denial does, but
  // `result.authorization` is null in that case rather than a real decision
  // record. Checking status alone would award E3 enforcement evidence for a
  // call the gate was never actually asked to authorize.
  const fromResults = toolResults.some(result => result?.authorization?.tool_blocked === true);
  return fromDecisions || fromResults;
}

/**
 * Assign evidence classes per the normative table in docs/agent-module-plan.md
 * §"Evidence class taxonomy (adopt)".
 *
 * | Run mode                                        | Class                                    |
 * |-------------------------------------------------|------------------------------------------|
 * | Mock-tool harness against fixtures              | E2 for the target                        |
 * | Mock-tool harness, call blocked at our gate     | E3 for *our gate*, still E2 for target   |
 * | Live API target, single turn                    | E2                                       |
 * | Framework crosswalk rows                        | E1, status mapped                        |
 *
 * @returns {{target: object, control_point: object|null, max_class_claimed: string,
 *   ceiling: string, classes_not_reachable: string[], ceiling_rationale: string}}
 */
export function deriveEvidenceClass({
  runMode,
  authorizationDecisions = [],
  toolResults = [],
  contentOrigins = [],
} = {}) {
  if (runMode === RUN_MODES.FRAMEWORK_CROSSWALK) {
    return finalizeClasses({
      target: {
        class: 'E1',
        class_name: EVIDENCE_CLASSES.E1,
        subject: 'framework_mapping',
        rationale:
          'A crosswalk row asserts a relationship between control frameworks. It observes no run, so it is E1 material no matter how many requirements it covers.',
      },
      controlPoint: null,
    });
  }

  if (runMode === RUN_MODES.LIVE_API_SINGLE_TURN) {
    return finalizeClasses({
      target: {
        class: 'E2',
        class_name: EVIDENCE_CLASSES.E2,
        subject: 'target_model',
        rationale:
          'A real response from the target was observed and characterized. No control point was under test in a single turn, so nothing here is enforcement evidence.',
      },
      controlPoint: null,
    });
  }

  // Mock-tool harness.
  const fixtureBacked = contentOrigins.includes('scenario');
  const originNote = describeContentOrigins(contentOrigins);
  const target = {
    class: 'E2',
    class_name: EVIDENCE_CLASSES.E2,
    subject: 'target_model',
    rationale:
      `The target's behavior under simulated tool effects was characterized${
        fixtureBacked ? ' against scenario-supplied content' : ''
      }. Nothing about the target's own controls was enforced or observed enforcing.${originNote}`,
  };

  if (!gateBlockedSomething(authorizationDecisions, toolResults)) {
    return finalizeClasses({ target, controlPoint: null });
  }

  return finalizeClasses({
    target,
    controlPoint: {
      class: 'E3',
      class_name: EVIDENCE_CLASSES.E3,
      subject: 'sleeper_tool_authorization_gate',
      rationale:
        "A proposed tool call was denied at SLEEPER's own authorization gate, which is enforcement evidence for that gate. The control point sits in this harness, not in the target, so the target's class stays E2.",
    },
  });
}

function describeContentOrigins(contentOrigins) {
  const unique = [...new Set(contentOrigins.filter(Boolean))].sort();
  if (unique.length === 0) return '';
  return ` Tool result content origins in this run: ${unique.join(', ')}.`;
}

function finalizeClasses({ target, controlPoint }) {
  // Invariant, not a comment: no path through this module may emit E4 or E5.
  const claimed = [target.class, controlPoint?.class].filter(Boolean);
  claimed.forEach(assertClaimableEvidenceClass);
  const maxClass = claimed.sort().at(-1) ?? 'E1';
  return {
    target,
    control_point: controlPoint,
    max_class_claimed: maxClass,
    ceiling: EVIDENCE_CLASS_CEILING,
    classes_not_reachable: [...UNREACHABLE_EVIDENCE_CLASSES],
    ceiling_rationale:
      'E4 (persistence and replay resistance) and E5 (isolation and security boundary) are outside what a local-first browser lab running simulated tool effects can evidence. No SLEEPER output reaches them.',
  };
}

/**
 * Record who produced the oracle. Every control function in this harness is
 * written by this project and reads records this project also emits, so the
 * default is I0 and a caller has to say otherwise explicitly.
 */
export function deriveIndependence(oracle = 'self_authored') {
  const level = ORACLE_INDEPENDENCE[oracle] ?? 'I0';
  const rationale = {
    I0: 'The controls, their records, and the verdict function are all authored by this project. Nothing here is an independent check on our own implementation.',
    I1: "The oracle was reimplemented independently of the implementation under test, but still runs inside this project's harness.",
    I2: 'The oracle is a sensor outside the target\'s control.',
  }[level];
  return { level, level_name: INDEPENDENCE_LEVELS[level], oracle, rationale };
}

/**
 * Status is orthogonal to class. `certified` and `independently_reviewed` are
 * not states this project can assert about itself, so a request for either is
 * recorded and downgraded unless the caller supplies the external artifact that
 * would substantiate it.
 */
export function deriveStatus({ runMode, requestedStatus = null, attestation = null } = {}) {
  const baseline = runMode === RUN_MODES.FRAMEWORK_CROSSWALK ? 'mapped' : 'executed';
  if (!requestedStatus || requestedStatus === baseline) {
    return { status: baseline, requested: requestedStatus, downgraded: false, note: null };
  }
  if (!EVIDENCE_STATUSES.includes(requestedStatus)) {
    return {
      status: baseline,
      requested: requestedStatus,
      downgraded: true,
      note: `'${requestedStatus}' is not a recorded evidence status. Recorded as '${baseline}'.`,
    };
  }
  const needsExternalArtifact = requestedStatus === 'independently_reviewed' || requestedStatus === 'certified';
  if (needsExternalArtifact && !isRecord(attestation)) {
    return {
      status: baseline,
      requested: requestedStatus,
      downgraded: true,
      note: `Status '${requestedStatus}' requires an external artifact recorded on the contract. None was supplied, so this record stays '${baseline}'. This project cannot assert that status about its own output.`,
    };
  }
  return { status: requestedStatus, requested: requestedStatus, downgraded: false, note: null };
}

/**
 * What the contract's verdict covers, and what it does not.
 *
 * A single-turn contract can never cover tool authorization: there is no tool
 * call in a single turn. An agent-mode contract covers exactly the controls the
 * run actually exercised.
 */
export function deriveScope({ mode, verdict = null } = {}) {
  if (mode === CONTRACT_MODES.MAPPING) {
    return {
      mode,
      vocabulary: VERDICT_VOCABULARIES[mode],
      covers: [],
      does_not_cover: SCOPE_ORDER.map(name => SCOPE_NAMES[name]),
      summary: 'no_control_scope',
      note: 'A crosswalk row maps requirements. It exercises no control and covers no run.',
    };
  }

  const exercised = Array.isArray(verdict?.scope?.controls_exercised)
    ? verdict.scope.controls_exercised
    : [];

  const eligible =
    mode === CONTRACT_MODES.SINGLE_TURN
      ? SCOPE_ORDER.filter(name => name !== 'tool_authorization')
      : SCOPE_ORDER;

  const covers = eligible.filter(name => exercised.includes(name)).map(name => SCOPE_NAMES[name]);
  const doesNotCover = SCOPE_ORDER.filter(name => !eligible.includes(name) || !exercised.includes(name)).map(
    name => SCOPE_NAMES[name]
  );

  return {
    mode,
    vocabulary: VERDICT_VOCABULARIES[mode],
    covers,
    does_not_cover: doesNotCover,
    summary: summarizeScope(covers),
    note:
      mode === CONTRACT_MODES.SINGLE_TURN
        ? 'A single-turn finding cannot cover tool authorization: no tool call is made, so that control is never exercised.'
        : 'Covers only the controls this run actually exercised. An unexercised control is not covered by this verdict.',
  };
}

function summarizeScope(covers) {
  if (covers.length === 0) return 'no_control_scope';
  return `${covers.join('_and_')}_only`;
}

/**
 * The execution chain, shaped to AIUC-1 E015. `runActivityLogging` already emits
 * fields named for these, so the retention picture is read from its record
 * rather than assumed; the chain content is read from the router results and the
 * gate decisions.
 */
export function buildExecutionChain({
  loggingResult = null,
  toolCalls = [],
  toolResults = [],
  authorizationDecisions = [],
} = {}) {
  const logged = isRecord(loggingResult) ? loggingResult : null;
  const retained = {
    prompt: logged?.prompt_preserved === true,
    response: logged?.response_preserved === true,
    provenance: logged?.provenance_preserved === true,
    tool_call_parameters: logged?.tool_parameters_preserved === true,
    tool_call_results: logged?.tool_trace_preserved === true,
    authorization_events: logged?.authorization_decision_logged === true,
    approval_events: logged?.authorization_decision_logged === true,
    reasoning_traces: logged?.reasoning_trace_preserved === true,
  };
  const gaps = Object.entries(retained)
    .filter(([, kept]) => !kept)
    .map(([field]) => field);

  const callsById = new Map();
  for (const call of toolCalls) {
    if (!isRecord(call)) continue;
    callsById.set(call.id ?? call.tool ?? null, call);
  }

  const chainCalls = toolResults.map(result => {
    const call = callsById.get(result?.call_id ?? result?.tool_name ?? null) ?? null;
    return {
      call_id: result?.call_id ?? null,
      tool_name: result?.tool_name ?? null,
      tool_risk: result?.tool_risk ?? null,
      tool_known: result?.tool_known ?? null,
      status: result?.status ?? null,
      parameters: call ? (call.args ?? {}) : null,
      parameters_available: Boolean(call),
      result_metadata: isRecord(result?.metadata) ? result.metadata : {},
      provenance: isRecord(result?.provenance) ? result.provenance : null,
      instruction_source: result?.provenance?.instruction_source ?? call?.instructionSource ?? null,
      instruction_source_trusted: result?.provenance?.trusted === true,
      content_origin: result?.provenance?.content_origin ?? null,
      authorization: isRecord(result?.authorization) ? result.authorization : null,
      simulated_only: result?.simulated_only === true,
    };
  });

  // The gate's own record carries no tool name — the tool is identified by the
  // call it ruled on — so the name is taken from the paired result where there
  // is one, and left null rather than guessed where there is not.
  const decisionToolNames = toolResults.map(result => result?.tool_name ?? null);
  const authorizationEvents = authorizationDecisions.filter(isRecord).map((decision, index) => ({
    tool_name: decision.tool_name ?? decisionToolNames[index] ?? null,
    authorization_required: decision.authorization_required === true,
    gate_enforcing: decision.gate_enforcing === true,
    tool_blocked: decision.tool_blocked === true,
    tool_block_reason: decision.tool_block_reason ?? null,
    instruction_source: decision.instruction_source ?? null,
    untrusted_source: decision.untrusted_source === true,
  }));

  const approvalEvents = authorizationDecisions.filter(isRecord).map(decision => ({
    authorization_required: decision.authorization_required === true,
    approval_granted: decision.approval_granted === true,
  }));

  return {
    aiuc1_requirement: 'E015',
    aiuc1_release_read: AIUC1_RELEASE_READ,
    retained,
    complete: gaps.length === 0,
    gaps,
    events_seen: logged?.events_seen ?? 0,
    events_retained: logged?.events_retained ?? 0,
    entries: Array.isArray(logged?.log_entries) ? logged.log_entries : [],
    tool_calls: chainCalls,
    authorization_events: authorizationEvents,
    approval_events: approvalEvents,
    reasoning_traces_available: retained.reasoning_traces,
  };
}

function normalizeFrameworkReferences(references) {
  return references.filter(isRecord).map(reference => ({
    framework: reference.framework ?? null,
    id: reference.id ?? null,
    // Every mapping in this project is inferred unless the source itself asserts
    // the relationship. Defaulting the other way would blur that line.
    relationship: reference.relationship === 'direct' ? 'direct' : 'inferred',
    ...(reference.framework === 'aiuc_1' ? { release_read: AIUC1_RELEASE_READ } : {}),
  }));
}

/**
 * Build the Evidence Contract for a run or a mapping row.
 *
 * @param {object} input
 * @param {string} input.runMode  one of `RUN_MODES`.
 * @param {string} [input.mode]   `agent` | `single_turn` | `mapping`; defaults from runMode.
 * @param {object} [input.verdict]  result of `computeVerdict`, for agent runs.
 * @param {Array}  [input.toolCalls]  normalized `{ id, tool, args, instructionSource }` calls.
 * @param {Array}  [input.toolResults]  results from `routeMockToolCall`.
 * @param {Array|object} [input.authorizationDecisions]  records from `runToolAuthorizationGate`.
 * @param {object} [input.loggingResult]  record from `runActivityLogging`.
 * @param {object} [input.detectionResult]
 * @param {object} [input.piiResult]
 * @param {object} [input.profile]  control profile the run used.
 * @param {string} [input.caseId]
 * @param {string} [input.targetLabel]
 * @param {string} [input.oracle]  `self_authored` | `independently_reimplemented` | `independent_sensor`.
 * @param {string} [input.requestedStatus]
 * @param {object} [input.attestation]  external artifact backing a non-default status.
 * @param {Array}  [input.frameworkReferences]  `{ framework, id, relationship }`.
 * @param {string[]} [input.degradations]  recorded rather than hidden, e.g. the
 *   local-model JSON tool-call fallback.
 * @returns {object} a flat, serializable contract.
 */
export function buildEvidenceContract({
  runMode,
  mode = null,
  verdict = null,
  toolCalls = [],
  toolResults = [],
  authorizationDecisions = [],
  loggingResult = null,
  detectionResult = null,
  piiResult = null,
  profile = null,
  caseId = null,
  targetLabel = null,
  oracle = 'self_authored',
  requestedStatus = null,
  attestation = null,
  frameworkReferences = [],
  degradations = [],
} = {}) {
  if (!Object.values(RUN_MODES).includes(runMode)) {
    throw new Error(
      `Unknown run mode '${runMode}'. Expected one of: ${Object.values(RUN_MODES).join(', ')}.`
    );
  }

  const contractMode = Object.values(CONTRACT_MODES).includes(mode)
    ? mode
    : DEFAULT_MODE_FOR_RUN_MODE[runMode];

  const results = asArray(toolResults);
  const decisions = asArray(authorizationDecisions);
  const calls = asArray(toolCalls);
  const contentOrigins = results.map(result => result?.provenance?.content_origin).filter(Boolean);

  const evidenceClass = deriveEvidenceClass({
    runMode,
    authorizationDecisions: decisions,
    toolResults: results,
    contentOrigins,
  });
  const independence = deriveIndependence(oracle);
  const status = deriveStatus({ runMode, requestedStatus, attestation });
  const scope = deriveScope({ mode: contractMode, verdict });
  const executionChain = buildExecutionChain({
    loggingResult,
    toolCalls: calls,
    toolResults: results,
    authorizationDecisions: decisions,
  });

  // A mock-tool run is simulated by construction. The router says so on every
  // result it produces, and the contract carries the stronger of the two claims.
  const simulatedOnly =
    runMode === RUN_MODES.MOCK_TOOL_HARNESS || results.some(result => result?.simulated_only === true);

  const limitations = [
    ...(verdict?.evidence_limitations ?? []),
    ...(status.note ? [status.note] : []),
    ...(simulatedOnly ? [SIMULATION_BOUNDARY] : []),
    ...(independence.level === 'I0'
      ? ['Oracle independence I0: the controls and the verdict function are authored by this project.']
      : []),
    ...(executionChain.complete
      ? []
      : [`Execution chain incomplete (AIUC-1 E015). Not retained: ${executionChain.gaps.join(', ')}.`]),
    ...degradations,
  ];

  return {
    contract_version: CONTRACT_VERSION,
    case_id: caseId,
    profile_id: profile?.id ?? verdict?.scope?.profile_id ?? null,
    target: targetLabel,
    run_mode: runMode,
    mode: contractMode,

    verdict: verdict?.verdict ?? (contractMode === CONTRACT_MODES.MAPPING ? null : CONTROL_VERDICTS.INCONCLUSIVE),
    reason: verdict?.reason ?? null,
    control_outcomes: verdict?.outcomes ?? null,
    controls_exercised: verdict?.scope?.controls_exercised ?? [],
    controls_unexercised: verdict?.scope?.controls_unexercised ?? [...VERDICT_CONTROLS],

    evidence: {
      ...evidenceClass,
      independence,
      status: status.status,
      status_requested: status.requested,
      status_downgraded: status.downgraded,
    },
    scope,
    simulated_only: simulatedOnly,
    simulation_note: simulatedOnly ? SIMULATION_BOUNDARY : null,

    execution_chain: executionChain,
    control_records: {
      adversarial_detection: detectionResult,
      pii_leakage_guard: piiResult,
      activity_logging: loggingResult,
      tool_authorization: decisions,
    },

    framework_references: normalizeFrameworkReferences(asArray(frameworkReferences)),
    standard_currency: {
      aiuc_1: {
        release_read: AIUC1_RELEASE_READ,
        note: 'AIUC-1 publishes on a quarterly cadence. Requirement IDs and short names are cited; control text is paraphrased.',
      },
    },

    limitations,
    claim_boundary: CLAIM_BOUNDARY,
    attestation: isRecord(attestation) ? attestation : null,
  };
}
