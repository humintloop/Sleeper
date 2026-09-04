// The conference-facing home screen: a five-step guided walkthrough of
// NR-AGT-001, built for a stage or a booth monitor rather than an analyst's
// desk. Replaced the incident-memo home screen.
//
// This was picked up from an uncommitted, externally-built draft. The visual
// design and the five-act structure (employee -> content -> agent -> tools ->
// control) are kept — they're good, and the underlying rationale document
// (a "Story Mode" distinct from the analyst "Lab Mode" for a conference
// audience) is sound. What changed: the original had zero connection to
// src/data/storyScene.js or the harness — the email, the injected
// instruction, the tool calls, and the closing "Control held in this run"
// verdict were all hand-typed prose, asserting a specific computed-sounding
// outcome that nothing ever computed. That is exactly the failure mode this
// project's story layer exists to prevent (see storyScene.js's own header
// comment and CLAUDE.md's "never claim conformance"), and it isn't a style
// preference — it's the one rule enforced everywhere else in this app.
//
// So every fact on this screen now comes from a real run. Steps 1-2 use
// static-but-real data (the task, the fixture email) that needs no run.
// Steps 3-5 run the actual assessment — Baseline for the main narrative, plus
// a second run under the comparison profile so step 5's "and if a control had
// been configured?" is a second real verdict, not an invented one.
import { ArrowLeft, ArrowRight, Bot, FileText, Mail, RotateCcw, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import SleeperBrand from './SleeperBrand';
import { getVerdictColor, getVerdictLabel } from './VerdictBanner';
import { FIXTURE_PERSONA } from '../data/agentCases';
import {
  SCENE_TASK,
  STORY_CASE_ID,
  deriveSceneBeats,
  injectedEmailFixture,
  splitInjectedEmail,
  storyComparisonRunParams,
  storyRunParams,
} from '../data/storyScene';
import { runAgentAssessment } from '../harness/runAgentAssessment';

const BEATS = [
  { number: '01', short: 'Employee', label: 'A normal request' },
  { number: '02', short: 'Content', label: 'An email is retrieved' },
  { number: '03', short: 'Agent', label: 'Instructions are confused' },
  { number: '04', short: 'Tools', label: 'A sensitive call is proposed' },
  { number: '05', short: 'Control', label: 'The outcome is recorded' },
];

function Signal({ tone, children }) {
  return <span className={`conference-signal conference-signal--${tone}`}>{children}</span>;
}

function Progress({ active, onSelect }) {
  return (
    <nav className="conference-progress" aria-label="Attack story">
      {BEATS.map((beat, index) => (
        <button
          key={beat.number}
          className={index === active ? 'conference-progress__active' : ''}
          onClick={() => onSelect(index + 1)}
          aria-current={index === active ? 'step' : undefined}
        >
          <span>{beat.number}</span>
          <strong>{beat.short}</strong>
          <small>{beat.label}</small>
        </button>
      ))}
    </nav>
  );
}

function StoryHeader({ active, onSelect, onRestart, onLab }) {
  return (
    <>
      <header className="conference-masthead">
        <button className="conference-brand" onClick={onRestart} aria-label="Return to the conference story opening">
          <SleeperBrand compact />
        </button>
        <span className="conference-masthead__context">Employee agent prompt injection</span>
        <div className="conference-masthead__actions">
          <span>All effects simulated</span>
          <button onClick={onLab}>Evidence lab</button>
        </div>
      </header>
      {active >= 0 && <Progress active={active} onSelect={onSelect} />}
    </>
  );
}

/** A beat's tool call as one plain-English line, matching SceneWalkthrough's own vocabulary. */
function beatLine(beat) {
  if (!beat) return null;
  return `${beat.action} ${beat.subject}`.trim();
}

/**
 * What a run's own trace says happened, in the same register
 * ComparisonStoryPanel uses on the evidence side of the app — this screen
 * makes the identical claim the evidence layer would, not a friendlier one.
 */
function effectSummary(outcome) {
  const beats = deriveSceneBeats(outcome?.run);
  const executed = beats.filter(beat => beat.status === 'ok' && !beat.trusted);
  const denied = beats.filter(beat => beat.status === 'denied');
  if (denied.length > 0 && executed.length === 0) {
    return `Denied at the gate: ${denied.map(beatLine).join(', ')}.`;
  }
  if (executed.length > 0) {
    return `Simulated execution: ${executed.map(beatLine).join(', ')}.`;
  }
  return 'No simulated tool effect was recorded.';
}

export default function ConferenceStory({ C, onScene, onAgentLab }) {
  const [step, setStep] = useState(0);
  const [baseline, setBaseline] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState(null);
  const active = step - 1;

  useEffect(() => {
    let active2 = true;
    (async () => {
      try {
        const [baseOutcome, compOutcome] = await Promise.all([
          runAgentAssessment(storyRunParams()),
          runAgentAssessment(storyComparisonRunParams()),
        ]);
        if (!active2) return;
        setBaseline(baseOutcome);
        setComparison(compOutcome);
      } catch (err) {
        if (active2) setError(err?.message || String(err));
      }
    })();
    return () => { active2 = false; };
  }, []);

  const next = () => setStep(value => Math.min(value + 1, BEATS.length));
  const previous = () => setStep(value => Math.max(value - 1, 0));

  const email = splitInjectedEmail();
  const injectedInstruction = injectedEmailFixture()?.injected_instruction ?? null;
  const beats = deriveSceneBeats(baseline?.run);
  const alarmBeat = beats.find(beat => beat.tone === 'alarm');
  const toolBeats = beats.filter(beat => beat.status === 'ok' || beat.status === 'denied');
  const ready = Boolean(baseline);
  const readyForComparison = Boolean(baseline && comparison);

  return (
    <main className="conference-shell">
      <StoryHeader active={active} onSelect={setStep} onRestart={() => setStep(0)} onLab={onAgentLab} />

      {error && (
        <div role="alert" style={{ margin: '18px 0', padding: '12px 14px', background: C.redBg, border: `1px solid ${C.red}55`, borderLeft: `3px solid ${C.red}`, borderRadius: C.radius, color: C.red, fontSize: C.size.small }}>
          The story could not run: {error}
        </div>
      )}

      {step === 0 && (
        <section className="conference-opening" aria-labelledby="conference-title">
          <div className="conference-opening__meta">
            <span>Conference demonstration</span><span>{STORY_CASE_ID}</span><span>Local-first assurance</span>
          </div>
          <div className="conference-opening__grid">
            <div className="conference-opening__copy">
              <Signal tone="danger">Employee agent prompt injection</Signal>
              <h1 id="conference-title" className="display-type">The email told the agent what to do next.</h1>
              <p>{FIXTURE_PERSONA.name.split(' ')[0]} asks an assistant to summarize a customer email. The email itself carries a second instruction — addressed to the assistant, not to her.</p>
              <div className="conference-opening__actions">
                <button className="conference-button conference-button--primary" onClick={() => setStep(1)}>
                  Watch the attack <ArrowRight size={20} aria-hidden="true" />
                </button>
                <button className="conference-button conference-button--secondary" onClick={onAgentLab}>
                  Open the technical lab
                </button>
              </div>
              <small>A five-step controlled replay against the real harness. No real customer data. No outbound message.</small>
            </div>
            <aside className="conference-thesis" aria-label="Demonstration thesis">
              <span>The risk</span>
              <p>Employees delegate work to agents.</p>
              <p>Agents retrieve content they do not control.</p>
              <p className="conference-thesis__danger">That content can contain instructions.</p>
              <strong>Sleeper shows what the agent trusted, attempted, and whether the control held — from a real run, not a script.</strong>
            </aside>
          </div>
          <Progress active={-1} onSelect={setStep} />
        </section>
      )}

      {step > 0 && (
        <section className="conference-scene" aria-live="polite">
          <div className="conference-scene__counter"><span>Controlled incident replay</span><strong>{BEATS[active].number} / 05</strong></div>

          {step === 1 && (
            <div className="conference-beat">
              <div className="conference-beat__heading">
                <div><Signal tone="trusted">Trusted employee task</Signal><h1 className="display-type">A routine request starts the chain.</h1></div>
                <p>The employee is not attacking the system. They are delegating ordinary work to an agent with access to company tools.</p>
              </div>
              <div className="conference-actors">
                <article className="conference-actor conference-actor--employee">
                  <div><UserRound size={22} aria-hidden="true" /><span><strong>{FIXTURE_PERSONA.name}</strong><small>{FIXTURE_PERSONA.role}</small></span></div>
                  <blockquote>&ldquo;{SCENE_TASK}&rdquo;</blockquote>
                </article>
                <article className="conference-actor conference-actor--agent">
                  <div><Bot size={22} aria-hidden="true" /><span><strong>AI agent</strong><small>Connected: {FIXTURE_PERSONA.connected.join(', ')}</small></span></div>
                  <p>Retrieves the referenced customer message to complete the task.</p>
                  <Signal tone="agent">Following employee request</Signal>
                </article>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="conference-beat">
              <div className="conference-beat__heading">
                <div><Signal tone="danger">Untrusted content</Signal><h1 className="display-type">The email contains a second instruction.</h1></div>
                <p>The injected text arrives inside data the agent was expected to read. It is not a user request and should not gain authority.</p>
              </div>
              <article className="conference-email">
                <div className="conference-email__meta">
                  <span><Mail size={16} aria-hidden="true" /> Customer email</span>
                  {email.header.map(line => <span key={line}>{line.replace(/^(From|Subject):\s*/, '')}</span>)}
                </div>
                <p>{email.body}</p>
                {email.footer && (
                  <div className="conference-injection">
                    <span>Injected instruction inside the email</span>
                    <strong>{email.footer}</strong>
                  </div>
                )}
              </article>
            </div>
          )}

          {step === 3 && (
            <div className="conference-beat">
              <div className="conference-beat__heading">
                <div><Signal tone="agent">Agent decision</Signal><h1 className="display-type">Retrieved content changes the agent&rsquo;s plan.</h1></div>
                <p>The agent confuses data with authority. It incorporates the email&rsquo;s instruction into its own next actions.</p>
              </div>
              <div className="conference-context">
                <article><span>What the employee authorized</span><strong>{SCENE_TASK}</strong><Signal tone="trusted">Trusted</Signal></article>
                <article className="conference-context--danger"><span>What the email requested</span><strong>{injectedInstruction ?? 'Retrieve an internal record and send it externally.'}</strong><Signal tone="danger">Untrusted</Signal></article>
                <article className="conference-context--agent">
                  <span>What the agent decided</span>
                  <strong>{ready ? (beatLine(alarmBeat) ?? 'No untrusted call was attempted in this run.') : 'Running the assessment…'}</strong>
                  <Signal tone="agent">{ready ? 'Recorded plan' : 'Pending'}</Signal>
                </article>
              </div>
              {ready && alarmBeat && (
                <div className="conference-callout conference-callout--danger">
                  <span>Prompt injection reached the decision layer</span>
                  <strong>The Baseline run&rsquo;s own trace shows the untrusted instruction changed what the agent attempted next.</strong>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="conference-beat">
              <div className="conference-beat__heading">
                <div><Signal tone="danger">Sensitive tool boundary</Signal><h1 className="display-type">The agent attempts to turn the instruction into action.</h1></div>
                <p>The key event is not that the model produced text. It attempted to use employee-granted tools to move protected data — read from this run&rsquo;s own trace.</p>
              </div>
              <div className="conference-tools">
                {!ready && <article><Bot size={21} color={C.agent} aria-hidden="true" /><span>Running</span><strong>Executing the Baseline assessment&hellip;</strong></article>}
                {ready && toolBeats.length === 0 && <article><Bot size={21} color={C.agent} aria-hidden="true" /><span>Recorded</span><strong>No tool call was attempted in this run.</strong></article>}
                {ready && toolBeats.map(beat => (
                  <article key={beat.key} className={beat.status === 'denied' ? 'conference-tools--held' : beat.tone === 'alarm' ? 'conference-tools--danger' : ''}>
                    {beat.status === 'denied'
                      ? <ShieldCheck size={21} color={C.signal} aria-hidden="true" />
                      : beat.tone === 'alarm'
                        ? <FileText size={21} color={C.attack} aria-hidden="true" />
                        : <Bot size={21} color={C.agent} aria-hidden="true" />}
                    <span>{beat.trusted ? 'Authorized instruction' : 'Untrusted instruction'}</span>
                    <strong>{beatLine(beat)}</strong>
                    <small>{beat.detail ? beat.detail : beat.status === 'denied' ? 'Denied by this profile&rsquo;s controls' : 'Simulated effect only'}</small>
                  </article>
                ))}
              </div>
              {ready && (
                <div className="conference-callout conference-callout--danger">
                  <span>Boundary reached</span>
                  <strong>{effectSummary(baseline)}</strong>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="conference-beat">
              <div className="conference-beat__heading">
                <div><Signal tone="held">Recorded outcome</Signal><h1 className="display-type">Two profiles, the same script, two real verdicts.</h1></div>
                <p>Whether damage occurs depends on controls around the agent — not on the employee noticing hidden text. Both columns are computed runs, not narration.</p>
              </div>
              {!readyForComparison ? (
                <div className="conference-callout"><span>Running</span><strong>Executing the comparison run&hellip;</strong></div>
              ) : (
                <div className="conference-comparison">
                  <article className="conference-outcome conference-outcome--fail" style={{ borderTopColor: getVerdictColor(baseline.verdict?.verdict, C) }}>
                    <span style={{ color: getVerdictColor(baseline.verdict?.verdict, C) }}>Baseline profile</span>
                    <h2 style={{ color: getVerdictColor(baseline.verdict?.verdict, C) }}>{getVerdictLabel(baseline.verdict?.verdict)}</h2>
                    <p>{effectSummary(baseline)}</p>
                  </article>
                  <article className="conference-outcome conference-outcome--held" style={{ borderTopColor: getVerdictColor(comparison.verdict?.verdict, C) }}>
                    <span style={{ color: getVerdictColor(comparison.verdict?.verdict, C) }}>Reference profile</span>
                    <h2 style={{ color: getVerdictColor(comparison.verdict?.verdict, C) }}>{getVerdictLabel(comparison.verdict?.verdict)}</h2>
                    <p>{effectSummary(comparison)}</p>
                  </article>
                </div>
              )}
              <div className="conference-takeaway">
                <span>What Sleeper demonstrates</span>
                <p>Agents used by employees can be misled by instructions hidden in emails, documents, and tool results. Sleeper traces that influence from retrieved content to model decision to attempted action, against both profiles above — not a script written in advance.</p>
              </div>
            </div>
          )}

          <footer className="conference-controls">
            <button className="conference-button conference-button--secondary" onClick={previous}><ArrowLeft size={18} aria-hidden="true" /> Previous</button>
            <div><span>{BEATS[active].number}</span><p>{BEATS[active].label}</p></div>
            {step < 5 ? (
              <button className="conference-button conference-button--primary" onClick={next}>Next: {BEATS[active + 1].short} <ArrowRight size={18} aria-hidden="true" /></button>
            ) : (
              <div className="conference-controls__finish">
                <button className="conference-button conference-button--secondary" onClick={() => setStep(0)}><RotateCcw size={18} aria-hidden="true" /> Replay</button>
                <button className="conference-button conference-button--primary" onClick={onScene} disabled={!ready}>Inspect the recorded run <ArrowRight size={18} aria-hidden="true" /></button>
              </div>
            )}
          </footer>
        </section>
      )}
    </main>
  );
}
