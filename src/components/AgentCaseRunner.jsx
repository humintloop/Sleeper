// The actual agent module screen: pick a case, pick a control profile, point
// it at a live target, run the ReAct loop, and see the trace, verdict, and
// Evidence Contract. This is the piece that was missing entirely — everything
// in src/harness/ (weeks 2-5) had no UI surface until this file.
//
// Live API only for v1. WebLLM tool-calling needs the adapter's prompted-JSON
// fallback path exercised against a real loaded engine, which is follow-up
// work; scoping this to a live key keeps the first version honest about what
// it actually runs against, per CLAUDE.md's "Live API target is Anthropic
// first."
import { useState } from 'react';
import { ChevronLeft, Play, RefreshCw } from 'lucide-react';
import { AGENT_CASES, AGENT_CASE_ORDER } from '../data/agentCases';
import { CONTROL_PROFILES } from '../data/controlProfiles';
import { runAgentAssessment } from '../harness/runAgentAssessment';
import { APITargetAdapter, PROVIDERS } from '../api/adapter';
import ControlProfileSelector from './ControlProfileSelector';
import AgenticTracePanel from './AgenticTracePanel';
import ControlResultsPanel from './ControlResultsPanel';
import EvidenceContractPanel from './EvidenceContractPanel';

const PROVIDER_DEFAULTS = {
  [PROVIDERS.ANTHROPIC]: { endpoint: 'https://api.anthropic.com/v1/messages', modelId: 'claude-sonnet-5' },
  [PROVIDERS.OPENAI]: { endpoint: 'https://api.openai.com/v1/chat/completions', modelId: 'gpt-4o' },
};

const RUN_PROFILE_IDS = ['baseline', 'partial', 'reference'];

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

export default function AgentCaseRunner({ C, onHome }) {
  const [caseId, setCaseId] = useState(AGENT_CASE_ORDER[0]);
  const [profileId, setProfileId] = useState('reference');
  const [provider, setProvider] = useState(PROVIDERS.ANTHROPIC);
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState(PROVIDER_DEFAULTS[PROVIDERS.ANTHROPIC].modelId);

  const [result, setResult] = useState(null); // { run, verdict, contract }
  const [comparison, setComparison] = useState({}); // { [profileId]: verdictString }
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const agentCase = AGENT_CASES[caseId];

  const buildTarget = () => {
    const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS[PROVIDERS.ANTHROPIC];
    return new APITargetAdapter({ endpoint: defaults.endpoint, apiKey: apiKey.trim(), modelId: modelId.trim() || defaults.modelId });
  };

  const runOnce = async (targetProfileId) => {
    if (!apiKey.trim()) { setError('An API key is required. It is held in memory for this session only and never stored.'); return null; }
    setRunning(true);
    setError(null);
    try {
      const outcome = await runAgentAssessment({
        agentCase: caseId,
        profile: targetProfileId,
        target: buildTarget(),
        provider,
        targetLabel: `${provider}:${modelId.trim() || PROVIDER_DEFAULTS[provider].modelId}`,
      });
      return outcome;
    } catch (err) {
      setError(err?.message || String(err));
      return null;
    } finally {
      setRunning(false);
    }
  };

  const handleRun = async () => {
    const outcome = await runOnce(profileId);
    if (!outcome) return;
    setResult(outcome);
    setComparison(prev => ({ ...prev, [profileId]: outcome.verdict.verdict }));
  };

  const handleComparative = async () => {
    const next = {};
    let last = null;
    for (const id of RUN_PROFILE_IDS) {
      const outcome = await runOnce(id);
      if (!outcome) return;
      next[id] = outcome.verdict.verdict;
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
        <div style={fieldLabel(C)}>Control profile</div>
        <ControlProfileSelector C={C} profiles={CONTROL_PROFILES} selectedId={profileId} onSelect={setProfileId} customControls={CONTROL_PROFILES.custom.controls} onCustomChange={() => {}} />
      </div>

      <div style={section(C)}>
        <div style={fieldLabel(C)}>Live target</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
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
    </div>
  );
}
