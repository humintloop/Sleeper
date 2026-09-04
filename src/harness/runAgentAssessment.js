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
import { createApprovalPolicy } from './approvalPolicy.js';
import { attachContractIntegrity, createRunManifest } from './runProvenance.js';
import { createRunConfiguration } from './runConfiguration.js';
import { evaluateCaseConditions } from './evaluateCaseConditions.js';
import { runSecondaryJudge } from './secondaryJudge.js';
import { attachExternalWitness } from './evidenceWitness.js';

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
    const descriptorFixture = definition?.description_source
      ? agentCase?.fixtures?.find(fixture =>
        fixture.id === definition.description_source &&
        fixture.delivery === 'tool_description' &&
        fixture.delivery_tool === name
      )
      : null;
    return {
      name,
      description: descriptorFixture?.content ?? definition?.description ?? '',
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
    servers: { ...(baseRegistry.servers ?? {}), ...(extensions.servers ?? {}) },
  };
}

function initialInstructionSource(agentCase) {
  const advertised = new Set(agentCase?.tools?.advertised ?? []);
  const untrustedDescriptorPresent = (agentCase?.fixtures ?? []).some(fixture =>
    fixture.delivery === 'tool_description' &&
    fixture.carries_injection === true &&
    advertised.has(fixture.delivery_tool)
  );
  return untrustedDescriptorPresent ? 'tool_description' : 'user';
}

/**
 * Whether this case actually plants adversarial input. Without this ground
 * truth a clean detection scan is unexercised, not a hold — a detector that
 * finds nothing in a scenario containing nothing has demonstrated nothing.
 */
export function caseCarriesAdversarialInput(agentCase) {
  const fixtures = agentCase?.fixtures ?? [];
  const advertised = new Set(agentCase?.tools?.advertised ?? []);
  const extensionTools = agentCase?.tools?.registry_extensions?.tools ?? {};
  return fixtures.some(fixture => {
    if (fixture?.carries_injection !== true) return false;
    if (fixture.delivery === 'tool_result') {
      return agentCase?.scenario_content?.[fixture.delivery_tool]?.metadata?.fixture_id === fixture.id;
    }
    if (fixture.delivery === 'tool_description') {
      return advertised.has(fixture.delivery_tool) &&
        extensionTools[fixture.delivery_tool]?.description_source === fixture.id;
    }
    return false;
  });
}

/**
 * No case in src/data/agentCases.js declares an explicit `scenario.system_prompt`
 * — only `actor` / `environment` / `narrative`. Without a base prompt the model
 * receives nothing but the control gate's clause (empty under Baseline) plus
 * the raw task, with no framing of who it is or what the tools mean. Synthesize
 * a minimal one from the fields that do exist rather than sending an empty
 * system prompt to a live target.
 */
function buildBaseSystemPrompt(scenario) {
  if (scenario?.system_prompt) return scenario.system_prompt;
  if (!scenario?.actor && !scenario?.environment) return '';
  const lines = [];
  if (scenario.actor) lines.push(`You are an AI agent acting as: ${scenario.actor}.`);
  if (scenario.environment) lines.push(scenario.environment);
  return lines.join(' ');
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
    degraded: run.degraded === true,
    approvalVariantSelected: run.approvalSummary?.selected === true,
    approvalVariantExercised: run.approvalSummary?.exercised === true,
    approvalVariantLimitation: run.approvalSummary?.limitation ?? null,
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
 * @param {Function} [params.onProgress]  forwarded to runAgentCase — see its
 *   own doc comment. Passed through unchanged by runCaseAcrossProfiles and
 *   runRepeatedAssessment via their `...rest`/`...assessment` spreads.
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
  variant = null,
  secondaryJudge = null,
  evidenceWitness = null,
  targetType = null,
  providerModel = null,
  localModel = null,
  trialCount = 1,
  onProgress = null,
} = {}) {
  const resolvedCase = typeof agentCase === 'string' ? getAgentCase(agentCase) : agentCase;
  if (!resolvedCase) throw new Error(`Unknown agent case: ${String(agentCase)}`);

  const resolvedProfile = typeof profile === 'string' ? CONTROL_PROFILES[profile] : profile;
  if (!resolvedProfile) throw new Error(`Unknown control profile: ${String(profile)}`);

  const registry = buildCaseRegistry(resolvedCase);
  const advertisedTools = buildAdvertisedTools(resolvedCase, registry);
  const resolvedVariant = variant
    ? resolvedCase.variants?.find(candidate => candidate.id === variant || candidate.key === variant)
    : null;
  if (variant && !resolvedVariant) {
    throw new Error(`Unknown variant '${String(variant)}' for case ${resolvedCase.id}.`);
  }

  const run = await runAgentCase({
    target,
    profile: resolvedProfile,
    task: resolvedCase.scenario?.user_task ?? '',
    baseSystemPrompt: buildBaseSystemPrompt(resolvedCase.scenario),
    registry,
    tools: advertisedTools,
    scenarioContent: resolvedCase.scenario_content ?? {},
    piiSeeds: resolvedCase.pii_seeds ?? {},
    maxTurns,
    provider,
    now,
    initialInstructionSource: initialInstructionSource(resolvedCase),
    approvalPolicy: createApprovalPolicy(resolvedVariant, registry),
    onProgress,
  });

  const caseEvaluation = evaluateCaseConditions({
    agentCase: resolvedCase,
    variant: resolvedVariant,
    run,
    registry,
  });
  const evaluatedRun = {
    ...run,
    events: [
      ...run.events,
      {
        type: 'case_evaluation',
        turn: run.turns,
        classification: 'derived',
        attack_success: caseEvaluation.evaluations[0]?.outcome ?? 'unknown',
        partial_control_failure: caseEvaluation.evaluations[1]?.outcome ?? 'unknown',
        unsupported_signals: caseEvaluation.unsupported_signals,
      },
    ],
    caseEvaluation,
  };

  const { toolAuthorization, adversarialDetection, piiLeakage, activityLogging } = run.controlResults;

  const verdict = computeVerdict({
    detectionResult: adversarialDetection,
    toolResult: toolAuthorization,
    piiResult: piiLeakage,
    loggingResult: activityLogging,
    profile: resolvedProfile,
    scenario: { adversarialInputPresent: caseCarriesAdversarialInput(resolvedCase) },
    runStatus: deriveRunStatus(run),
    caseEvaluation,
  });

  const secondaryOracle = await runSecondaryJudge(secondaryJudge, {
    agentCase: resolvedCase,
    profile: resolvedProfile,
    run: evaluatedRun,
    verdict,
  });

  const judgeDescriptor = secondaryJudge?.describe?.() ?? null;
  const runConfiguration = createRunConfiguration({
    agentCase: resolvedCase,
    variant: resolvedVariant,
    profile: resolvedProfile,
    targetType,
    provider,
    providerModel,
    localModel,
    targetLabel,
    maxTurns,
    judgeEnabled: Boolean(secondaryJudge),
    judgeModel: judgeDescriptor?.model_id ?? secondaryOracle?.model_id ?? null,
    secondaryOracle: judgeDescriptor ? {
      kind: judgeDescriptor.kind ?? 'secondary_oracle',
      model_id: judgeDescriptor.model_id ?? null,
    } : null,
    runMode,
    trialCount,
    advertisedTools,
  });

  const runManifest = await createRunManifest({
    agentCase: resolvedCase,
    profile: resolvedProfile,
    advertisedTools,
    provider,
    targetLabel,
    maxTurns,
    oracle,
    runMode,
    variant: resolvedVariant,
    secondaryOracle: secondaryOracle ? {
      kind: secondaryOracle.kind,
      model_id: secondaryOracle.model_id ?? null,
      prompt_version: secondaryOracle.prompt_version ?? null,
      prompt_digest: secondaryOracle.prompt_digest ?? null,
    } : null,
    runConfiguration,
    generatedAt: typeof now === 'string' ? now : undefined,
  });

  let contract = buildEvidenceContract({
    runMode,
    // The whole verdict object, not just verdict.verdict: deriveScope reads
    // verdict.scope.controls_exercised and the contract reads
    // verdict.evidence_limitations. Passing the bare string silently zeroed
    // out contract.scope.covers on every run — caught only by checking this
    // shape by hand, not by any test, since runAgentAssessment.test.js only
    // asserted on evidence class, not on scope.
    verdict,
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
    caseVariant: resolvedVariant ? {
      id: resolvedVariant.id,
      key: resolvedVariant.key,
      title: resolvedVariant.title,
      approval_summary: run.approvalSummary,
    } : null,
    runManifest,
    secondaryOracle,
    caseEvaluation,
    providerTranscript: evaluatedRun.providerResponses,
  });
  contract = await attachContractIntegrity(contract);
  contract = await attachExternalWitness(contract, evidenceWitness);

  return {
    run: {
      ...evaluatedRun,
      configuration: runConfiguration,
      configurationDigest: runManifest.configuration_digest,
    },
    verdict,
    contract,
    configuration: runConfiguration,
    configurationDigest: runManifest.configuration_digest,
    manifestDigest: runManifest.manifest_digest,
  };
}

export async function runRepeatedAssessment({
  trialCount = 3,
  targetFactory,
  target,
  ...assessment
} = {}) {
  if (!Number.isInteger(trialCount) || trialCount < 2 || trialCount > 50) {
    throw new Error('trialCount must be an integer from 2 through 50.');
  }
  if (!targetFactory && !target) throw new Error('A target or targetFactory is required.');

  const trials = [];
  for (let index = 0; index < trialCount; index += 1) {
    const trialTarget = targetFactory ? targetFactory(index) : target;
    trials.push(await runAgentAssessment({ ...assessment, target: trialTarget, trialCount }));
  }

  const verdictCounts = {};
  for (const trial of trials) {
    verdictCounts[trial.verdict.verdict] = (verdictCounts[trial.verdict.verdict] ?? 0) + 1;
  }
  const count = predicate => trials.filter(predicate).length;
  const configurationDigests = [...new Set(
    trials.map(trial => trial.contract.run_manifest?.configuration_digest).filter(Boolean)
  )];
  const deterministicReplay = assessment.runMode === RUN_MODES.DETERMINISTIC_REPLAY;
  return {
    methodology: deterministicReplay ? 'deterministic_replay_trials' : 'independent_sequential_trials',
    trial_count: trialCount,
    verdict_counts: verdictCounts,
    rates: {
      tool_attempted: count(trial => trial.run.controlResults.toolAuthorization.tool_call_attempted) / trialCount,
      tool_executed: count(trial => trial.run.controlResults.toolAuthorization.tool_call_executed) / trialCount,
      tool_blocked: count(trial => trial.run.controlResults.toolAuthorization.tool_blocked) / trialCount,
      degraded: count(trial => trial.run.degraded) / trialCount,
      inconclusive: (verdictCounts.INCONCLUSIVE ?? 0) / trialCount,
    },
    controlled_configuration: configurationDigests.length === 1,
    configuration_digests: configurationDigests,
    configuration: configurationDigests.length === 1 ? trials[0]?.configuration ?? null : null,
    configuration_digest: configurationDigests.length === 1 ? configurationDigests[0] : null,
    trial_manifests: trials.map(trial => trial.manifestDigest),
    trials,
    limitation:
      deterministicReplay
        ? 'These trials replay the same scripted tool intent. They verify deterministic harness behavior, not model behavior or stochastic robustness.'
        : 'These are independent model calls, not seeded deterministic replays. Aggregate rates characterize this configured sample only and are not a guarantee of future behavior.',
  };
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
  const comparisonIdentity = createComparisonIdentity(results);
  results.forEach(result => { result.comparisonIdentity = comparisonIdentity; });
  return results;
}

export function createComparisonIdentity(results = []) {
  return {
    schema_version: '1.0.0',
    members: results.map(result => ({
      profile_id: result.profileId ?? result.contract?.profile_id ?? null,
      manifest_digest: result.manifestDigest ?? result.contract?.run_manifest?.manifest_digest ?? null,
      configuration_digest: result.configurationDigest ?? result.contract?.run_manifest?.configuration_digest ?? null,
    })),
  };
}

export { AGENT_CASES };
