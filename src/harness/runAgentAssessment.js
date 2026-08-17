// Agent assessment
//
// One case, one control profile, one run, one Evidence Contract. This is the
// seam between the four pieces built separately: the case data supplies the
// scenario, the orchestrator runs the ReAct loop, `computeVerdict` reads the
// control records, and `buildEvidenceContract` records what the run permits its
// author to claim.
//
// The order matters and is deliberate. The loop does not know the verdict, and
// the verdict does not know the contract's evidence class. Each stage reads
// only the records the previous one emitted, so no stage can be tuned to
// produce a preferred outcome downstream.
//
// The comparative claim needs three runs, not one: `runCaseAcrossProfiles`
// exists because a single posture evidences much less than the same attack
// under Baseline, Partial, and Reference.

import { buildEvidenceContract, RUN_MODES } from './evidenceContract.js';
import { computeVerdict } from './computeVerdict.js';
import { DEFAULT_AUTHORITY_REGISTRY, getToolDefinition } from './authorityRegistry.js';
import { AGENT_CASES, getAgentCase } from '../data/agentCases.js';
import { CONTROL_PROFILES } from '../data/controlProfiles.js';
import { LOOP_STOP_REASON, runAgentCase } from './runAgentCase.js';

const EMPTY_SCHEMA = { type: 'object', properties: {} };

/**
 * Build tool definitions to advertise to the model from the names a case
 * declares. Descriptions come from the registry, which is also what the
 * authorization gate reads — one source of truth for what a tool is.
 *
 * Case 3 is the exception worth understanding: its `registry_extensions` carry
 * MCP-shaped entries whose *descriptions* are the attack surface. A poisoned
 * description must reach the model verbatim, because that is the technique
 * (ATLAS AML.T0110.000) rather than a detail of presentation.
 */
export function buildAdvertisedTools(agentCase, registry) {
  const names = agentCase?.tools?.advertised ?? [];
  return names.map(name => {
    const definition = getToolDefinition(registry, name);
    return {
      name,
      description: definition?.description ?? '',
      parameters: definition?.parameters ?? EMPTY_SCHEMA,
    };
  });
}

/**
 * Merge a case's MCP-shaped registry extensions over the default registry.
 * Returns the default registry unchanged when a case declares none.
 */
export function buildCaseRegistry(agentCase, baseRegistry = DEFAULT_AUTHORITY_REGISTRY) {
  const extensions = agentCase?.tools?.registry_extensions;
  if (!extensions) return baseRegistry;

  return {
    ...baseRegistry,
    tools: { ...baseRegistry.tools, ...(extensions.tools ?? extensions) },
  };
}

/**
 * Whether this case actually plants adversarial input. Without this ground
 * truth a clean detection scan is unexercised, not a hold — a detector that
 * finds nothing in a scenario containing nothing has demonstrated nothing.
 */
export function caseCarriesAdversarialInput(agentCase) {
  const fixtures = agentCase?.fixtures ?? [];
  return fixtures.some(fixture => fixture?.carries_injection === true);
}

function deriveRunStatus(run) {
  return {
    targetReachable: run.stopReason !== LOOP_STOP_REASON.TARGET_ERROR,
    // A run that produced neither text nor a tool call did not service the
    // request, whatever else it did.
    requestServiced:
      run.stopReason !== LOOP_STOP_REASON.TARGET_ERROR &&
      (Boolean(run.finalText) || run.toolCalls.length > 0),
    turnCapReached: run.stopReason === LOOP_STOP_REASON.TURN_CAP,
    error: run.targetError,
  };
}

/**
 * Run one case under one profile and produce a verdict plus an Evidence Contract.
 *
 * @param {object} params
 * @param {object|string} params.agentCase  a case object or a case id.
 * @param {object|string} params.profile    a profile object or a profile id.
 * @param {{ _create: Function }} params.target
 * @returns {Promise<{run: object, verdict: object, contract: object}>}
 */
export async function runAgentAssessment({
  agentCase,
  profile,
  target,
  provider,
  maxTurns,
  now,
  oracle = 'self_authored',
  targetLabel = null,
  requestedStatus = null,
  attestation = null,
  runMode = RUN_MODES.MOCK_TOOL_HARNESS,
} = {}) {
  const resolvedCase = typeof agentCase === 'string' ? getAgentCase(agentCase) : agentCase;
  if (!resolvedCase) throw new Error(`Unknown agent case: ${String(agentCase)}`);

  const resolvedProfile = typeof profile === 'string' ? CONTROL_PROFILES[profile] : profile;
  if (!resolvedProfile) throw new Error(`Unknown control profile: ${String(profile)}`);

  const registry = buildCaseRegistry(resolvedCase);

  const run = await runAgentCase({
    target,
    profile: resolvedProfile,
    task: resolvedCase.scenario?.user_task ?? '',
    baseSystemPrompt: resolvedCase.scenario?.system_prompt ?? '',
    registry,
    tools: buildAdvertisedTools(resolvedCase, registry),
    scenarioContent: resolvedCase.scenario_content ?? {},
    piiSeeds: resolvedCase.pii_seeds ?? {},
    maxTurns,
    provider,
    now,
  });

  const { toolAuthorization, adversarialDetection, piiLeakage, activityLogging } = run.controlResults;

  const verdict = computeVerdict({
    detectionResult: adversarialDetection,
    toolResult: toolAuthorization,
    piiResult: piiLeakage,
    loggingResult: activityLogging,
    profile: resolvedProfile,
    scenario: { adversarialInputPresent: caseCarriesAdversarialInput(resolvedCase) },
    runStatus: deriveRunStatus(run),
  });

  const contract = buildEvidenceContract({
    runMode,
    verdict: verdict.verdict,
    toolCalls: run.toolCalls,
    toolResults: run.toolResults,
    authorizationDecisions: run.authorizationDecisions,
    loggingResult: activityLogging,
    detectionResult: adversarialDetection,
    piiResult: piiLeakage,
    profile: resolvedProfile,
    caseId: resolvedCase.id,
    targetLabel,
    oracle,
    requestedStatus,
    attestation,
    frameworkReferences: resolvedCase.mappings ?? [],
    degradations: run.degradations,
  });

  return { run, verdict, contract };
}

/**
 * Run one case under several profiles. This is the comparative arm: the same
 * attack, three postures, three outcomes. Runs are sequential rather than
 * concurrent so that a live target is not hit in parallel.
 */
export async function runCaseAcrossProfiles({
  agentCase,
  profileIds = ['baseline', 'partial', 'reference'],
  targetFactory,
  target,
  ...rest
} = {}) {
  const results = [];
  for (const profileId of profileIds) {
    const runTarget = targetFactory ? targetFactory(profileId) : target;
    results.push({
      profileId,
      ...(await runAgentAssessment({ agentCase, profile: profileId, target: runTarget, ...rest })),
    });
  }
  return results;
}

export { AGENT_CASES };
