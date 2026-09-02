import { useState } from 'react';
import IncidentMemoHome from './components/IncidentMemoHome';
import SceneWalkthrough from './components/SceneWalkthrough';
import AgentCaseRunner from './components/AgentCaseRunner';
import { loadAgentRuns } from './storage';

// ── Design tokens ─────────────────────────────────────────────────────────────
// Obsidian Briefing / "Forensic Dossier" direction. Neutrals sit on a near-black/bone
// palette calibrated against Offensive AI Con's own branding — restrained monochrome,
// architectural rather than glowing — and `brass` takes over the brand/interactive role
// amber used to carry solo, so amber can stay a pure verdict color. Don't drop text3 or
// slate into running body copy; both are calibrated for contrast against the dark panel.
//
// Grouped by semantic role per docs/phase-3 handoff guidance ("add or consolidate
// semantic tokens before component-by-component restyling"). Key names are unchanged
// from before this grouping — every existing `C.xxx` call site keeps working — this
// pass adds the taxonomy and fixes one measured defect (borderHi contrast, below); it
// does not migrate the whole app to new token names or rewrite component layout. That
// broader restyling (fewer nested cards, quieter dividers before boxes) is real,
// larger, more subjective follow-on work — see docs/accessibility-audit.md for what
// was and wasn't done in this pass.
const C = {
  // Surfaces — canvas → raised → inset, darkest to least-dark.
  //
  // The elevation ramp was widened on 2026-09-02. The previous values
  // (panel #0A0A09, surface #0D0D0C) sat ~3 points of luminance above the
  // canvas — a 1.03:1 surface-to-surface ratio, which is not perceptible on
  // a projector and made every bordered panel read as a floating outline on
  // flat black rather than as a raised plane. The ramp below is ~1.09:1
  // canvas→raised and ~1.06:1 raised→inset-content, which is visible without
  // turning the app grey. Every text and boundary token was re-measured
  // against the new surfaces (see docs/accessibility-audit.md):
  //   text3 #8B877A  → 5.22:1 on panel, 4.90:1 on surface (AA normal text)
  //   borderHi #666663 → 3.25:1 on panel, 3.06:1 on surface (WCAG 1.4.11)
  bg:       '#050505', // canvas
  panel:    '#121211', // raised
  surface:  '#191917', // raised, slightly lighter (form fields, nested content)
  hover:    '#212119', // hover state over a raised surface
  ink:      '#050505', // inset (code/JSON blocks) — same value as canvas, named for role not reuse
  // Quiet divider: section rules and the edges of non-interactive cards. It is
  // 1.30:1 on panel and exempt from WCAG 1.4.11 as decoration — which means it
  // must never be the only signal that something is selectable. Interactive
  // boundaries use `borderHi`.
  border:   '#2A2A27',
  // Default interactive-component boundary. Was #3A3A37 (1.74:1 against
  // panel — fails WCAG 1.4.11's 3:1 non-text threshold, measured in
  // docs/accessibility-audit.md) — used on a large number of actually-
  // interactive elements (case/profile/target cards), not merely decorative
  // dividers. Same warm-neutral hue, lightened to 3.38–3.54:1 against every
  // surface token above.
  borderHi: '#666663',

  // Text — primary → secondary → muted. (No separate "inverse" tone exists;
  // nothing in this app renders dark text on a light surface.)
  text1:    '#F4F2EA', // primary
  text2:    '#B6B2A4', // secondary
  text3:    '#8B877A', // muted — calibrated for contrast against panel/surface; never drop below this

  // Interaction — brand/accent, never a verdict. Wordmark, active nav/tab
  // state, primary CTA, focus rings. Keeps amber free to stay a pure
  // reserved verdict color instead of double-booked as brand chrome.
  brass:    '#CFC7B0', // accent
  brassBg:  'rgba(207,199,176,.10)', // accent, selected/highlighted background

  // Verdict — reserved exclusively for held/failed/partial/inconclusive/
  // degraded/error semantics (see src/components/VerdictBanner.js's
  // verdictDisplay, the single source of truth for verdict → color).
  // Never reused as brand chrome or a technique-category accent.
  red:      '#DC4838', // failed / error
  redDim:   '#743025',
  redBg:    'rgba(220,72,56,.12)',
  teal:     '#00CFC4', // legacy probe-vocabulary FAILURE only — see VerdictBanner
  tealBg:   'rgba(0,207,196,.10)',
  green:    '#4EBA6F', // held
  greenBg:  'rgba(78,186,111,.12)',
  blue:     '#6D8FD6', // legacy probe-vocabulary REVIEW only — see VerdictBanner
  amber:    '#C87844', // legacy probe-vocabulary PARTIAL only — see VerdictBanner
  amberDim: '#82492A',
  orange:   '#D37A36',
  ochre:    '#B99242', // partial control failure / stale / degraded
  amberBg:  'rgba(200,120,68,.13)',
  slate:    '#6B7A99', // inconclusive
  warmDim:  '#C4A07A',
  coolDim:  '#7A9AB5',

  // Technique-category accents — deliberately distinct from every verdict
  // color above so a cluster's color never reads as a
  // SUCCESS/FAILURE/PARTIAL/REVIEW outcome.
  violet:   '#9684D6',
  sand:     '#B99C6B',

  // Typography — Space Grotesk for narrative/interface copy (html base
  // font-size 15px, within the spec'd 15–16px range); Geist Mono reserved
  // for IDs, hashes, event metadata, and code-like values. Checked across
  // every explicit `fontFamily: C.mono` call site in src/components/ — all
  // are digests, reason/verdict codes, framework IDs, or literal JSON/log
  // text, none are narrative prose set in mono.
  mono:     '"Geist Mono", ui-monospace, monospace',
  sans:     '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',

  // Type scale — five steps, and deliberately only five. Before this the app
  // used 9.5/10/10.5/11/11.5/12/12.5/13/14 — nine sizes inside a 4.5px band,
  // where a half-pixel "step" is hierarchy the reader cannot actually see and
  // the author still has to maintain. Each step below is a ≥18% jump, which
  // reads as a level. Anything smaller than `micro` is not a size, it is a
  // rounding error; anything between two steps belongs on one of them.
  //
  //   micro — IDs, digests, timestamps, metadata, eyebrow labels
  //   small — dense UI copy, card bodies, controls
  //   body  — narrative prose, the default
  //   head  — panel and card titles
  //   title — screen title, one per screen
  size: {
    micro: 11,
    small: 13,
    body:  15,
    head:  19,
    title: 28,
  },

  // Radii — 2px (near-square, architectural) is the only radius used across
  // every panel/card/button/input in the app today (60+ call sites), with a
  // single deliberate exception (999px, a true pill shape). New code should
  // reference these rather than repeating the literal; existing call sites
  // are not migrated in this pass — see the note at the top of this block.
  radius:     2,
  radiusPill: 999,
};

// ── Stages ────────────────────────────────────────────────────────────────────
// Agent-only: the single-turn probe flow's six other stages
// (CASE/LOADING/SELECT/PROBE/TRIAGE/REPORT) are gone.
//
// Three now, and they are a narrative in that order — consequence, then how,
// then proof. HOME is the incident memo: what happened, for someone deciding
// whether to roll an assistant out. SCENE plays the same run in the interface
// it would have happened in. AGENT_LAB is the evidence, unchanged. A reader
// who already believes the premise skips straight to the lab from the memo,
// and each screen still owns its own back navigation, so there is no
// persistent header/stage rail to coordinate between them.
const STAGE = { HOME: 'home', SCENE: 'scene', AGENT_LAB: 'agent_lab' };

// ═══ Global style ═════════════════════════════════════════════════════════════
function GlobalStyle({ C }) {
  return (
    <style>{`
      html { font-size: 15px; }
      *, *::before, *::after { box-sizing: border-box; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-thumb { background: ${C.borderHi}; border-radius: 999px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::selection { background: ${C.amber}; color: ${C.ink}; }
      select, button, input, textarea { font-family: ${C.mono}; }
      input:focus, textarea:focus, select:focus { outline: none; border-color: ${C.amber} !important; box-shadow: 0 0 0 1px rgba(200,120,68,.24); }
      button:focus-visible, a:focus-visible, [role="button"]:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${C.amber}; outline-offset: 3px; }
      button:hover:not(:disabled) { filter: brightness(1.08); }
      input::placeholder, textarea::placeholder { color: ${C.text3}; }
      @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse { 0%,100% { opacity: .55; transform: scale(.9); } 50% { opacity: 1; transform: scale(1.25); } }
      @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      button, a, select { touch-action: manipulation; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
      }
      @media (max-width: 980px) {
        .scene-grid { grid-template-columns: minmax(0, 1fr) !important; }
        .scene-grid > * { border-right: none !important; }
      }
      @media (max-width: 760px) {
        .home-hero-grid { grid-template-columns: minmax(0, 1fr) !important; }
        .agent-runner { padding: 20px 16px 48px !important; gap: 16px !important; }
        .scene { padding: 20px 16px 48px !important; }
      }
    `}</style>
  );
}

export default function App() {
  const [stage, setStage] = useState(STAGE.HOME);
  // The run the scene produced, handed to the lab so the evidence opens on the
  // very run the visitor just watched rather than on a fresh one that merely
  // resembles it. Null whenever the lab is entered directly.
  const [handoff, setHandoff] = useState(null);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100dvh', height: '100dvh',
      backgroundColor: C.bg,
      // Obsidian background motif — two faint corner-ring layers, texture not
      // decoration. Deliberately low opacity; the app reads as flat until you
      // look for it.
      backgroundImage:
        'repeating-radial-gradient(circle at 100% 0%, transparent 0 42px, rgba(207,199,176,.055) 43px, transparent 44px), '
        + 'repeating-radial-gradient(circle at 0% 100%, transparent 0 60px, rgba(207,199,176,.035) 61px, transparent 62px)',
      color: C.text1, fontFamily: C.sans, lineHeight: 1.5, overflow: 'hidden',
    }}>
      <GlobalStyle C={C} />
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {stage === STAGE.HOME && (
          <IncidentMemoHome
            C={C}
            onScene={() => setStage(STAGE.SCENE)}
            onAgentLab={() => { setHandoff(null); setStage(STAGE.AGENT_LAB); }}
            agentRunsCount={loadAgentRuns().length}
          />
        )}

        {stage === STAGE.SCENE && (
          <SceneWalkthrough
            C={C}
            onHome={() => setStage(STAGE.HOME)}
            onEvidence={outcome => { setHandoff(outcome); setStage(STAGE.AGENT_LAB); }}
          />
        )}

        {stage === STAGE.AGENT_LAB && (
          <AgentCaseRunner
            C={C}
            onHome={() => setStage(STAGE.HOME)}
            // Remounts when a different run arrives, so the runner's initial
            // state genuinely re-seeds from it instead of the handoff being
            // read once and ignored on every later entry.
            key={handoff?.manifestDigest ?? 'direct'}
            handoff={handoff}
          />
        )}
      </div>
    </div>
  );
}
