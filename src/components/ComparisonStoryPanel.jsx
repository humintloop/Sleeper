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
 * The one sentence this whole screen exists to produce.
 *
 * `findMaterialDifferences` below enumerates every field that differs, which
 * is what a reviewer needs when they are already reading closely. This is the
 * other job: whether turning controls on changed anything at all, stated once,
 * before the reader has parsed three columns of flow steps.
 *
 * Deliberately phrased as an observation about this run, never as a claim
 * about the controls in general — see CLAUDE.md on conformance language.
 */
export function summarizeControlDelta(results, profileOrder = PROFILE_ORDER) {
  const present = profileOrder.filter(id => results?.[id]);
  if (present.length < 2) return null;
  const verdictChanged = new Set(present.map(id => results[id]?.verdict?.verdict ?? null)).size > 1;
  const gateChanged = new Set(present.map(id => summarizeRun(results[id]).blocked)).size > 1;
  const headline = verdictChanged && gateChanged
    ? 'The control profile changed both the gate decision and the verdict.'
    : verdictChanged
      ? 'The control profile changed the verdict.'
      : gateChanged
        ? 'The control profile changed the gate decision, but every profile reached the same verdict.'
        : 'No profile differed from any other on gate decision or verdict in this run.';
  return { verdictChanged, gateChanged, changed: verdictChanged || gateChanged, headline };
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

function DeltaStrip({ C, results, profiles, delta }) {
  const present = PROFILE_ORDER.filter(id => results?.[id]);
  return (
    <div style={{ borderTop: `1px solid ${delta.changed ? C.brass : C.borderHi}`, borderBottom: `1px solid ${C.border}`, padding: '11px 2px' }}>
      <div style={{ color: C.text1, fontSize: C.size.body, fontWeight: 650, lineHeight: 1.45, maxWidth: 760 }}>
        {delta.headline}
      </div>
      {/* Per-profile verdict cells — the headline sentence says whether
          anything changed, this is what changed. Dropped once (uncommitted,
          picked up and restored): the whole point of leading the Compare tab
          with this strip was giving the finding a visual form, not just a
          sentence — see the commit that introduced it. */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${present.length}, minmax(0, 1fr))`, gap: 1, background: C.border, marginTop: 13 }}>
        {present.map(id => {
          const outcome = results[id];
          const verdict = outcome?.verdict?.verdict;
          const color = getVerdictColor(verdict, C);
          const { blocked } = summarizeRun(outcome);
          return (
            <div key={id} style={{ background: C.surface, padding: '10px 12px', minWidth: 0 }}>
              <div style={{ color: C[profiles?.[id]?.color] || C.brass, fontSize: C.size.micro, fontWeight: 800 }}>
                {profiles?.[id]?.label || id}
              </div>
              <div style={{ color, fontSize: C.size.small, fontWeight: 800, fontFamily: C.mono, marginTop: 6, overflowWrap: 'anywhere' }}>
                {getVerdictLabel(verdict)}
              </div>
              <div style={{ color: blocked ? C.green : C.red, fontSize: C.size.micro, marginTop: 5 }}>
                {blocked ? 'Path blocked' : 'Path not blocked'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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
        <div style={{ color: C.text3, fontSize: C.size.micro, fontWeight: 800, letterSpacing: .2, marginBottom: 3 }}>{label}</div>
        <div style={{ color: C.text1, fontSize: C.size.small, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{children}</div>
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
          <span title={tool} style={{ fontFamily: C.mono, fontSize: C.size.micro, padding: '2px 5px', border: `1px solid ${C.borderHi}`, background: C.ink, color: C.text1, borderRadius: 2 }}>{friendlyToolName(tool)}</span>
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
        <div style={{ color: C.text1, fontSize: C.size.small, fontWeight: 800 }}>{profile.label}</div>
        <div style={{ color: C.text3, fontSize: C.size.small, lineHeight: 1.5, marginTop: 8 }}>Not run yet.</div>
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
          <div style={{ color: profileColor, fontSize: C.size.micro, fontWeight: 900, letterSpacing: .2 }}>{profile.label}</div>
          <div style={{ color: C.text3, fontSize: C.size.micro, marginTop: 3 }}>{profile.description}</div>
        </div>
        <div style={{ color: verdictColor, border: `1px solid ${verdictColor}55`, padding: '3px 6px', borderRadius: 2, fontSize: C.size.micro, fontWeight: 900, letterSpacing: .5, whiteSpace: 'nowrap' }}>
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

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'grid', gap: 3, fontSize: C.size.micro, color: C.text3, fontFamily: C.mono }}>
        <div>Manifest: {truncateDigest(identity.manifestDigest)}</div>
        <div>Configuration: {truncateDigest(identity.configurationDigest)}</div>
        {identity.timestamp && <div>{new Date(identity.timestamp).toLocaleString()}</div>}
        <div>{identity.target || 'target not recorded'}{identity.model ? ` · ${identity.model}` : ''}</div>
      </div>
      <button
        onClick={() => onInspect?.(profile.id, outcome)}
        aria-pressed={selected}
        style={{ width: '100%', marginTop: 14, padding: '7px 9px', cursor: 'pointer', borderRadius: 2, border: `1px solid ${selected ? profileColor : C.borderHi}`, background: selected ? `${profileColor}12` : 'transparent', color: selected ? profileColor : C.text2, fontSize: C.size.micro, fontWeight: 800, letterSpacing: .7 }}
      >
        {selected ? 'Details shown below' : 'Open full trace & evidence'}
      </button>
    </article>
  );
}

export default function ComparisonStoryPanel({ C, results, profiles, selectedId, onInspect }) {
  const available = PROFILE_ORDER.filter(id => results?.[id]);
  if (available.length === 0) return null;
  const deterministic = available.every(id => results[id]?.contract?.run_mode === 'deterministic_replay');
  const differences = findMaterialDifferences(results, PROFILE_ORDER);
  const delta = summarizeControlDelta(results, PROFILE_ORDER);

  return (
    <section aria-labelledby="comparison-story-title" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div id="comparison-story-title" style={{ color: C.brass, fontSize: C.size.small, fontWeight: 900, letterSpacing: .2 }}>
          What happened under each control setup
        </div>
        <div style={{ color: C.text2, fontSize: C.size.small, lineHeight: 1.55, marginTop: 5, maxWidth: 820 }}>
          Follow the same path from untrusted content to tool intent, harness decision, and simulated effect.
          {deterministic
            ? ' Sample Replay uses the same scripted malicious intent in every column.'
            : ' Live and local targets use separate model calls, so model behavior may vary between columns.'}
        </div>
      </div>
      {delta && <DeltaStrip C={C} results={results} profiles={profiles} delta={delta} />}
      {differences.length > 0 && (
        <details style={{ borderBottom: `1px solid ${C.border}`, padding: '1px 2px 9px' }}>
          <summary style={{ color: C.text3, fontSize: C.size.micro, fontWeight: 750, letterSpacing: .2, cursor: 'pointer' }}>
            Review material differences across profiles
          </summary>
          <ul style={{ margin: '9px 0 0', paddingLeft: 18, color: C.text2, fontSize: C.size.small, lineHeight: 1.5 }}>
            {differences.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </details>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {PROFILE_ORDER.map(id => (
          <ProfileStory key={id} C={C} profile={profiles[id]} outcome={results[id]} selected={selectedId === id} onInspect={onInspect} />
        ))}
      </div>
    </section>
  );
}
