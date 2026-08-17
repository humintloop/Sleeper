// The actual agent module screen: pick a case, pick a control profile, point
// it at a target — live API or a local WebLLM model — run the ReAct loop, and
// see the trace, verdict, and Evidence Contract. This is the piece that was
// missing entirely — everything in src/harness/ (weeks 2-5) had no UI surface
// until this file.
//
// Two target types:
//   - Live API (Anthropic first, per CLAUDE.md): APITargetAdapter, real
//     provider tool-calling.
//   - Local model: WebLLMLocalTarget wraps an MLCEngine instance this screen
//     loads itself (a separate download from the single-turn flow's model —
//     see src/data/victimModels.js for the shared catalog). Small local
//     models do not call tools reliably, so every local run is `degraded:
//     true` by construction; that is surfaced on the trace panel, never
//     hidden.
import { useRef, useState } from 'react';
import { MLCEngine } from '@mlc-ai/web-llm';
import { ChevronLeft, History, Play, RefreshCw } from 'lucide-react';
import { AGENT_CASES, AGENT_CASE_ORDER } from '../data/agentCases';
import { CONTROL_PROFILES } from '../data/controlProfiles';
import { VICTIM_MODELS } from '../data/victimModels';
import { runAgentAssessment } from '../harness/runAgentAssessment';
import { WebLLMLocalTarget } from '../harness/webllmLocalTarget';
import { APITargetAdapter, PROVIDERS } from '../api/adapter';
import { loadAgentRuns, saveAgentRun } from '../storage';
import ControlProfileSelector from './ControlProfileSelector';
import AgenticTracePanel from './AgenticTracePanel';
import ControlResultsPanel from './ControlResultsPanel';
import EvidenceContractPanel from './EvidenceContractPanel';
import FrameworkCrosswalkPanel from './FrameworkCrosswalkPanel';

const PROVIDER_DEFAULTS = {
  [PROVIDERS.ANTHROPIC]: { endpoint: 'https://api.anthropic.com/v1/messages', modelId: 'claude-sonnet-5' },
  [PROVIDERS.OPENAI]: { endpoint: 'https://api.openai.com/v1/chat/completions', modelId: 'gpt-4o' },
};

const RUN_PROFILE_IDS = ['baseline', 'partial', 'reference'];
const TARGET_TYPES = { LIVE: 'live', LOCAL: 'local' };

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

  const [targetType, setTargetType] = useState(TARGET_TYPES.LIVE);

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

  const [result, setResult] = useState(null); // { run, verdict, contract }
  const [comparison, setComparison] = useState({}); // { [profileId]: verdictString }
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  // Runs previously lived only in this component's state — navigate away and
  // the run was gone with no warning. Persisted separately from the
  // single-turn findings store (see storage.js) since the two use different
  // verdict vocabularies and record shapes.
  const [history, setHistory] = useState(() => loadAgentRuns());

  const agentCase = AGENT_CASES[caseId];

  const loadLocalModel = async () => {
    setLocalStatus('loading');
    setError(null);
    try {
      if (!engineRef.current) engineRef.current = new MLCEngine();
      await engineRef.current.reload(localModelId, { initProgressCallback: p => setLocalProgress(p.text) });
      setLocalStatus('ready');
    } catch (err) {
      setLocalStatus('error');
      setError(err?.message || String(err));
    }
  };

  const buildTarget = () => {
    if (targetType === TARGET_TYPES.LOCAL) {
      return new WebLLMLocalTarget({ engine: engineRef.current });
    }
    const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS[PROVIDERS.ANTHROPIC];
    return new APITargetAdapter({ endpoint: defaults.endpoint, apiKey: apiKey.trim(), modelId: modelId.trim() || defaults.modelId });
  };

  const targetReady = targetType === TARGET_TYPES.LOCAL ? localStatus === 'ready' : Boolean(apiKey.trim());
  const targetLabel = targetType === TARGET_TYPES.LOCAL
    ? `webllm-local:${localModelId}`
    : `${provider}:${modelId.trim() || PROVIDER_DEFAULTS[provider].modelId}`;
  const targetProvider = targetType === TARGET_TYPES.LOCAL ? PROVIDERS.GENERIC : provider;

  const runOnce = async (targetProfileId) => {
    if (!targetReady) {
      setError(targetType === TARGET_TYPES.LOCAL
        ? 'Load a local model before running a case.'
        : 'An API key is required. It is held in memory for this session only and never stored.');
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
  const persistRun = (outcome, targetProfileId) => {
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
    setHistory(saveAgentRun(record));
  };

  const handleRun = async () => {
    const outcome = await runOnce(profileId);
    if (!outcome) return;
    setResult(outcome);
    setComparison(prev => ({ ...prev, [profileId]: outcome.verdict.verdict }));
    persistRun(outcome, profileId);
  };

  const handleComparative = async () => {
    const next = {};
    let last = null;
    for (const id of RUN_PROFILE_IDS) {
      const outcome = await runOnce(id);
      if (!outcome) return;
      next[id] = outcome.verdict.verdict;
      persistRun(outcome, id);
      if (id === profileId) last = outcome;
    }
    setComparison(next);
    if (last) setResult(last);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 60px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onHome} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: C.text3, fontSize: 12, cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={14} /> HOME
        </button>
      </div>

      <div>
        <div style={{ fontSize: 11, color: C.text3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
          Agent threat case &middot; live ReAct run
        </div>
        <h1 style={{ fontSize: 28, color: C.text1, fontWeight: 600, letterSpacing: '0.02em', margin: 0 }}>Run agent case</h1>
        <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, maxWidth: 720, marginTop: 10 }}>
          Real tool-call intent, simulated tool effect — nothing this screen does leaves the browser or acts on
          anything. The model genuinely decides whether to call a tool; the mock router decides what it sees back.
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
              <button key={id} onClick={() => setCaseId(id)} style={{
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
      </div>

      <div style={section(C)}>
        <div style={fieldLabel(C)}>Framework mapping</div>
        <FrameworkCrosswalkPanel C={C} agentCase={agentCase} />
      </div>

      <div style={section(C)}>
        <div style={fieldLabel(C)}>Control profile</div>
        <ControlProfileSelector C={C} profiles={CONTROL_PROFILES} selectedId={profileId} onSelect={setProfileId} customControls={CONTROL_PROFILES.custom.controls} onCustomChange={() => {}} />
      </div>

      <div style={section(C)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ ...fieldLabel(C), marginBottom: 0 }}>Target</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={toggleBtn(C, targetType === TARGET_TYPES.LIVE)} onClick={() => setTargetType(TARGET_TYPES.LIVE)}>LIVE API</button>
            <button style={toggleBtn(C, targetType === TARGET_TYPES.LOCAL)} onClick={() => setTargetType(TARGET_TYPES.LOCAL)}>LOCAL MODEL</button>
          </div>
        </div>

        {targetType === TARGET_TYPES.LIVE ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <div style={{ ...fieldLabel(C), marginBottom: 4 }}>Provider</div>
              <select
                value={provider}
                onChange={e => { const p = e.target.value; setProvider(p); setModelId(PROVIDER_DEFAULTS[p].modelId); }}
                style={input(C)}
              >
                <option value={PROVIDERS.ANTHROPIC}>Anthropic</option>
                <option value={PROVIDERS.OPENAI}>OpenAI</option>
              </select>
            </div>
            <div>
              <div style={{ ...fieldLabel(C), marginBottom: 4 }}>Model ID</div>
              <input value={modelId} onChange={e => setModelId(e.target.value)} style={input(C)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ ...fieldLabel(C), marginBottom: 4 }}>API key</div>
              <input
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
                <div style={{ ...fieldLabel(C), marginBottom: 4 }}>Model</div>
                <select value={localModelId} onChange={e => { setLocalModelId(e.target.value); setLocalStatus('idle'); }} style={input(C)} disabled={localStatus === 'loading'}>
                  {VICTIM_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.quickStart ? 'Quick start — ' : ''}{m.name} ({m.size})</option>
                  ))}
                </select>
              </div>
              <button onClick={loadLocalModel} disabled={localStatus === 'loading' || localStatus === 'ready'} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px',
                background: localStatus === 'ready' ? C.greenBg : C.surface,
                border: `1px solid ${localStatus === 'ready' ? C.green : C.borderHi}`,
                color: localStatus === 'ready' ? C.green : C.text1,
                fontSize: 12, fontWeight: 800, letterSpacing: .5, borderRadius: 2,
                cursor: localStatus === 'loading' || localStatus === 'ready' ? 'not-allowed' : 'pointer',
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

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={handleRun} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
          background: running ? C.hover : C.brassBg, border: `1px solid ${C.brass}`, color: C.brass,
          fontSize: 13, fontWeight: 800, letterSpacing: .5, cursor: running ? 'not-allowed' : 'pointer', borderRadius: 2,
        }}>
          {running ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />} {running ? 'RUNNING…' : 'RUN CASE'}
        </button>
        <button onClick={handleComparative} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
          background: 'transparent', border: `1px solid ${C.borderHi}`, color: C.text2,
          fontSize: 13, fontWeight: 700, letterSpacing: .5, cursor: running ? 'not-allowed' : 'pointer', borderRadius: 2,
        }}>
          RUN ACROSS BASELINE / PARTIAL / REFERENCE
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', background: C.redBg, border: `1px solid ${C.red}55`, borderLeft: `3px solid ${C.red}`, borderRadius: 2, color: C.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && (
        <>
          <div>
            <div style={fieldLabel(C)}>ReAct loop &middot; event stream</div>
            <AgenticTracePanel C={C} run={result.run} />
          </div>

          <div>
            <div style={fieldLabel(C)}>Control results &amp; verdict</div>
            <ControlResultsPanel C={C} verdict={result.verdict} profiles={CONTROL_PROFILES} comparisonHistory={comparison} />
          </div>

          <div>
            <div style={fieldLabel(C)}>Evidence contract</div>
            <EvidenceContractPanel C={C} contract={result.contract} />
          </div>
        </>
      )}

      {history.length > 0 && <RunHistory C={C} history={history} />}
    </div>
  );
}

const HISTORY_VERDICT_TONE = {
  CONTROL_HELD: 'green',
  PARTIAL_CONTROL_FAILURE: 'ochre',
  CONTROL_FAILED: 'red',
  INCONCLUSIVE: 'slate',
};

function RunHistory({ C, history }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div style={section(C)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <History size={13} color={C.text3} />
        <div style={{ ...fieldLabel(C), marginBottom: 0 }}>Recent runs &middot; this browser</div>
      </div>
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
