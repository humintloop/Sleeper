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
import { ChevronLeft, History, Play, RefreshCw } from 'lucide-react';
import { AGENT_CASES, AGENT_CASE_ORDER } from '../data/agentCases';
import { CONTROL_PROFILES } from '../data/controlProfiles';
import { VICTIM_MODELS } from '../data/victimModels';
import { runAgentAssessment, runRepeatedAssessment } from '../harness/runAgentAssessment';
import { WebLLMLocalTarget } from '../harness/webllmLocalTarget';
import { PortfolioReplayTarget } from '../harness/replayTarget';
import { WebLLMSecondaryJudge } from '../harness/secondaryJudge';
import { RUN_MODES } from '../harness/evidenceContract';
import { APITargetAdapter, PROVIDERS } from '../api/adapter';
import { loadAgentRuns, saveAgentRun, verifyEvidenceChain } from '../storage';
import ControlProfileSelector from './ControlProfileSelector';
import AgenticTracePanel from './AgenticTracePanel';
import ControlResultsPanel from './ControlResultsPanel';
import EvidenceContractPanel from './EvidenceContractPanel';
import FrameworkCrosswalkPanel from './FrameworkCrosswalkPanel';
import ComparisonStoryPanel from './ComparisonStoryPanel';

const PROVIDER_DEFAULTS = {
  [PROVIDERS.ANTHROPIC]: { endpoint: 'https://api.anthropic.com/v1/messages', modelId: 'claude-sonnet-5' },
  [PROVIDERS.OPENAI]: { endpoint: 'https://api.openai.com/v1/chat/completions', modelId: 'gpt-4o' },
};

const RUN_PROFILE_IDS = ['baseline', 'partial', 'reference'];
const DISPLAY_PROFILES = Object.fromEntries(RUN_PROFILE_IDS.map(id => [id, CONTROL_PROFILES[id]]));
const TARGET_TYPES = { SAMPLE: 'sample', LIVE: 'live', LOCAL: 'local' };

function section(C) {
  return { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 2, padding: '16px 18px' };
}

function fieldLabel(C) {
  return { fontSize: 11, color: C.text3, letterSpacing: 1.2, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 };
}

function input(C) {
  return {
    width: '100%', background: C.surface, border: `1px solid ${C.borderHi}`, color: C.text1,
    fontSize: 13, padding: '8px 10px', borderRadius: 2, fontFamily: C.mono,
  };
}

function toggleBtn(C, active) {
  return {
    padding: '7px 14px', fontSize: 12, fontWeight: 800, letterSpacing: .5, cursor: 'pointer', borderRadius: 2,
    background: active ? C.brassBg : 'transparent',
    border: `1px solid ${active ? C.brass : C.borderHi}`,
    color: active ? C.brass : C.text2,
  };
}

export default function AgentCaseRunner({ C, onHome }) {
  const [caseId, setCaseId] = useState(AGENT_CASE_ORDER[0]);
  const [profileId, setProfileId] = useState('reference');
  const [variantId, setVariantId] = useState(null);

  const [targetType, setTargetType] = useState(TARGET_TYPES.SAMPLE);

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

  // Optional semantic triangulation. This is intentionally a separate engine
  // and model selection from the target, and never raises oracle independence.
  const judgeEngineRef = useRef(null);
  const [judgeEnabled, setJudgeEnabled] = useState(false);
  const [judgeModelId, setJudgeModelId] = useState(VICTIM_MODELS[2]?.id || VICTIM_MODELS[1]?.id || VICTIM_MODELS[0].id);
  const [judgeStatus, setJudgeStatus] = useState('idle');
  const [judgeProgress, setJudgeProgress] = useState('');

  const [result, setResult] = useState(null); // { run, verdict, contract }
  const [comparison, setComparison] = useState({}); // { [profileId]: verdictString }
  const [comparisonResults, setComparisonResults] = useState({}); // { [profileId]: full assessment }
  const [comparisonProgress, setComparisonProgress] = useState(null);
  const [trialCount, setTrialCount] = useState(3);
  const [trialSummary, setTrialSummary] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const resultsRef = useRef(null);

  // Runs previously lived only in this component's state — navigate away and
  // the run was gone with no warning. Persisted separately from the
  // single-turn findings store (see storage.js) since the two use different
  // verdict vocabularies and record shapes.
  const [history, setHistory] = useState(() => loadAgentRuns());
  const [chainStatus, setChainStatus] = useState(null);

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
  const localCompatibilityIssues = [
    typeof navigator !== 'undefined' && !('gpu' in navigator) && 'WebGPU is unavailable in this browser.',
    typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated && 'Cross-origin isolation is inactive.',
  ].filter(Boolean);

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
      });
    } catch (err) {
      setError(err?.message || String(err));
      return null;
    } finally {
      setRunning(false);
    }
  };

  // Trimmed to case/profile metadata, the verdict, and the contract — not the
  // full event stream/messages, which are large and only useful for the run
  // that is currently on screen, not for a history list.
  const persistRun = async (outcome, targetProfileId) => {
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      caseId,
      caseTitle: agentCase?.title ?? caseId,
      profileId: targetProfileId,
      profileLabel: CONTROL_PROFILES[targetProfileId]?.label ?? targetProfileId,
      verdict: outcome.verdict.verdict,
      reasonText: outcome.verdict.reason?.text ?? null,
      targetLabel: outcome.contract?.target ?? null,
      degraded: Boolean(outcome.run?.degraded),
      contract: outcome.contract,
    };
    setHistory(await saveAgentRun(record));
  };

  const handleRun = async () => {
    const outcome = await runOnce(profileId);
    if (!outcome) return;
    setResult(outcome);
    setComparison(prev => ({ ...prev, [profileId]: outcome.verdict.verdict }));
    setComparisonResults(prev => ({ ...prev, [profileId]: outcome }));
    await persistRun(outcome, profileId);
    window.requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  };

  const handleComparative = async () => {
    const next = {};
    const nextResults = {};
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
      await persistRun(outcome, id);
      if (id === profileId) last = outcome;
    }
    setComparison(next);
    setComparisonResults(nextResults);
    setComparisonProgress(null);
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
      });
      for (const outcome of repeated.trials) await persistRun(outcome, profileId);
      setTrialSummary(repeated);
      setResult(repeated.trials.at(-1));
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="agent-runner" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 60px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onHome} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: C.text3, fontSize: 12, cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={14} /> HOME
        </button>
      </div>

      <div>
        <div style={{ fontSize: 11, color: C.text3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
          Agent threat case &middot; controlled harness run
        </div>
        <h1 style={{ fontSize: 28, color: C.text1, fontWeight: 600, letterSpacing: '0.02em', margin: 0 }}>Run agent case</h1>
        <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, maxWidth: 720, marginTop: 10 }}>
          Tool-call intent, simulated tool effect — nothing this screen does leaves the browser or acts on
          anything. Live and local targets capture model decisions; Sample Replay uses a disclosed script to
          demonstrate the harness without claiming model evidence.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
        {[
          { label: 'Case', done: Boolean(caseId) },
          { label: 'Profile', done: Boolean(profileId) },
          { label: 'Target', done: targetReady },
          { label: 'Run', done: Boolean(result) },
        ].map((step, i, arr) => (
          <div key={step.label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px' }}>
              <span style={{
                width: 6, height: 6, borderRadius: 999,
                background: step.done ? C.brass : C.borderHi,
                boxShadow: step.done ? `0 0 6px ${C.brass}99` : 'none',
              }} />
              <span style={{ fontSize: 11, letterSpacing: .8, fontWeight: step.done ? 800 : 500, color: step.done ? C.brass : C.text3, textTransform: 'uppercase' }}>
                {step.label}
              </span>
            </div>
            {i < arr.length - 1 && <ChevronLeft size={11} color={C.border} style={{ transform: 'rotate(180deg)', margin: '0 2px' }} />}
          </div>
        ))}
      </div>

      <div style={section(C)}>
        <div style={fieldLabel(C)}>Case</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {AGENT_CASE_ORDER.map(id => {
            const c = AGENT_CASES[id];
            const active = id === caseId;
            return (
              <button key={id} aria-pressed={active} onClick={() => {
                setCaseId(id);
                setVariantId(AGENT_CASES[id]?.variants?.[0]?.id ?? null);
              }} style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 2, cursor: 'pointer',
                background: active ? C.surface : C.panel,
                border: `1px solid ${active ? C.brass : C.border}`,
                borderLeft: `3px solid ${active ? C.brass : C.border}`,
              }}>
                <div style={{ fontFamily: C.mono, fontSize: 11, color: active ? C.brass : C.text3, marginBottom: 3 }}>{id}</div>
                <div style={{ fontSize: 13, color: C.text1, fontWeight: 600 }}>{c.title}</div>
              </button>
            );
          })}
        </div>
        {agentCase && (
          <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6, marginTop: 12, marginBottom: 0 }}>
            {agentCase.scenario?.narrative}
          </p>
        )}
        {agentCase?.variants?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ ...fieldLabel(C), marginBottom: 7 }}>Executable approval variant</div>
            <div style={{ display: 'grid', gap: 7, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
              {agentCase.variants.map(variant => {
                const active = selectedVariantId === variant.id;
                return (
                  <button key={variant.id} aria-pressed={active} onClick={() => setVariantId(variant.id)} style={{
                    textAlign: 'left', padding: '9px 10px', cursor: 'pointer', borderRadius: 2,
                    background: active ? C.surface : 'transparent',
                    border: `1px solid ${active ? C.brass : C.border}`,
                    color: C.text1,
                  }}>
                    <div style={{ fontSize: 11, color: active ? C.brass : C.text3, fontFamily: C.mono }}>{variant.id}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2 }}>{variant.title}</div>
                    <div style={{ fontSize: 11.5, lineHeight: 1.45, color: C.text3, marginTop: 4 }}>{variant.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={section(C)}>
        <div style={fieldLabel(C)}>Control profile</div>
        <ControlProfileSelector C={C} profiles={DISPLAY_PROFILES} selectedId={profileId} onSelect={setProfileId} />
        <div style={{ color: C.text3, fontSize: 11.5, lineHeight: 1.5, marginTop: 10 }}>
          Your selection controls which profile gets the full verdict, trace, and Evidence Contract after comparison. The primary comparison still runs all three profiles.
        </div>
      </div>

      <details style={section(C)}>
        <summary style={{ cursor: 'pointer', color: C.text2, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
          Framework mapping <span style={{ color: C.text3, fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>— review references and relationship strength</span>
        </summary>
        <div style={{ marginTop: 14 }}>
          <FrameworkCrosswalkPanel C={C} agentCase={agentCase} />
        </div>
      </details>

      <div style={section(C)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ ...fieldLabel(C), marginBottom: 0 }}>Target</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button aria-pressed={targetType === TARGET_TYPES.SAMPLE} style={toggleBtn(C, targetType === TARGET_TYPES.SAMPLE)} onClick={() => setTargetType(TARGET_TYPES.SAMPLE)}>SAMPLE REPLAY</button>
            <button aria-pressed={targetType === TARGET_TYPES.LIVE} style={toggleBtn(C, targetType === TARGET_TYPES.LIVE)} onClick={() => setTargetType(TARGET_TYPES.LIVE)}>LIVE API</button>
            <button aria-pressed={targetType === TARGET_TYPES.LOCAL} style={toggleBtn(C, targetType === TARGET_TYPES.LOCAL)} onClick={() => setTargetType(TARGET_TYPES.LOCAL)}>LOCAL MODEL</button>
          </div>
        </div>

        {targetType === TARGET_TYPES.SAMPLE ? (
          <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6 }}>
            Zero-key deterministic walkthrough. Scripted tool intent exercises the real provenance, authorization,
            mock-effect, trace, verdict, and Evidence Contract pipeline. It is labeled E1 for the target because no
            model decision is observed; any E3 claim applies only to Sleeper&rsquo;s own gate.
          </div>
        ) : targetType === TARGET_TYPES.LIVE ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label htmlFor="agent-provider" style={{ ...fieldLabel(C), marginBottom: 4, display: 'block' }}>Provider</label>
              <select
                id="agent-provider"
                value={provider}
                onChange={e => { const p = e.target.value; setProvider(p); setModelId(PROVIDER_DEFAULTS[p].modelId); }}
                style={input(C)}
              >
                <option value={PROVIDERS.ANTHROPIC}>Anthropic</option>
                <option value={PROVIDERS.OPENAI}>OpenAI</option>
              </select>
            </div>
            <div>
              <label htmlFor="agent-model-id" style={{ ...fieldLabel(C), marginBottom: 4, display: 'block' }}>Model ID</label>
              <input id="agent-model-id" value={modelId} onChange={e => setModelId(e.target.value)} style={input(C)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="agent-api-key" style={{ ...fieldLabel(C), marginBottom: 4, display: 'block' }}>API key</label>
              <input
                id="agent-api-key"
                type="password"
                value={apiKey}
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
              <div role="status" style={{ fontSize: 12, color: C.ochre, lineHeight: 1.55, marginBottom: 10, padding: '9px 11px', background: C.amberBg, border: `1px solid ${C.ochre}55`, borderRadius: 2 }}>
                Local inference is unavailable here: {localCompatibilityIssues.join(' ')} Sample Replay and Live API remain fully available.
              </div>
            )}
            <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.5, marginBottom: 10 }}>
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
                <select id="agent-local-model" value={localModelId} onChange={e => { setLocalModelId(e.target.value); setLocalStatus('idle'); }} style={input(C)} disabled={localStatus === 'loading'}>
                  {VICTIM_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.quickStart ? 'Quick start — ' : ''}{m.name} ({m.size})</option>
                  ))}
                </select>
              </div>
              <button onClick={loadLocalModel} disabled={localStatus === 'loading' || localStatus === 'ready' || localCompatibilityIssues.length > 0} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px',
                background: localStatus === 'ready' ? C.greenBg : C.surface,
                border: `1px solid ${localStatus === 'ready' ? C.green : C.borderHi}`,
                color: localStatus === 'ready' ? C.green : C.text1,
                fontSize: 12, fontWeight: 800, letterSpacing: .5, borderRadius: 2,
                cursor: localStatus === 'loading' || localStatus === 'ready' || localCompatibilityIssues.length > 0 ? 'not-allowed' : 'pointer',
              }}>
                {localStatus === 'loading' && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                {localStatus === 'ready' ? '● LOADED' : localStatus === 'loading' ? 'LOADING…' : 'LOAD MODEL'}
              </button>
            </div>
            {localStatus === 'loading' && localProgress && (
              <div style={{ fontSize: 11.5, color: C.text3, marginTop: 8, fontFamily: C.mono }}>{localProgress}</div>
            )}
          </div>
        )}
      </div>

      <div style={section(C)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...fieldLabel(C), marginBottom: 4 }}>Secondary local-model judge</div>
            <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.5, maxWidth: 660 }}>
              Optional semantic triangulation of goal adoption and unauthorized intent. It cannot override deterministic
              trace facts and does not raise independence above I0. A distinct model is required for a local target.
            </div>
          </div>
          <button aria-pressed={judgeEnabled} style={toggleBtn(C, judgeEnabled)} onClick={() => setJudgeEnabled(enabled => !enabled)}>
            {judgeEnabled ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>
        {judgeEnabled && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) auto', gap: 12, alignItems: 'end', marginTop: 12 }}>
            <div>
              <label htmlFor="secondary-judge-model" style={{ ...fieldLabel(C), marginBottom: 4, display: 'block' }}>Judge model</label>
              <select id="secondary-judge-model" value={judgeModelId} onChange={event => { setJudgeModelId(event.target.value); setJudgeStatus('idle'); }} style={input(C)} disabled={judgeStatus === 'loading'}>
                {VICTIM_MODELS.map(model => <option key={model.id} value={model.id}>{model.name} ({model.size})</option>)}
              </select>
            </div>
            <button onClick={loadJudgeModel} disabled={judgeStatus === 'loading' || judgeStatus === 'ready'} style={{
              ...toggleBtn(C, judgeStatus === 'ready'), minWidth: 150, height: 36,
              cursor: judgeStatus === 'loading' || judgeStatus === 'ready' ? 'not-allowed' : 'pointer',
            }}>
              {judgeStatus === 'ready' ? '● JUDGE LOADED' : judgeStatus === 'loading' ? 'LOADING…' : 'LOAD JUDGE'}
            </button>
            {judgeStatus === 'loading' && judgeProgress && (
              <div style={{ gridColumn: '1 / -1', fontSize: 11.5, color: C.text3, fontFamily: C.mono }}>{judgeProgress}</div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={handleComparative} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
          background: running ? C.hover : C.brassBg, border: `1px solid ${C.brass}`, color: C.brass,
          fontSize: 13, fontWeight: 800, letterSpacing: .5, cursor: running ? 'not-allowed' : 'pointer', borderRadius: 2,
        }}>
          {running ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />} {running ? 'RUNNING…' : 'RUN & COMPARE CONTROLS'}
        </button>
        <button onClick={handleRun} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
          background: 'transparent', border: `1px solid ${C.borderHi}`, color: C.text2,
          fontSize: 13, fontWeight: 700, letterSpacing: .5, cursor: running ? 'not-allowed' : 'pointer', borderRadius: 2,
        }}>
          RUN SELECTED PROFILE
        </button>
      </div>

      <div style={{ color: C.text3, fontSize: 11.5, lineHeight: 1.5, marginTop: -14 }}>
        Runs Baseline, Partial, and Reference, then shows the attempted tools, gate decision, and simulated effect side by side.
      </div>

      {comparisonProgress && (
        <div role="status" aria-live="polite" style={{ ...section(C), padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <RefreshCw size={13} color={C.brass} style={{ animation: 'spin 1s linear infinite' }} />
          <div style={{ color: C.text2, fontSize: 12 }}>
            Running <strong style={{ color: C.text1 }}>{DISPLAY_PROFILES[comparisonProgress.current]?.label}</strong> · {comparisonProgress.completed + 1} of {comparisonProgress.total}
          </div>
        </div>
      )}

      <details style={{ ...section(C), padding: '12px 14px' }}>
        <summary style={{ cursor: 'pointer', color: C.text2, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
          Repeat trials <span style={{ color: C.text3, fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>— check outcome variance</span>
        </summary>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.text3, fontSize: 11 }}>
            TRIALS
            <input
              aria-label="Repeat trial count"
              type="number"
              min="2"
              max="10"
              value={trialCount}
              onChange={event => setTrialCount(Math.max(2, Math.min(10, Number(event.target.value) || 2)))}
              style={{ ...input(C), width: 62, padding: '7px 8px' }}
            />
          </label>
          <button onClick={handleRepeated} disabled={running} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'transparent', border: `1px solid ${C.borderHi}`, color: C.text2,
            fontSize: 12, fontWeight: 700, letterSpacing: .5, cursor: running ? 'not-allowed' : 'pointer', borderRadius: 2,
          }}>
            RUN REPEAT TRIALS
          </button>
        </div>
      </details>

      {trialSummary && (
        <div style={{ ...section(C), fontSize: 12, color: C.text2, lineHeight: 1.55 }}>
          <div style={{ ...fieldLabel(C), marginBottom: 7 }}>Repeat-trial summary</div>
          <div>{trialSummary.trial_count} independent sequential calls · controlled configuration: {trialSummary.controlled_configuration ? 'yes' : 'no'}</div>
          <div style={{ marginTop: 4, fontFamily: C.mono }}>
            {Object.entries(trialSummary.verdict_counts).map(([verdict, count]) => `${verdict}: ${count}`).join(' · ')}
          </div>
          <div style={{ marginTop: 5, color: C.text3 }}>{trialSummary.limitation}</div>
        </div>
      )}

      {error && (
        <div role="alert" aria-live="assertive" style={{ padding: '12px 14px', background: C.redBg, border: `1px solid ${C.red}55`, borderLeft: `3px solid ${C.red}`, borderRadius: 2, color: C.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      {(result || Object.keys(comparisonResults).length > 0) && (
        <div ref={resultsRef} style={{ display: 'flex', flexDirection: 'column', gap: 22, scrollMarginTop: 18 }}>
          <ComparisonStoryPanel
            C={C}
            results={comparisonResults}
            profiles={DISPLAY_PROFILES}
            selectedId={profileId}
            onInspect={(id, outcome) => { setProfileId(id); setResult(outcome); }}
          />
          {result && <>
          <div>
            <div style={fieldLabel(C)}>Control results &amp; verdict</div>
            <ControlResultsPanel C={C} verdict={result.verdict} profiles={DISPLAY_PROFILES} comparisonHistory={Object.keys(comparisonResults).length >= 3 ? null : comparison} />
          </div>

          <details style={section(C)}>
            <summary style={{ cursor: 'pointer', color: C.text2, fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase' }}>
              Technical event trace <span style={{ color: C.text3, fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>— {result.run?.events?.length ?? 0} recorded events</span>
            </summary>
            <div style={{ marginTop: 14 }}>
              <AgenticTracePanel C={C} run={result.run} />
            </div>
          </details>

          <div>
            <div style={fieldLabel(C)}>Evidence contract</div>
            <EvidenceContractPanel C={C} contract={result.contract} />
          </div>
          </>}
        </div>
      )}

      {history.length > 0 && <RunHistory C={C} history={history} chainStatus={chainStatus} />}
    </div>
  );
}

const HISTORY_VERDICT_TONE = {
  CONTROL_HELD: 'green',
  PARTIAL_CONTROL_FAILURE: 'ochre',
  CONTROL_FAILED: 'red',
  INCONCLUSIVE: 'slate',
};

function RunHistory({ C, history, chainStatus }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div style={section(C)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <History size={13} color={C.text3} />
        <div style={{ ...fieldLabel(C), marginBottom: 0 }}>Recent runs &middot; this browser</div>
      </div>
      {chainStatus && (
        <div role={chainStatus.valid ? undefined : 'alert'} style={{ fontSize: 11.5, color: chainStatus.valid ? C.text3 : C.red, lineHeight: 1.5, marginBottom: 10 }}>
          Browser hash chain: {chainStatus.status.replaceAll('_', ' ')} · {chainStatus.checked} retained records checked
          {chainStatus.latest_sequence ? ` · latest sequence ${chainStatus.latest_sequence}` : ''}. {chainStatus.limitation}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {history.map(entry => {
          const tone = C[HISTORY_VERDICT_TONE[entry.verdict]] || C.text3;
          const expanded = expandedId === entry.id;
          return (
            <div key={entry.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${tone}`, borderRadius: 2 }}>
              <button
                onClick={() => setExpandedId(expanded ? null : entry.id)}
                style={{
                  width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                }}
              >
                <span style={{ color: tone, fontSize: 11, fontWeight: 800, letterSpacing: .5 }}>{entry.verdict}</span>
                <span style={{ color: C.text1, fontSize: 12.5, fontWeight: 600 }}>{entry.caseTitle}</span>
                <span style={{ color: C.text3, fontSize: 11.5 }}>{entry.profileLabel}</span>
                {entry.degraded && <span style={{ color: C.red, fontSize: 10, fontWeight: 700 }}>DEGRADED</span>}
                <span style={{ marginLeft: 'auto', color: C.text3, fontSize: 11, fontFamily: C.mono }}>
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </button>
              {expanded && (
                <div style={{ padding: '0 12px 12px' }}>
                  {entry.reasonText && (
                    <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.5, marginBottom: 10 }}>{entry.reasonText}</div>
                  )}
                  <EvidenceContractPanel C={C} contract={entry.contract} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
