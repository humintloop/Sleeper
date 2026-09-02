import { ArrowDown, Ban, CheckCircle2, ShieldAlert, Wrench } from 'lucide-react';
import { getVerdictColor, getVerdictLabel } from './VerdictBanner';

const PROFILE_ORDER = ['baseline', 'partial', 'reference'];
const TOOL_LABELS = {
  retrieve_email: 'Read external email',
  retrieve_document: 'Retrieve internal document',
  send_email: 'Send outbound email',
  web_search: 'Search the web',
  read_file: 'Read a file',
  write_file: 'Write a file',
};

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function friendlyToolName(tool) {
  if (TOOL_LABELS[tool]) return TOOL_LABELS[tool];
  const words = String(tool).replace(/^mcp__[^_]+__/, '').replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function friendlySource(source) {
  return String(source).replaceAll('_', ' ');
}

function truncateDigest(digest) {
  return digest ? `${digest.slice(0, 12)}…` : 'not recorded';
}

function targetIdentity(outcome) {
  const manifest = outcome?.contract?.run_manifest;
  const config = manifest?.configuration;
  const model = config?.target_type === 'live' ? config.provider_model
    : config?.target_type === 'local' ? config.local_model
      : null;
  return {
    manifestDigest: outcome?.manifestDigest || manifest?.manifest_digest || null,
    configurationDigest: outcome?.configurationDigest || manifest?.configuration_digest || null,
    timestamp: manifest?.generated_at || null,
    target: outcome?.contract?.target || config?.target_label || null,
    model: model || null,
  };
}

/**
 * A concise summary of what actually differs between the compared members —
 * not every field, just the ones a reader would otherwise have to diff by
 * eye across cards: verdict, whether the gate blocked the path, and whether
 * the declared case-condition evaluation matched.
 */
export function findMaterialDifferences(results, profileOrder) {
  const entries = profileOrder
    .filter(id => results?.[id])
    .map(id => {
      const outcome = results[id];
      const summary = summarizeRun(outcome);
      return {
        profileId: id,
        verdict: outcome?.verdict?.verdict ?? null,
        blocked: summary.blocked,
        caseEvaluationOutcome: outcome?.contract?.case_evaluation?.summary ?? null,
        evidenceClass: outcome?.contract?.evidence?.max_class_claimed ?? null,
      };
    });
  const differences = [];
  const distinct = key => new Set(entries.map(entry => JSON.stringify(entry[key]))).size > 1;
  if (distinct('verdict')) {
    differences.push(`Verdict differs across profiles: ${entries.map(e => `${e.profileId} → ${e.verdict ?? 'no result'}`).join(', ')}.`);
  }
  if (distinct('blocked')) {
    differences.push(`Gate decision differs: ${entries.map(e => `${e.profileId} ${e.blocked ? 'blocked' : 'did not block'}`).join(', ')}.`);
  }
  if (distinct('evidenceClass')) {
    differences.push(`Evidence class claimed differs: ${entries.map(e => `${e.profileId} → ${e.evidenceClass ?? 'none'}`).join(', ')}.`);
  }
  if (distinct('caseEvaluationOutcome')) {
    differences.push('Case-condition evaluation outcome differs between profiles — see each card and the Trace tab.');
  }
  return differences;
}

function summarizeRun(outcome) {
  const events = outcome?.run?.events || [];
  const toolCalls = events.filter(event => event.type === 'tool_call');
  const decisions = events.filter(event => event.type === 'authorization_decision');
  const toolResults = events.filter(event => event.type === 'tool_result');
  const detections = events.filter(event => event.type === 'detection');

  const attemptedTools = unique(toolCalls.map(event => event.tool));
  const untrustedSources = unique(toolCalls
    .filter(event => event.instruction_source_trusted !== true)
    .map(event => event.instruction_source || 'unattributed content'));
  const blocked = decisions.some(event => event.blocked)
    || toolResults.some(event => event.status === 'denied')
    || detections.some(event => event.action === 'blocked_or_constrained');
  const executedTools = unique(toolResults.filter(event => event.status === 'ok').map(event => event.tool));
  const deniedTools = unique(toolResults.filter(event => event.status === 'denied').map(event => event.tool));

  return { attemptedTools, untrustedSources, blocked, executedTools, deniedTools };
}

function FlowStep({ C, icon: Icon, label, children, tone = 'text2', last = false }) {
  const color = C[tone] || C.text2;
  return (
    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', gap: 9 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 27, height: 27, borderRadius: 2, border: `1px solid ${color}66`, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color={color} />
        </div>
        {!last && <div style={{ width: 1, flex: 1, minHeight: 13, background: C.borderHi }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 11, minWidth: 0 }}>
        <div style={{ color: C.text3, fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
        <div style={{ color: C.text1, fontSize: 12, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{children}</div>
      </div>
    </div>
  );
}

function ToolList({ C, tools }) {
  if (tools.length === 0) return <span style={{ color: C.text3 }}>No tool call recorded</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      {tools.map((tool, index) => (
        <span key={tool} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span title={tool} style={{ fontFamily: C.mono, fontSize: 10.5, padding: '2px 5px', border: `1px solid ${C.borderHi}`, background: C.ink, color: C.text1, borderRadius: 2 }}>{friendlyToolName(tool)}</span>
          {index < tools.length - 1 && <ArrowDown size={10} color={C.text3} style={{ transform: 'rotate(-90deg)' }} />}
        </span>
      ))}
    </div>
  );
}

function ProfileStory({ C, profile, outcome, selected, onInspect }) {
  if (!outcome) {
    return (
      <div style={{ border: `1px dashed ${C.borderHi}`, background: C.panel, borderRadius: 2, padding: 15, minHeight: 210 }}>
        <div style={{ color: C.text1, fontSize: 13, fontWeight: 800 }}>{profile.label}</div>
        <div style={{ color: C.text3, fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>Not run yet.</div>
      </div>
    );
  }

  const summary = summarizeRun(outcome);
  const identity = targetIdentity(outcome);
  const verdict = outcome.verdict?.verdict;
  const verdictColor = getVerdictColor(verdict, C);
  const profileColor = C[profile.color] || C.brass;
  const effectText = summary.deniedTools.length > 0
    ? `Denied: ${summary.deniedTools.map(friendlyToolName).join(', ')}.${summary.executedTools.length ? ` Earlier simulated steps: ${summary.executedTools.map(friendlyToolName).join(', ')}.` : ' No simulated action occurred.'}`
    : summary.executedTools.length > 0
      ? `Simulated execution: ${summary.executedTools.map(friendlyToolName).join(', ')}.`
      : 'No simulated tool effect was recorded.';

  return (
    <article style={{ border: `1px solid ${C.border}`, borderTop: `3px solid ${profileColor}`, background: C.panel, borderRadius: 2, padding: 15, animation: 'fadeUp .24s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ color: profileColor, fontSize: 10, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase' }}>{profile.label}</div>
          <div style={{ color: C.text3, fontSize: 10.5, marginTop: 3 }}>{profile.description}</div>
        </div>
        <div style={{ color: verdictColor, border: `1px solid ${verdictColor}55`, padding: '3px 6px', borderRadius: 2, fontSize: 9.5, fontWeight: 900, letterSpacing: .5, whiteSpace: 'nowrap' }}>
          {getVerdictLabel(verdict)}
        </div>
      </div>

      <FlowStep C={C} icon={ShieldAlert} label="Instruction source" tone={summary.untrustedSources.length ? 'red' : 'text2'}>
        {summary.untrustedSources.length
          ? <><strong style={{ color: C.red }}>Untrusted:</strong> {summary.untrustedSources.map(friendlySource).join(', ')}</>
          : 'No untrusted source was attributed.'}
      </FlowStep>
      <FlowStep C={C} icon={Wrench} label="Agent proposed">
        <ToolList C={C} tools={summary.attemptedTools} />
      </FlowStep>
      <FlowStep C={C} icon={summary.blocked ? Ban : CheckCircle2} label="Harness decision" tone={summary.blocked ? 'green' : 'red'}>
        <strong style={{ color: summary.blocked ? C.green : C.red }}>{summary.blocked ? 'MALICIOUS PATH BLOCKED' : 'MALICIOUS PATH NOT BLOCKED'}</strong>
        <span style={{ color: C.text3 }}> by this profile&rsquo;s deterministic controls</span>
      </FlowStep>
      <FlowStep C={C} icon={summary.blocked ? Ban : CheckCircle2} label="Simulated effect" tone={summary.deniedTools.length && !summary.executedTools.length ? 'green' : 'ochre'} last>
        {effectText}
      </FlowStep>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'grid', gap: 3, fontSize: 10, color: C.text3, fontFamily: C.mono }}>
        <div>Manifest: {truncateDigest(identity.manifestDigest)}</div>
        <div>Configuration: {truncateDigest(identity.configurationDigest)}</div>
        {identity.timestamp && <div>{new Date(identity.timestamp).toLocaleString()}</div>}
        <div>{identity.target || 'target not recorded'}{identity.model ? ` · ${identity.model}` : ''}</div>
      </div>
      <button
        onClick={() => onInspect?.(profile.id, outcome)}
        aria-pressed={selected}
        style={{ width: '100%', marginTop: 14, padding: '7px 9px', cursor: 'pointer', borderRadius: 2, border: `1px solid ${selected ? profileColor : C.borderHi}`, background: selected ? `${profileColor}12` : 'transparent', color: selected ? profileColor : C.text2, fontSize: 10.5, fontWeight: 800, letterSpacing: .7 }}
      >
        {selected ? 'DETAILS SHOWN BELOW' : 'OPEN FULL TRACE & EVIDENCE'}
      </button>
    </article>
  );
}

export default function ComparisonStoryPanel({ C, results, profiles, selectedId, onInspect }) {
  const available = PROFILE_ORDER.filter(id => results?.[id]);
  if (available.length === 0) return null;
  const deterministic = available.every(id => results[id]?.contract?.run_mode === 'deterministic_replay');
  const differences = findMaterialDifferences(results, PROFILE_ORDER);

  return (
    <section aria-labelledby="comparison-story-title" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div id="comparison-story-title" style={{ color: C.brass, fontSize: 12, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase' }}>
          What happened under each control setup
        </div>
        <div style={{ color: C.text2, fontSize: 12.5, lineHeight: 1.55, marginTop: 5, maxWidth: 820 }}>
          Follow the same path from untrusted content to tool intent, harness decision, and simulated effect.
          {deterministic
            ? ' Sample Replay uses the same scripted malicious intent in every column.'
            : ' Live and local targets use separate model calls, so model behavior may vary between columns.'}
        </div>
      </div>
      {differences.length > 0 && (
        <div role="status" style={{ background: C.surface, border: `1px solid ${C.borderHi}`, borderLeft: `3px solid ${C.brass}`, borderRadius: 2, padding: '10px 13px' }}>
          <div style={{ color: C.text3, fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>
            Material differences across profiles
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: C.text2, fontSize: 12, lineHeight: 1.5 }}>
            {differences.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {PROFILE_ORDER.map(id => (
          <ProfileStory key={id} C={C} profile={profiles[id]} outcome={results[id]} selected={selectedId === id} onInspect={onInspect} />
        ))}
      </div>
    </section>
  );
}
