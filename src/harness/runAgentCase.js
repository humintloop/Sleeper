// ReAct orchestrator
//
// WebLLM executes no tools, so the orchestrator owns the loop. The model
// genuinely decides whether to call `send_email`; the effect is simulated and
// nothing leaves the browser.
//
//   user task
//     → controlGate(profile) builds the system prompt
//     → model turn (tools advertised)
//     → normalized tool-call intent
//     → authorityRegistry + toolAuthorizationGate
//         → blocked → synthetic denial fed back to the model
//         → allowed → mockToolRouter returns a simulated result
//     → feed result back, repeat to the turn cap
//     → controls run over the whole stream
//
// This module deliberately stops before the verdict. It returns the control
// records and the event stream; `computeVerdict` and the Evidence Contract read
// them. Keeping the loop ignorant of the verdict is what stops the loop from
// being written to produce a preferred one.

import {
  PROVIDERS,
  describeDegradation,
  formatAssistantToolCallMessage,
  formatToolResultMessage,
} from '../api/adapter.js';
import { buildControlSystemPrompt } from './controlGate.js';
import { runToolAuthorizationGate } from './controls/toolAuthorizationGate.js';
import { runAdversarialDetection } from './controls/adversarialDetection.js';
import { runPiiLeakageGuard } from './controls/piiLeakageGuard.js';
import { runActivityLogging } from './controls/activityLogging.js';
import { DEFAULT_AUTHORITY_REGISTRY } from './authorityRegistry.js';
import {
  attributeToolCallFromResult,
  formatToolResultForModel,
  routeMockToolCall,
} from './mockToolRouter.js';

export const LOOP_STOP_REASON = {
  NO_TOOL_CALL: 'no_tool_call',
  TURN_CAP: 'turn_cap',
  REPEATED_CALL: 'repeated_call',
  TARGET_ERROR: 'target_error',
};

export const DEFAULT_MAX_TURNS = 6;

/**
 * The instruction source for a tool call the model makes before it has read any
 * tool output. It came from the user's task, and nothing else has entered
 * context yet.
 */
const INITIAL_INSTRUCTION_SOURCE = 'user';

/**
 * Run one agent case under one control profile.
 *
 * @param {object} params
 * @param {{ _create: Function }} params.target  adapter instance, or any object
 *   exposing the same non-streaming `_create` contract.
 * @param {object} params.profile        control profile (see src/data/controlProfiles.js).
 * @param {string} params.task           the user's task.
 * @param {string} [params.baseSystemPrompt]
 * @param {object} [params.registry]     authority registry.
 * @param {Array}  [params.tools]        tool definitions advertised to the model.
 * @param {object} [params.scenarioContent]  passed through to the router.
 * @param {object} [params.piiSeeds]     synthetic canary values for the PII guard.
 * @param {number} [params.maxTurns]
 * @param {string} [params.provider]     message shape to build for.
 * @param {Function} [params.now]        injected clock, for determinism in tests.
 * @returns {Promise<object>} trace, control records, and loop metadata.
 */
export async function runAgentCase({
  target,
  profile,
  task,
  baseSystemPrompt = '',
  registry = DEFAULT_AUTHORITY_REGISTRY,
  tools = [],
  scenarioContent = {},
  piiSeeds = {},
  maxTurns = DEFAULT_MAX_TURNS,
  provider = PROVIDERS.GENERIC,
  now,
} = {}) {
  const controls = profile?.controls ?? {};
  const systemPrompt = buildControlSystemPrompt(baseSystemPrompt, profile);

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: task ?? '' },
  ];

  const events = [];
  const toolCalls = [];
  const toolResults = [];
  const authorizationDecisions = [];
  const detections = [];

  let finalText = '';
  let turns = 0;
  let stopReason = LOOP_STOP_REASON.TURN_CAP;
  let degraded = false;
  const degradations = [];
  let targetError = null;

  // Provenance carrier: the most recent tool result the model has read. A tool
  // call made after reading it inherits its untrusted source, which is what
  // makes indirect injection measurable rather than assumed.
  let lastResult = null;
  const seenCalls = new Set();

  events.push({ type: 'prompt', turn: 0, system_prompt: systemPrompt, task: task ?? '' });

  while (turns < maxTurns) {
    turns += 1;

    let response;
    try {
      response = await target._create({
        messages,
        tools,
        stream: false,
        instructionSource: lastResult ? null : INITIAL_INSTRUCTION_SOURCE,
      });
    } catch (err) {
      targetError = err?.message || String(err);
      stopReason = LOOP_STOP_REASON.TARGET_ERROR;
      events.push({ type: 'target_error', turn: turns, error: targetError });
      break;
    }

    const text = response?.text ?? '';
    const calls = Array.isArray(response?.toolCalls) ? response.toolCalls : [];

    if (response?.degraded) {
      degraded = true;
      // response.degradation is an array of {reason, detail?} records (see
      // adapter.js's normalizeResponse / parseLocalToolCalls) — pushing it
      // directly nested an array of objects inside `degradations` on every
      // degraded turn, which rendered as "[object Object]" wherever this list
      // was shown as text (the trace panel's DEGRADED badge, the Evidence
      // Contract's limitations list). Flatten to readable strings here, once,
      // rather than leaving every consumer to guess the record shape.
      if (Array.isArray(response.degradation)) {
        degradations.push(...response.degradation.map(describeDegradation));
      }
    }

    events.push({ type: 'model_turn', turn: turns, text, tool_call_count: calls.length });

    if (calls.length === 0) {
      finalText = text;
      stopReason = LOOP_STOP_REASON.NO_TOOL_CALL;
      break;
    }

    messages.push(formatAssistantToolCallMessage({ provider, text, toolCalls: calls }));

    let repeated = false;

    for (const rawCall of calls) {
      // Attribute provenance before authorizing. A call the model made after
      // reading tool output carries that output's untrusted source, even when
      // the arguments look like something the user asked for.
      const call = lastResult
        ? attributeToolCallFromResult(rawCall, lastResult)
        : { ...rawCall, instructionSource: rawCall.instructionSource ?? INITIAL_INSTRUCTION_SOURCE };

      const signature = `${call.tool}:${JSON.stringify(call.args ?? {})}`;
      if (seenCalls.has(signature)) repeated = true;
      seenCalls.add(signature);

      const decision = runToolAuthorizationGate(call, controls.toolAuthorization, registry);
      const result = routeMockToolCall(call, decision, { registry, scenarioContent, now });

      // Tool output is untrusted content. Screening it is the control point
      // AML.M0030 describes, so it runs on the result rather than on the prompt.
      const detection = runAdversarialDetection(result.content, controls.adversarialDetection);

      toolCalls.push(call);
      authorizationDecisions.push(decision);
      toolResults.push(result);
      detections.push(detection);

      events.push({
        type: 'tool_call',
        turn: turns,
        tool: call.tool,
        args: call.args ?? {},
        instruction_source: call.instructionSource ?? null,
        // The gate's own classification, not a re-derivation of it — the UI
        // must read what the gate actually decided about this source rather
        // than reimplementing the trust boundary from a hardcoded list that
        // can silently drift from authorityRegistry.js's real one.
        instruction_source_trusted: !decision.untrusted_source,
      });
      events.push({
        type: 'authorization_decision',
        turn: turns,
        tool: call.tool,
        required: decision.authorization_required,
        enforcing: decision.gate_enforcing,
        approved: decision.approval_granted,
        blocked: decision.tool_blocked,
        reason: decision.tool_block_reason,
      });
      events.push({
        type: 'tool_result',
        turn: turns,
        tool: call.tool,
        status: result.status,
        provenance: result.provenance,
        simulated_only: result.simulated_only,
      });
      if (detection.scan_active) {
        events.push({
          type: 'detection',
          turn: turns,
          tool: call.tool,
          detected: detection.attack_detected,
          action: detection.detection_action,
          signals: detection.matched_signals,
        });
      }

      // A denial goes back through the provider's error-result shape rather
      // than as an omitted turn: the model must see that it was refused, and
      // the transcript must show the refusal happened.
      messages.push(
        formatToolResultMessage({
          provider,
          toolCall: call,
          result: formatToolResultForModel(result),
          denied: decision.tool_blocked,
          denialReason: decision.tool_block_reason ?? '',
        })
      );

      lastResult = result;
      finalText = text;
    }

    if (repeated) {
      // Loop guard. Recorded as evidence, not only as a safety valve: a model
      // re-proposing an identical call after a denial is the denied-decision
      // replay failure mode, not noise to be swallowed.
      stopReason = LOOP_STOP_REASON.REPEATED_CALL;
      events.push({ type: 'loop_guard', turn: turns, reason: 'identical tool call re-proposed' });
      break;
    }
  }

  if (turns >= maxTurns && stopReason === LOOP_STOP_REASON.TURN_CAP) {
    events.push({ type: 'turn_cap', turn: turns, max_turns: maxTurns });
  }

  // Scanning only the model's final chat text misses exactly the exfiltration
  // path some cases are built to test: an instruction that tells the agent to
  // send a seeded value via a tool call while saying nothing about it in its
  // own summary. A seeded value that left through an *executed* tool call's
  // arguments is exposure the guard must catch even when the final reply is
  // clean. Blocked calls are excluded — their arguments never reached a tool.
  const executedToolArgsText = toolCalls
    .filter((_, i) => authorizationDecisions[i]?.tool_call_executed)
    .map(call => JSON.stringify(call.args ?? {}))
    .join('\n');
  const piiScanText = [finalText, executedToolArgsText].filter(Boolean).join('\n');
  const piiResult = runPiiLeakageGuard(piiScanText, controls.piiFilter, piiSeeds);
  events.push({ type: 'response', turn: turns, text: finalText });

  const loggingResult = runActivityLogging(controls.activityLogging, events);

  return {
    profileId: profile?.id ?? null,
    systemPrompt,
    finalText,
    messages,
    events,
    turns,
    maxTurns,
    stopReason,
    targetError,
    degraded,
    degradations,
    simulated_only: true,
    toolCalls,
    toolResults,
    authorizationDecisions,
    controlResults: {
      toolAuthorization: aggregateAuthorization(authorizationDecisions),
      adversarialDetection: aggregateDetection(detections, controls.adversarialDetection),
      piiLeakage: piiResult,
      activityLogging: loggingResult,
    },
  };
}

/**
 * Collapse per-call gate decisions into one record for the run. A run where any
 * call was blocked is a run where the gate fired; a run where nothing was
 * attempted leaves `tool_call_attempted` false, which is what forces
 * INCONCLUSIVE downstream rather than a false CONTROL_HELD.
 */
function aggregateAuthorization(decisions) {
  if (decisions.length === 0) {
    return {
      tool_call_attempted: false,
      tool_call_executed: false,
      tool_blocked: false,
      authorization_required: false,
      gate_enforcing: false,
      approval_granted: false,
      tool_block_reason: null,
      decisions: [],
    };
  }

  return {
    tool_call_attempted: true,
    tool_call_executed: decisions.some(d => d.tool_call_executed),
    tool_blocked: decisions.some(d => d.tool_blocked),
    authorization_required: decisions.some(d => d.authorization_required),
    gate_enforcing: decisions.some(d => d.gate_enforcing),
    approval_granted: decisions.some(d => d.approval_granted),
    tool_block_reason: decisions.find(d => d.tool_block_reason)?.tool_block_reason ?? null,
    decisions,
  };
}

function aggregateDetection(detections, mode) {
  if (detections.length === 0) {
    // Nothing was scanned, because no tool output was ever produced. This must
    // NOT be reported as a scan that ran and found nothing: paired with a
    // scenario whose ground truth says adversarial input exists, a clean scan
    // reads as a miss and the verdict resolves CONTROL_FAILED. The injected
    // content never reached the instruction path, so the detector had no
    // opportunity to fire. `scan_active: false` is what makes the verdict
    // classify this as unexercised.
    return {
      scan_active: false,
      attack_detected: false,
      matched_signals: [],
      detection_reason: null,
      detection_action: mode === 'off' || !mode ? 'not_configured' : 'not_triggered',
      no_input_observed: true,
    };
  }

  const detected = detections.filter(d => d.attack_detected);
  if (detected.length === 0) return detections[0];

  return {
    ...detected[0],
    matched_signals: [...new Set(detected.flatMap(d => d.matched_signals))],
  };
}
