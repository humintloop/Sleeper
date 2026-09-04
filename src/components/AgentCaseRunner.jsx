// The actual agent module screen: pick a case, pick a control profile, point
// it at a target — live API or a local WebLLM model — run the ReAct loop, and
// see the trace, verdict, and Evidence Contract. This is the piece that was
// missing entirely — everything in src/harness/ (weeks 2-5) had no UI surface
// until this file.
//
// Three target types:
//   - Sample replay: deterministic scripted tool intent. It needs no key and
//     proves only how this harness handles the path, never model behavior.
//   - Live API (Anthropic first, per CLAUDE.md): APITargetAdapter, real
//     provider tool-calling.
//   - Local model: WebLLMLocalTarget wraps an MLCEngine instance this screen
//     loads itself (a separate download from the single-turn flow's model —
//     see src/data/victimModels.js for the shared catalog). Small local
//     models do not call tools reliably, so every local run is `degraded:
//     true` by construction; that is surfaced on the trace panel, never
//     hidden.
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, RefreshCw } from 'lucide-react';
import { AGENT_CASES, AGENT_CASE_ORDER } from '../data/agentCases';
import { CONTROL_PROFILES } from '../data/controlProfiles';
import { VICTIM_MODELS } from '../data/victimModels';
import {
  buildAdvertisedTools,
  buildCaseRegistry,
  createComparisonIdentity,
  runAgentAssessment,
  runRepeatedAssessment,
} from '../harness/runAgentAssessment';
import { DEFAULT_MAX_TURNS } from '../harness/runAgentCase';
import {
  configurationDigest,
  createRunConfiguration,
  deriveAssessmentState,
  diffRunConfigurations,
} from '../harness/runConfiguration';
import { ensureCrossOriginIsolation } from '../coiBootstrap';
import { WebLLMLocalTarget } from '../harness/webllmLocalTarget';
import { PortfolioReplayTarget } from '../harness/replayTarget';
import { WebLLMSecondaryJudge } from '../harness/secondaryJudge';
import { RUN_MODES } from '../harness/evidenceContract';
import { APITargetAdapter, PROVIDERS } from '../api/adapter';
import { clearAgentRuns, deleteCapturedRun, loadAgentRuns, loadCapturedRuns, saveAgentRun, verifyEvidenceChain } from '../storage';
import ControlProfileSelector from './ControlProfileSelector';
import AgenticTracePanel from './AgenticTracePanel';
import ControlResultsPanel from './ControlResultsPanel';
import EvidenceContractPanel from './EvidenceContractPanel';
import FrameworkCrosswalkPanel from './FrameworkCrosswalkPanel';
import ComparisonStoryPanel from './ComparisonStoryPanel';
import RunContextSummary from './RunContextSummary';
import InvestigationWorkspace from './InvestigationWorkspace';
import ReportPanel from './ReportPanel';
import RunHistory from './RunHistory';
import CapturedRunsList, { SaveCaptureButton } from './CapturedRuns';
import SleeperBrand from './SleeperBrand';

const PROVIDER_DEFAULTS = {
  [PROVIDERS.ANTHROPIC]: { endpoint: 'https://api.anthropic.com/v1/messages', modelId: 'claude-sonnet-5' },
  [PROVIDERS.OPENAI]: { endpoint: 'https://api.openai.com/v1/chat/completions', modelId: 'gpt-4o' },
};

const RUN_PROFILE_IDS = ['baseline', 'partial', 'reference'];
const DISPLAY_PROFILES = Object.fromEntries(RUN_PROFILE_IDS.map(id => [id, CONTROL_PROFILES[id]]));
const TARGET_TYPES = { SAMPLE: 'sample', LIVE: 'live', LOCAL: 'local' };
const TARGET_LABELS = { sample: 'Sample Replay', live: 'Live API', local: 'Local model' };

// A configuration section is not a card.
//
// This screen stacks six consecutive setup sections. Boxing each one in an
// identical 1px border gave the reader six equal-weight objects and therefore
// no hierarchy at all — and because the case, profile and target pickers are
// themselves grids of bordered buttons, every one of those boxes was a card
// inside a card. `section` is now a hairline rule and breathing room: the
// label carries the boundary, not a frame.
//
// `card` is the old boxed treatment, kept for the things that genuinely are
// raised objects on the page — status callouts, a returned result, a history
// row — where a border means "this is a discrete thing" rather than merely
// "this is a region".
function section(C) {
  return { borderTop: `1px solid ${C.border}`, paddingTop: 14 };
}

function card(C) {
  return { background: C.panel, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: '16px 18px' };
}

function fieldLabel(C) {
  return { fontSize: C.size.micro, color: C.text3, letterSpacing: 1.2, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 };
}

function input(C) {
  return {
    width: '100%', background: C.surface, border: `1px solid ${C.borderHi}`, color: C.text1,
    fontSize: C.size.small, padding: '8px 10px', borderRadius: 2, fontFamily: C.sans,
  };
}

// Turns a runAgentCase onProgress event into the one line a reader needs to
// believe a live or local run is actually moving, not stuck. Before this,
// "Turn N" only ever appeared after the run finished, in the trace — the
// entire wait was silent.
const PROGRESS_PHASE_LABEL = {
  awaiting_model: 'waiting for a model response',
  tool_calls_proposed: count => `model proposed ${count} tool call${count === 1 ? '' : 's'}, evaluating`,
  final_response: 'model responded, finishing up',
};

function turnProgressText(progress) {
  if (!progress) return null;
  const phase = PROGRESS_PHASE_LABEL[progress.phase];
  const detail = typeof phase === 'function' ? phase(progress.toolCallCount ?? 0) : phase;
  if (!detail) return null;
  const trialPrefix = progress.trialCount > 1 ? `Trial ${progress.trial} of ${progress.trialCount} — ` : '';
  return `${trialPrefix}Turn ${progress.turn} of ${progress.maxTurns} — ${detail}`;
}

function toggleBtn(C, active) {
  return {
    padding: '7px 14px', fontSize: C.size.small, fontWeight: 800, letterSpacing: .5, cursor: 'pointer', borderRadius: 2,
    background: active ? C.brassBg : 'transparent',
    border: `1px solid ${active ? C.brass : C.borderHi}`,
    color: active ? C.brass : C.text2,
  };
}

/**
 * `handoff` is a completed run from one of the scene walkthroughs — case 1's
 * SceneWalkthrough, or either MCP scene. When one arrives the runner opens on
 * it — that exact result object, not a fresh run that resembles it — with
 * setup collapsed and the form already matching the configuration that
 * produced it, so the visitor lands on CURRENT rather than being told their
 * own run is stale.
 *
 * Which case and profile is read from the handoff's own recorded
 * configuration (`outcome.configuration.case_id`/`profile_id`) rather than a
 * hardcoded constant — this is what lets the same runner open correctly no
 * matter which scene produced the handoff. Each scene's own data module
 * (storyScene.js, mcpDescriptorScene.js, mcpMarketplaceScene.js) still owns
 * keeping its run arguments identical to what this component defaults to,
 * so the configuration digest matches either way.
 */
// Which cases have a dramatized scene, and what the link says. Case 2's is
// the approval queue rather than a copy of the other three's "here's the
// poisoned document" shape — nothing in it is an injection, so its scene
// dramatizes the one HITL variant (decision-context stripping) that a real
// fixture carries both sides of, not the other three variants. Deliberately
// data-driven so this component doesn't grow a case-specific branch per scene.
const SCENE_ENTRY_LABEL = {
  'NR-AGT-001': 'Watch this attack — the inbox',
  'NR-AGT-002': 'Watch this attack — the approval queue',
  'NR-AGT-003A': 'Watch this attack — the tool registry',
  'NR-AGT-003B': 'Watch this attack — the marketplace listing',
};

export default function AgentCaseRunner({ C, onHome, handoff = null, onWatchScene = null }) {
  const [caseId, setCaseId] = useState(handoff?.configuration?.case_id ?? AGENT_CASE_ORDER[0]);
  const [profileId, setProfileId] = useState(handoff?.configuration?.profile_id ?? 'reference');
  // A handoff that ran a specific variant (case 2's approval-queue scene does)
  // has to land on that same variant, or the runner defaults to the case's
  // first-listed variant and the configuration digest mismatches on arrival —
  // the same STALE-on-landing bug case_id/profile_id above already avoid.
  const [variantId, setVariantId] = useState(handoff?.configuration?.variant_id ?? null);

  const [targetType, setTargetType] = useState(TARGET_TYPES.SAMPLE);

  // Setup collapses once a run has produced something to look at. The screen
  // is a form until you press Run and a result after — leaving six sections of
  // configuration sitting above the answer means the answer opens below the
  // fold, which on a projector means it is not on screen at all.
  const [setupOpen, setSetupOpen] = useState(!handoff);

  // Live target state.
  const [provider, setProvider] = useState(PROVIDERS.ANTHROPIC);
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState(PROVIDER_DEFAULTS[PROVIDERS.ANTHROPIC].modelId);

  // Local target state — this screen owns its own engine, a separate
  // download from whatever the single-turn flow may have already loaded.
  const engineRef = useRef(null);
  const [localModelId, setLocalModelId] = useState(VICTIM_MODELS.find(m => m.quickStart)?.id || VICTIM_MODELS[0].id);
  const [localStatus, setLocalStatus] = useState('idle'); // idle | loading | ready | error
  const [localProgress, setLocalProgress] = useState('');
  // coiBootstrap runs fire-and-forget at module load, before this component
  // exists; read whatever it already published, and let RETRY re-invoke it
  // directly rather than asking the user to guess whether reloading helps.
  const [coiStatus, setCoiStatus] = useState(() => (typeof window !== 'undefined' ? window.__sleeperCoiStatus : null));
  const [coiRetrying, setCoiRetrying] = useState(false);
  const retryCrossOriginIsolation = async () => {
    setCoiRetrying(true);
    try {
      setCoiStatus(await ensureCrossOriginIsolation());
    } finally {
      setCoiRetrying(false);
    }
  };

  // Optional semantic triangulation. This is intentionally a separate engine
  // and model selection from the target, and never raises oracle independence.
  const judgeEngineRef = useRef(null);
  const [judgeEnabled, setJudgeEnabled] = useState(false);
  const [judgeModelId, setJudgeModelId] = useState(VICTIM_MODELS[2]?.id || VICTIM_MODELS[1]?.id || VICTIM_MODELS[0].id);
  const [judgeStatus, setJudgeStatus] = useState('idle');
  const [judgeProgress, setJudgeProgress] = useState('');

  const [result, setResult] = useState(handoff ?? null); // { run, verdict, contract }
  const [comparison, setComparison] = useState(
    handoff ? { [handoff.configuration.profile_id]: handoff.verdict?.verdict } : {},
  ); // { [profileId]: verdictString }
  const [comparisonResults, setComparisonResults] = useState(
    handoff ? { [handoff.configuration.profile_id]: handoff } : {},
  ); // { [profileId]: full assessment }
  const [comparisonProgress, setComparisonProgress] = useState(null);
  // Turn-by-turn progress within whichever runOnce() call is currently in
  // flight. Without this, a multi-turn live-API run is one opaque `await` —
  // a spinning icon and a single static "Assessment is running." message for
  // however long several sequential network calls take, which reads as
  // hung even when it is working.
  const [turnProgress, setTurnProgress] = useState(null);
  const [trialCount, setTrialCount] = useState(3);
  const [trialSummary, setTrialSummary] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const resultsRef = useRef(null);
  const caseSectionRef = useRef(null);
  const profileSectionRef = useRef(null);
  const targetSectionRef = useRef(null);

  // Runs previously lived only in this component's state — navigate away and
  // the run was gone with no warning. Persisted separately from the
  // single-turn findings store (see storage.js) since the two use different
  // verdict vocabularies and record shapes.
  const [history, setHistory] = useState(() => loadAgentRuns());
  const [chainStatus, setChainStatus] = useState(null);

  // Verified captures: completed live, E3 results saved on purpose so they
  // can be replayed later without another API call. Separate list from
  // `history` above — history is every run, trimmed; captures are the small
  // subset worth keeping in full because they proved a real model did this.
  const [captures, setCaptures] = useState(() => loadCapturedRuns());

  useEffect(() => {
    let active = true;
    verifyEvidenceChain(history).then(status => {
      if (active) setChainStatus(status);
    });
    return () => { active = false; };
  }, [history]);

  const agentCase = AGENT_CASES[caseId];
  const selectedVariantId = agentCase?.variants?.length > 0
    ? (variantId ?? agentCase.variants[0].id)
    : null;

  const loadLocalModel = async () => {
    setLocalStatus('loading');
    setError(null);
    try {
      if (!engineRef.current) {
        const { MLCEngine } = await import('@mlc-ai/web-llm');
        engineRef.current = new MLCEngine();
      }
      await engineRef.current.reload(localModelId, { initProgressCallback: p => setLocalProgress(p.text) });
      setLocalStatus('ready');
    } catch (err) {
      setLocalStatus('error');
      setError(err?.message || String(err));
    }
  };

  const loadJudgeModel = async () => {
    setJudgeStatus('loading');
    setError(null);
    try {
      if (!judgeEngineRef.current) {
        const { MLCEngine } = await import('@mlc-ai/web-llm');
        judgeEngineRef.current = new MLCEngine();
      }
      await judgeEngineRef.current.reload(judgeModelId, { initProgressCallback: p => setJudgeProgress(p.text) });
      setJudgeStatus('ready');
    } catch (err) {
      setJudgeStatus('error');
      setError(err?.message || String(err));
    }
  };

  const buildSecondaryJudge = () => judgeEnabled && judgeStatus === 'ready'
    ? new WebLLMSecondaryJudge({ engine: judgeEngineRef.current, modelId: judgeModelId })
    : null;

  const buildTarget = () => {
    if (targetType === TARGET_TYPES.SAMPLE) {
      return new PortfolioReplayTarget({
        agentCase,
        variant: agentCase?.variants?.find(item => item.id === selectedVariantId) ?? null,
      });
    }
    if (targetType === TARGET_TYPES.LOCAL) {
      return new WebLLMLocalTarget({ engine: engineRef.current });
    }
    const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS[PROVIDERS.ANTHROPIC];
    return new APITargetAdapter({ endpoint: defaults.endpoint, apiKey: apiKey.trim(), modelId: modelId.trim() || defaults.modelId });
  };

  const targetReady = targetType === TARGET_TYPES.SAMPLE
    ? true
    : targetType === TARGET_TYPES.LOCAL ? localStatus === 'ready' : Boolean(apiKey.trim());
  const targetLabel = targetType === TARGET_TYPES.SAMPLE
    ? `deterministic-replay:${caseId}`
    : targetType === TARGET_TYPES.LOCAL
      ? `webllm-local:${localModelId}`
      : `${provider}:${modelId.trim() || PROVIDER_DEFAULTS[provider].modelId}`;
  const targetProvider = targetType === TARGET_TYPES.LIVE ? provider : PROVIDERS.GENERIC;
  const targetRunMode = targetType === TARGET_TYPES.SAMPLE
    ? RUN_MODES.DETERMINISTIC_REPLAY
    : RUN_MODES.MOCK_TOOL_HARNESS;
  const coiReason = {
    unsupported: 'service workers are unavailable in this browser (private/incognito mode is a common cause).',
    insecure_context: 'this page was not loaded as a secure (HTTPS) context.',
    registration_failed: `the isolation worker failed to register${coiStatus?.error ? `: ${coiStatus.error}` : '.'}`,
    reload_completed_still_not_isolated: 'an automatic reload already tried to fix this and did not — a browser extension or policy is likely blocking service workers.',
  }[coiStatus?.status] ?? null;
  const localCompatibilityIssues = [
    typeof navigator !== 'undefined' && !('gpu' in navigator) && 'WebGPU is unavailable in this browser.',
    typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated
      && `Cross-origin isolation is inactive${coiReason ? ` — ${coiReason}` : '.'}`,
  ].filter(Boolean);

  const providerModel = targetType === TARGET_TYPES.LIVE
    ? (modelId.trim() || PROVIDER_DEFAULTS[provider].modelId)
    : null;
  const configurationForProfile = targetProfileId => createRunConfiguration({
    agentCase,
    variant: agentCase?.variants?.find(item => item.id === selectedVariantId) ?? null,
    profile: CONTROL_PROFILES[targetProfileId],
    targetType,
    provider: targetProvider,
    providerModel,
    localModel: targetType === TARGET_TYPES.LOCAL ? localModelId : null,
    targetLabel,
    maxTurns: DEFAULT_MAX_TURNS,
    judgeEnabled,
    judgeModel: judgeEnabled ? judgeModelId : null,
    secondaryOracle: judgeEnabled
      ? { kind: 'local_model_secondary_oracle', model_id: judgeModelId }
      : null,
    runMode: targetRunMode,
    trialCount,
    advertisedTools: buildAdvertisedTools(agentCase, buildCaseRegistry(agentCase)),
  });
  const currentConfiguration = configurationForProfile(profileId);
  const currentConfigurationKey = JSON.stringify(currentConfiguration);
  const [currentConfigurationDigest, setCurrentConfigurationDigest] = useState(null);
  useEffect(() => {
    let active = true;
    configurationDigest(JSON.parse(currentConfigurationKey)).then(digest => {
      if (active) setCurrentConfigurationDigest(digest);
    });
    return () => { active = false; };
  }, [currentConfigurationKey]);
  const assessmentState = deriveAssessmentState({ currentConfiguration, result, running, error });
  const staleComparisonMembers = Object.entries(comparisonResults).flatMap(([id, outcome]) => {
    const changes = diffRunConfigurations(outcome.configuration, configurationForProfile(id));
    return changes.length > 0 ? [{ profileId: id, changes }] : [];
  });

  const runOnce = async (targetProfileId) => {
    if (!targetReady) {
      setError(targetType === TARGET_TYPES.LOCAL
        ? 'Load a local model before running a case.'
        : 'An API key is required. It is held in memory for this session only and never stored.');
      return null;
    }
    if (judgeEnabled && judgeStatus !== 'ready') {
      setError('Load the secondary judge model, or disable secondary judging, before running.');
      return null;
    }
    if (judgeEnabled && targetType === TARGET_TYPES.LOCAL && judgeModelId === localModelId) {
      setError('Choose a judge model different from the local target model to reduce correlated failures.');
      return null;
    }
    setRunning(true);
    setError(null);
    setTurnProgress(null);
    try {
      return await runAgentAssessment({
        agentCase: caseId,
        profile: targetProfileId,
        target: buildTarget(),
        provider: targetProvider,
        targetLabel,
        variant: selectedVariantId,
        runMode: targetRunMode,
        secondaryJudge: buildSecondaryJudge(),
        targetType,
        providerModel,
        localModel: targetType === TARGET_TYPES.LOCAL ? localModelId : null,
        trialCount,
        onProgress: setTurnProgress,
      });
    } catch (err) {
      setError(err?.message || String(err));
      return null;
    } finally {
      setRunning(false);
      setTurnProgress(null);
    }
  };

  // Trimmed to case/profile metadata, the verdict, and the contract — not the
  // full event stream/messages, which are large and only useful for the run
  // that is currently on screen, not for a history list.
  const persistRun = async (outcome, targetProfileId, batchId = null) => {
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      // Which comparison pass wrote this record. Three profiles written in one
      // pass share a batch id so the history can show them as the single
      // comparison they were, instead of three near-identical rows. Records
      // written before this existed have no batch id and stand alone.
      batchId,
      timestamp: new Date().toISOString(),
      caseId,
      caseTitle: agentCase?.title ?? caseId,
      profileId: targetProfileId,
      profileLabel: CONTROL_PROFILES[targetProfileId]?.label ?? targetProfileId,
      verdict: outcome.verdict.verdict,
      reasonText: outcome.verdict.reason?.text ?? null,
      targetLabel: outcome.contract?.target ?? null,
      degraded: Boolean(outcome.run?.degraded),
      configuration: outcome.configuration,
      configurationDigest: outcome.configurationDigest,
      manifestDigest: outcome.manifestDigest,
      contract: outcome.contract,
    };
    setHistory(await saveAgentRun(record));
  };

  const handleRun = async () => {
    const outcome = await runOnce(profileId);
    if (!outcome) return;
    setResult(outcome);
    setSetupOpen(false);
    setComparison(prev => ({ ...prev, [profileId]: outcome.verdict.verdict }));
    setComparisonResults(prev => ({ ...prev, [profileId]: outcome }));
    await persistRun(outcome, profileId);
    window.requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  };

  const handleComparative = async () => {
    const next = {};
    const nextResults = {};
    const batchId = `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let last = null;
    setComparisonProgress({ current: RUN_PROFILE_IDS[0], completed: 0, total: RUN_PROFILE_IDS.length });
    for (const [index, id] of RUN_PROFILE_IDS.entries()) {
      setComparisonProgress({ current: id, completed: index, total: RUN_PROFILE_IDS.length });
      const outcome = await runOnce(id);
      if (!outcome) {
        setComparisonProgress(null);
        return;
      }
      next[id] = outcome.verdict.verdict;
      nextResults[id] = outcome;
      await persistRun(outcome, id, batchId);
      if (id === profileId) last = outcome;
    }
    setComparison(next);
    const identity = createComparisonIdentity(Object.entries(nextResults).map(([id, outcome]) => ({
      ...outcome,
      profileId: id,
    })));
    Object.values(nextResults).forEach(outcome => { outcome.comparisonIdentity = identity; });
    setComparisonResults(nextResults);
    setComparisonProgress(null);
    setSetupOpen(false);
    if (last) setResult(last);
    window.requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  };

  const handleRepeated = async () => {
    if (!targetReady) {
      setError(targetType === TARGET_TYPES.LOCAL
        ? 'Load a local model before running trials.'
        : 'An API key is required. It is held in memory for this session only and never stored.');
      return;
    }
    if (judgeEnabled && judgeStatus !== 'ready') {
      setError('Load the secondary judge model, or disable secondary judging, before running trials.');
      return;
    }
    if (judgeEnabled && targetType === TARGET_TYPES.LOCAL && judgeModelId === localModelId) {
      setError('Choose a judge model different from the local target model to reduce correlated failures.');
      return;
    }
    setRunning(true);
    setError(null);
    setTurnProgress(null);
    // Trials run sequentially inside runRepeatedAssessment and each one
    // resets its own turn counter to 1, so a fresh "turn 1" in the progress
    // stream is exactly the signal that a new trial has started — there is
    // no other per-trial hook to count from.
    let trialNumber = 0;
    try {
      const repeated = await runRepeatedAssessment({
        trialCount,
        agentCase: caseId,
        profile: profileId,
        variant: selectedVariantId,
        targetFactory: () => buildTarget(),
        provider: targetProvider,
        targetLabel,
        runMode: targetRunMode,
        secondaryJudge: buildSecondaryJudge(),
        targetType,
        providerModel,
        localModel: targetType === TARGET_TYPES.LOCAL ? localModelId : null,
        onProgress: progress => {
          if (progress.turn === 1) trialNumber += 1;
          setTurnProgress({ ...progress, trial: trialNumber, trialCount });
        },
      });
      for (const outcome of repeated.trials) await persistRun(outcome, profileId);
      setTrialSummary(repeated);
      setResult(repeated.trials.at(-1));
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setRunning(false);
      setTurnProgress(null);
    }
  };

  const hasResults = Boolean(result || Object.keys(comparisonResults).length > 0);

  return (
    <div className="agent-runner" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 60px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div className="lab-masthead">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
          <SleeperBrand compact style={{ width: 205, maxWidth: '48vw' }} />
          <span className="brand-kicker lab-masthead-tagline" style={{ color: C.text3 }}>Evidence workspace</span>
        </div>
        <button onClick={onHome} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: C.text3, fontSize: C.size.small, cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={14} /> HOME
        </button>
      </div>

      <div className="runner-intro">
        <div style={{ fontSize: C.size.micro, color: C.text3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
          Agent threat case &middot; controlled harness run
        </div>
        <h1 className="display-type" style={{ fontSize: 46, color: C.text1, fontWeight: 820, letterSpacing: '-0.025em', margin: 0, textTransform: 'uppercase' }}>Run agent case</h1>
        {!hasResults && (
          <p style={{ fontSize: C.size.small, color: C.text3, lineHeight: 1.6, maxWidth: 720, marginTop: 10 }}>
            Nothing on this screen leaves the browser or acts on anything: a tool call is intent, and every
            tool effect is simulated. Live and local targets record what a model actually decided. Sample
            Replay follows a disclosed script — it demonstrates the harness and claims nothing about a model.
          </p>
        )}
      </div>

      <div className={`runner-jump${hasResults ? ' runner-jump--compact' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <span style={{ fontSize: C.size.micro, color: C.text3, letterSpacing: .2, marginRight: 4 }}>Jump to</span>
        {[
          { label: 'Case', done: Boolean(caseId), ref: caseSectionRef, opensSetup: true },
          { label: 'Profile', done: Boolean(profileId), ref: profileSectionRef, opensSetup: true },
          { label: 'Target', done: targetReady, ref: targetSectionRef, opensSetup: true },
          { label: 'Run', done: Boolean(result), ref: resultsRef },
        ].map(step => (
          <button
            key={step.label}
            onClick={() => {
              if (step.opensSetup) setSetupOpen(true);
              window.requestAnimationFrame(() => step.ref.current?.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                block: 'start',
              }));
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: 999,
              background: step.done ? C.brass : C.borderHi,
              boxShadow: 'none',
            }} />
            <span style={{ fontSize: C.size.micro, letterSpacing: .2, fontWeight: step.done ? 800 : 500, color: step.done ? C.brass : C.text3 }}>
              {step.label}
            </span>
          </button>
        ))}
      </div>

      {setupOpen ? (
        <>
        <div ref={caseSectionRef} style={section(C)}>
          <div style={fieldLabel(C)}>Case</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {AGENT_CASE_ORDER.map(id => {
              const c = AGENT_CASES[id];
              const active = id === caseId;
              return (
                <button key={id} aria-pressed={active} disabled={running} onClick={() => {
                  setCaseId(id);
                  setVariantId(AGENT_CASES[id]?.variants?.[0]?.id ?? null);
                }} style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 2, cursor: 'pointer',
                  background: active ? C.surface : C.panel,
                  border: `1px solid ${active ? C.brass : C.borderHi}`,
                  borderLeft: `3px solid ${active ? C.brass : C.borderHi}`,
                }}>
                  <div style={{ fontFamily: C.mono, fontSize: C.size.micro, color: active ? C.brass : C.text3, marginBottom: 3 }}>{id}</div>
                  <div style={{ fontSize: C.size.small, color: C.text1, fontWeight: 600 }}>{c.title}</div>
                </button>
              );
            })}
          </div>
          {agentCase && (
            <p style={{ fontSize: C.size.small, color: C.text2, lineHeight: 1.6, marginTop: 12, marginBottom: 0 }}>
              {agentCase.scenario?.narrative}
            </p>
          )}
          {onWatchScene && SCENE_ENTRY_LABEL[caseId] && (
            <button
              onClick={() => onWatchScene(caseId)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, padding: 0,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: C.brass, fontSize: C.size.small, fontWeight: 700,
              }}
            >
              {SCENE_ENTRY_LABEL[caseId]} <ChevronRight size={13} />
            </button>
          )}
          {agentCase?.variants?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...fieldLabel(C), marginBottom: 7 }}>Executable approval variant</div>
              <div style={{ display: 'grid', gap: 7, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
                {agentCase.variants.map(variant => {
                  const active = selectedVariantId === variant.id;
                  return (
                    <button key={variant.id} aria-pressed={active} disabled={running} onClick={() => setVariantId(variant.id)} style={{
                      textAlign: 'left', padding: '9px 10px', cursor: 'pointer', borderRadius: 2,
                      background: active ? C.surface : 'transparent',
                      border: `1px solid ${active ? C.brass : C.borderHi}`,
                      color: C.text1,
                    }}>
                      <div style={{ fontSize: C.size.micro, color: active ? C.brass : C.text3, fontFamily: C.mono }}>{variant.id}</div>
                      <div style={{ fontSize: C.size.small, fontWeight: 700, marginTop: 2 }}>{variant.title}</div>
                      <div style={{ fontSize: C.size.micro, lineHeight: 1.45, color: C.text3, marginTop: 4 }}>{variant.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div ref={profileSectionRef} style={section(C)}>
          <div style={fieldLabel(C)}>Control profile</div>
          <ControlProfileSelector C={C} profiles={DISPLAY_PROFILES} selectedId={profileId} onSelect={setProfileId} disabled={running} />
          <div style={{ color: C.text3, fontSize: C.size.micro, lineHeight: 1.5, marginTop: 10 }}>
            Run &amp; compare runs all three profiles; this selection decides which one opens in the trace, evidence, and report. Run selected profile runs only this one.
          </div>
        </div>

        <details style={section(C)}>
          <summary style={{ cursor: 'pointer', color: C.text2, fontSize: C.size.small, fontWeight: 800, letterSpacing: .2 }}>
            Framework mapping <span style={{ color: C.text3, fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>— review references and relationship strength</span>
          </summary>
          <div style={{ marginTop: 14 }}>
            <FrameworkCrosswalkPanel C={C} agentCase={agentCase} />
          </div>
        </details>

        <div ref={targetSectionRef} style={section(C)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ ...fieldLabel(C), marginBottom: 0 }}>Target</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button aria-pressed={targetType === TARGET_TYPES.SAMPLE} disabled={running} style={toggleBtn(C, targetType === TARGET_TYPES.SAMPLE)} onClick={() => setTargetType(TARGET_TYPES.SAMPLE)}>SAMPLE REPLAY</button>
              <button aria-pressed={targetType === TARGET_TYPES.LIVE} disabled={running} style={toggleBtn(C, targetType === TARGET_TYPES.LIVE)} onClick={() => setTargetType(TARGET_TYPES.LIVE)}>LIVE API</button>
              <button aria-pressed={targetType === TARGET_TYPES.LOCAL} disabled={running} style={toggleBtn(C, targetType === TARGET_TYPES.LOCAL)} onClick={() => setTargetType(TARGET_TYPES.LOCAL)}>LOCAL MODEL</button>
            </div>
          </div>

          {targetType === TARGET_TYPES.SAMPLE ? (
            <div style={{ fontSize: C.size.small, color: C.text2, lineHeight: 1.6 }}>
              No API key and no model download. A scripted tool intent runs the real pipeline — provenance,
              authorization, mock effect, trace, verdict, Evidence Contract — so you can see how the harness
              handles the path.
              <br /><br />
              No model decision is observed here, so the target is evidence class E1. An E3 claim on this run
              describes Sleeper&rsquo;s own gate, not the model.
            </div>
          ) : targetType === TARGET_TYPES.LIVE ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div>
                <label htmlFor="agent-provider" style={{ ...fieldLabel(C), marginBottom: 4, display: 'block' }}>Provider</label>
                <select
                  id="agent-provider"
                  value={provider}
                  disabled={running}
                  onChange={e => { const p = e.target.value; setProvider(p); setModelId(PROVIDER_DEFAULTS[p].modelId); }}
                  style={input(C)}
                >
                  <option value={PROVIDERS.ANTHROPIC}>Anthropic</option>
                  <option value={PROVIDERS.OPENAI}>OpenAI</option>
                </select>
              </div>
              <div>
                <label htmlFor="agent-model-id" style={{ ...fieldLabel(C), marginBottom: 4, display: 'block' }}>Model ID</label>
                <input id="agent-model-id" value={modelId} disabled={running} onChange={e => setModelId(e.target.value)} style={input(C)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="agent-api-key" style={{ ...fieldLabel(C), marginBottom: 4, display: 'block' }}>API key</label>
                <input
                  id="agent-api-key"
                  type="password"
                  value={apiKey}
                  disabled={running}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Held in memory for this session only. Never written to storage."
                  style={input(C)}
                  autoComplete="off"
                />
              </div>
            </div>
          ) : (
            <div>
              {localCompatibilityIssues.length > 0 && (
                <div role="status" style={{ fontSize: C.size.small, color: C.ochre, lineHeight: 1.55, marginBottom: 10, padding: '9px 11px', background: C.amberBg, border: `1px solid ${C.ochre}55`, borderRadius: 2 }}>
                  <div>
                    Local inference is unavailable here: {localCompatibilityIssues.join(' ')} Sample Replay and Live API remain fully available.
                  </div>
                  {typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated && (
                    <button onClick={retryCrossOriginIsolation} disabled={coiRetrying} style={{
                      marginTop: 8, padding: '5px 10px', fontSize: C.size.micro, fontWeight: 800, letterSpacing: .5,
                      background: 'transparent', border: `1px solid ${C.ochre}`, color: C.ochre, borderRadius: 2,
                      cursor: coiRetrying ? 'not-allowed' : 'pointer',
                    }}>
                      {coiRetrying ? 'CHECKING…' : 'RETRY ISOLATION CHECK'}
                    </button>
                  )}
                </div>
              )}
              <div style={{ fontSize: C.size.small, color: C.text3, lineHeight: 1.5, marginBottom: 10 }}>
                Small local models do not call tools reliably, so this path never uses real tool-calling — a
                prompted JSON schema stands in, and the loop reads the model&rsquo;s tool-call intent out of that JSON
                instead. Every run against a local model is flagged{' '}
                <span style={{ color: C.red, fontWeight: 700 }}>DEGRADED</span> below, with the reason spelled out
                on the trace, so a degraded run can never be read as a clean one. This is a separate download from
                any model already loaded elsewhere in this app.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
                <div>
                  <label htmlFor="agent-local-model" style={{ ...fieldLabel(C), marginBottom: 4, display: 'block' }}>Model</label>
                  <select id="agent-local-model" value={localModelId} onChange={e => { setLocalModelId(e.target.value); setLocalStatus('idle'); }} style={input(C)} disabled={running || localStatus === 'loading'}>
                    {VICTIM_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.quickStart ? 'Quick start — ' : ''}{m.name} ({m.size})</option>
                    ))}
                  </select>
                </div>
                <button onClick={loadLocalModel} disabled={running || localStatus === 'loading' || localStatus === 'ready' || localCompatibilityIssues.length > 0} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px',
                  background: localStatus === 'ready' ? C.greenBg : C.surface,
                  border: `1px solid ${localStatus === 'ready' ? C.green : C.borderHi}`,
                  color: localStatus === 'ready' ? C.green : C.text1,
                  fontSize: C.size.small, fontWeight: 800, letterSpacing: .5, borderRadius: 2,
                  cursor: localStatus === 'loading' || localStatus === 'ready' || localCompatibilityIssues.length > 0 ? 'not-allowed' : 'pointer',
                }}>
                  {localStatus === 'loading' && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                  {localStatus === 'ready' ? '● LOADED' : localStatus === 'loading' ? 'LOADING…' : 'LOAD MODEL'}
                </button>
              </div>
              {localStatus === 'loading' && localProgress && (
                <div style={{ fontSize: C.size.micro, color: C.text3, marginTop: 8, fontFamily: C.mono }}>{localProgress}</div>
              )}
            </div>
          )}
        </div>

        <div style={section(C)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...fieldLabel(C), marginBottom: 4 }}>Secondary local-model judge</div>
              <div style={{ fontSize: C.size.small, color: C.text3, lineHeight: 1.5, maxWidth: 660 }}>
                Optional. A second local model reads the run for goal adoption and unauthorized intent, as a
                semantic cross-check on the deterministic result. It cannot override anything the trace
                establishes, and it does not raise oracle independence above I0. Against a local target it
                must be a different model from the target itself.
              </div>
            </div>
            <button aria-pressed={judgeEnabled} disabled={running} style={toggleBtn(C, judgeEnabled)} onClick={() => setJudgeEnabled(enabled => !enabled)}>
              {judgeEnabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
          {judgeEnabled && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) auto', gap: 12, alignItems: 'end', marginTop: 12 }}>
              <div>
                <label htmlFor="secondary-judge-model" style={{ ...fieldLabel(C), marginBottom: 4, display: 'block' }}>Judge model</label>
                <select id="secondary-judge-model" value={judgeModelId} onChange={event => { setJudgeModelId(event.target.value); setJudgeStatus('idle'); }} style={input(C)} disabled={running || judgeStatus === 'loading'}>
                  {VICTIM_MODELS.map(model => <option key={model.id} value={model.id}>{model.name} ({model.size})</option>)}
                </select>
              </div>
              <button onClick={loadJudgeModel} disabled={running || judgeStatus === 'loading' || judgeStatus === 'ready'} style={{
                ...toggleBtn(C, judgeStatus === 'ready'), minWidth: 150, height: 36,
                cursor: judgeStatus === 'loading' || judgeStatus === 'ready' ? 'not-allowed' : 'pointer',
              }}>
                {judgeStatus === 'ready' ? '● JUDGE LOADED' : judgeStatus === 'loading' ? 'LOADING…' : 'LOAD JUDGE'}
              </button>
              {judgeStatus === 'loading' && judgeProgress && (
                <div style={{ gridColumn: '1 / -1', fontSize: C.size.micro, color: C.text3, fontFamily: C.mono }}>{judgeProgress}</div>
              )}
            </div>
          )}
        </div>
        </>
      ) : (
        <button
          onClick={() => setSetupOpen(true)}
          style={{
            ...section(C), width: '100%', textAlign: 'left', background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingBottom: 14,
          }}
        >
          <span style={fieldLabel(C)}>Setup</span>
          <span style={{ color: C.text2, fontSize: C.size.small }}>
            {caseId} &middot; {CONTROL_PROFILES[profileId]?.label} &middot; {TARGET_LABELS[targetType]}
          </span>
          <span style={{ marginLeft: 'auto', color: C.brass, fontSize: C.size.small, fontWeight: 700 }}>Change setup</span>
        </button>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={handleComparative} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
          background: running ? C.hover : C.signal, border: `1px solid ${C.signal}`, color: running ? C.text3 : C.ink,
          fontSize: C.size.small, fontWeight: 800, letterSpacing: .5, cursor: running ? 'not-allowed' : 'pointer', borderRadius: 2,
        }}>
          {running ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />} {running ? 'Running…' : 'Run & compare controls'}
        </button>
        <button onClick={handleRun} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
          background: 'transparent', border: `1px solid ${C.borderHi}`, color: C.text2,
          fontSize: C.size.small, fontWeight: 700, letterSpacing: .5, cursor: running ? 'not-allowed' : 'pointer', borderRadius: 2,
        }}>
          Run selected profile
        </button>
      </div>

      <div style={{ color: C.text3, fontSize: C.size.micro, lineHeight: 1.5, marginTop: -14 }}>
        Runs Baseline, Partial, and Reference, then shows the attempted tools, gate decision, and simulated effect side by side.
      </div>

      {running && (
        <div role="status" aria-live="polite" style={{ ...card(C), padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <RefreshCw size={13} color={C.brass} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
          <div style={{ color: C.text2, fontSize: C.size.small }}>
            {comparisonProgress && (
              <>Running <strong style={{ color: C.text1 }}>{DISPLAY_PROFILES[comparisonProgress.current]?.label}</strong> · {comparisonProgress.completed + 1} of {comparisonProgress.total}</>
            )}
            {comparisonProgress && turnProgress && ' · '}
            {turnProgress && turnProgressText(turnProgress)}
            {!comparisonProgress && !turnProgress && 'Starting…'}
          </div>
        </div>
      )}

      <details style={section(C)}>
        <summary style={{ cursor: 'pointer', color: C.text2, fontSize: C.size.micro, fontWeight: 800, letterSpacing: .2 }}>
          Repeat trials <span style={{ color: C.text3, fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>— check outcome variance</span>
        </summary>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.text3, fontSize: C.size.micro }}>
            TRIALS
            <input
              aria-label="Repeat trial count"
              type="number"
              min="2"
              max="10"
              value={trialCount}
              disabled={running}
              onChange={event => setTrialCount(Math.max(2, Math.min(10, Number(event.target.value) || 2)))}
              style={{ ...input(C), width: 62, padding: '7px 8px' }}
            />
          </label>
          <button onClick={handleRepeated} disabled={running} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'transparent', border: `1px solid ${C.borderHi}`, color: C.text2,
            fontSize: C.size.small, fontWeight: 700, letterSpacing: .5, cursor: running ? 'not-allowed' : 'pointer', borderRadius: 2,
          }}>
            Run repeat trials
          </button>
        </div>
      </details>

      {trialSummary && (
        <div style={{ ...card(C), fontSize: C.size.small, color: C.text2, lineHeight: 1.55 }}>
          <div style={{ ...fieldLabel(C), marginBottom: 7 }}>Repeat-trial summary</div>
          <div>{trialSummary.trial_count} independent sequential calls · controlled configuration: {trialSummary.controlled_configuration ? 'yes' : 'no'}</div>
          <div style={{ marginTop: 4, fontFamily: C.mono }}>
            {Object.entries(trialSummary.verdict_counts).map(([verdict, count]) => `${verdict}: ${count}`).join(' · ')}
          </div>
          <div style={{ marginTop: 5, color: C.text3 }}>{trialSummary.limitation}</div>
        </div>
      )}

      {error && (
        <div role="alert" aria-live="assertive" style={{ padding: '12px 14px', background: C.redBg, border: `1px solid ${C.red}55`, borderLeft: `3px solid ${C.red}`, borderRadius: 2, color: C.red, fontSize: C.size.small }}>
          {error}
        </div>
      )}

      <RunContextSummary
        C={C}
        caseTitle={agentCase?.title}
        variantTitle={agentCase?.variants?.find(item => item.id === selectedVariantId)?.title}
        profileLabel={CONTROL_PROFILES[profileId]?.label}
        configuration={currentConfiguration}
        configurationDigest={currentConfigurationDigest}
        assessmentState={assessmentState}
        onRerun={handleRun}
        running={running}
      />

      <SaveCaptureButton
        C={C}
        result={result}
        caseId={caseId}
        caseTitle={agentCase?.title ?? caseId}
        profileId={profileId}
        profileLabel={CONTROL_PROFILES[profileId]?.label ?? profileId}
        onSaved={setCaptures}
      />

      {(result || Object.keys(comparisonResults).length > 0) && (
        <div ref={resultsRef} style={{ scrollMarginTop: 18 }}>
          <InvestigationWorkspace
            C={C}
            defaultTabId="compare"
            tabs={[
              {
                id: 'compare',
                label: 'Compare',
                badge: Object.keys(comparisonResults).length || null,
                content: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {staleComparisonMembers.length > 0 && (
                      <div role="status" style={{ ...card(C), borderLeft: `3px solid ${C.ochre}`, color: C.text2, fontSize: C.size.small, lineHeight: 1.5 }}>
                        Historical comparison: {staleComparisonMembers.map(member => `${member.profileId} (${member.changes.map(change => change.path).join(', ')})`).join(' · ')}. Members retain their original completed manifest identities.
                      </div>
                    )}
                    <ComparisonStoryPanel
                      C={C}
                      results={comparisonResults}
                      profiles={DISPLAY_PROFILES}
                      selectedId={profileId}
                      onInspect={(id, outcome) => { setProfileId(id); setResult(outcome); }}
                    />
                  </div>
                ),
              },
              {
                id: 'trace',
                label: 'Trace',
                hidden: !result,
                badge: result?.run?.events?.length ?? null,
                content: <AgenticTracePanel C={C} run={result?.run} />,
              },
              {
                id: 'evidence',
                label: 'Evidence',
                hidden: !result,
                content: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                    <ControlResultsPanel C={C} verdict={result?.verdict} profiles={DISPLAY_PROFILES} comparisonHistory={Object.keys(comparisonResults).length >= 3 ? null : comparison} />
                    <EvidenceContractPanel
                      C={C}
                      contract={result?.contract}
                      historical={assessmentState.state === 'stale'}
                      historicalChanges={assessmentState.changes}
                      currentConfigurationDigest={currentConfigurationDigest}
                    />
                  </div>
                ),
              },
              {
                id: 'report',
                label: 'Report',
                hidden: !result,
                content: (
                  <ReportPanel
                    C={C}
                    agentCase={agentCase}
                    profiles={DISPLAY_PROFILES}
                    result={result}
                    comparisonResults={comparisonResults}
                    historical={assessmentState.state === 'stale'}
                    historicalChanges={assessmentState.changes}
                    comparisonHistorical={staleComparisonMembers.length > 0}
                    currentConfigurationDigest={currentConfigurationDigest}
                  />
                ),
              },
            ]}
          />
        </div>
      )}

      <CapturedRunsList
        C={C}
        captures={captures}
        cardStyle={card(C)}
        onReplay={capture => {
          setCaseId(capture.caseId);
          setProfileId(capture.profileId);
          // A captured run always came from a live target — no API key is
          // ever stored with it, but the target selector itself follows the
          // capture so the run-context strip's Live badge reflects what is
          // actually on screen, not whatever target was last selected.
          const capturedConfig = capture.outcome?.configuration;
          if (capturedConfig?.target_type === TARGET_TYPES.LIVE) {
            setTargetType(TARGET_TYPES.LIVE);
            if (capturedConfig.provider) setProvider(capturedConfig.provider);
            if (capturedConfig.provider_model) setModelId(capturedConfig.provider_model);
          }
          setResult(capture.outcome);
          setSetupOpen(false);
          window.requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
        }}
        onDelete={captureId => setCaptures(deleteCapturedRun(captureId))}
      />

      {history.length > 0 && (
        <RunHistory
          C={C}
          history={history}
          chainStatus={chainStatus}
          cardStyle={card(C)}
          onClear={() => { setHistory(clearAgentRuns()); setChainStatus(null); }}
        />
      )}
    </div>
  );
}
