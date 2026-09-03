import { useState } from 'react';
import IncidentMemoHome from './components/IncidentMemoHome';
import SceneWalkthrough from './components/SceneWalkthrough';
import AgentCaseRunner from './components/AgentCaseRunner';
import { loadAgentRuns } from './storage';

// ── Design tokens ─────────────────────────────────────────────────────────────
// Dark field-manual direction. `signal` is the brand/interaction color; verdict colors
// remain independent so a green control hold can never be confused with ordinary chrome.
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
  bg:       '#050706', // canvas
  panel:    '#0C0F0C', // raised
  surface:  '#141814', // raised, slightly lighter (form fields, nested content)
  hover:    '#1B211A', // hover state over a raised surface
  ink:      '#030403', // inset (code/JSON blocks)
  // Quiet divider: section rules and the edges of non-interactive cards. It is
  // 1.30:1 on panel and exempt from WCAG 1.4.11 as decoration — which means it
  // must never be the only signal that something is selectable. Interactive
  // boundaries use `borderHi`.
  border:   '#2A2F29',
  // Default interactive-component boundary. Was #3A3A37 (1.74:1 against
  // panel — fails WCAG 1.4.11's 3:1 non-text threshold, measured in
  // docs/accessibility-audit.md) — used on a large number of actually-
  // interactive elements (case/profile/target cards), not merely decorative
  // dividers. Same warm-neutral hue, lightened to 3.38–3.54:1 against every
  // surface token above.
  borderHi: '#6A7165',

  // Text — primary → secondary → muted. (No separate "inverse" tone exists;
  // nothing in this app renders dark text on a light surface.)
  text1:    '#EEE9DC', // primary
  text2:    '#C4BEB0', // secondary
  text3:    '#969589', // muted — calibrated for contrast against panel/surface

  // Interaction — brand/accent, never a verdict. Wordmark, active nav/tab
  // state, primary CTA, focus rings. Keeps amber free to stay a pure
  // reserved verdict color instead of double-booked as brand chrome.
  signal:   '#A8C943',
  signalStrong: '#B8D94F',
  signalBg: 'rgba(168,201,67,.10)',
  // Compatibility aliases for existing presentation components. Security
  // semantics never read these values; new UI should use `signal` directly.
  brass:    '#A8C943',
  brassBg:  'rgba(168,201,67,.10)',

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
  mono:     '"SFMono-Regular", "Roboto Mono", ui-monospace, monospace',
  sans:     '"Roboto Flex Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',

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
      body { margin: 0; background: ${C.bg}; }
      ::selection { background: ${C.signal}; color: ${C.ink}; }
      select, button, input, textarea { font-family: ${C.sans}; }
      input:focus, textarea:focus, select:focus { outline: none; border-color: ${C.signal} !important; box-shadow: 0 0 0 1px rgba(168,201,67,.28); }
      button:focus-visible, a:focus-visible, [role="button"]:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${C.signal}; outline-offset: 3px; }
      button:hover:not(:disabled) { filter: brightness(1.08); }
      input::placeholder, textarea::placeholder { color: ${C.text3}; }
      @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse { 0%,100% { opacity: .55; transform: scale(.9); } 50% { opacity: 1; transform: scale(1.25); } }
      @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      button, a, select { touch-action: manipulation; }
      .display-type { font-stretch: 64%; font-variation-settings: "wdth" 64, "opsz" 48; }
      .brand-kicker { font-family: ${C.mono}; font-size: ${C.size.micro}px; letter-spacing: .18em; text-transform: uppercase; }
      .incident-home { width: 100%; max-width: 1500px; margin: 0 auto; min-height: 100%; padding: 12px; display: grid; grid-template-columns: minmax(240px, 300px) minmax(0, 1fr); gap: 34px; }
      .incident-rail { min-height: calc(100dvh - 24px); border: 1px solid ${C.border}; padding: 34px 30px 28px; display: flex; flex-direction: column; background: ${C.bg}; }
      /* Was inline-styled directly on the rail's first child, which meant the
         980px rule below (".incident-rail { flex-direction: row }") had no
         effect: with both ".rail-detail" blocks hidden at that width, this was
         the ONLY visible child, and its own inline column layout is what
         actually rendered — the icon mark stacked over the full wordmark
         stacked over the caption, eating most of a phone screen before the
         headline appeared. Given its own class so the breakpoints below can
         reach it. */
      .rail-brand { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
      /* SleeperBrand sets width/display inline (it merges a caller \`style\`
         prop, but nothing is passed here), so overriding either from a
         breakpoint needs !important — same reason .scene-grid/.agent-runner
         below already do, not a new pattern. */
      .rail-brand-wordmark { width: 230px !important; max-width: 100%; }
      .incident-main { min-width: 0; padding: 12px 18px 30px 0; display: flex; flex-direction: column; }
      .incident-masthead { min-height: 62px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 14px; border-bottom: 1px solid ${C.border}; }
      /* Was a two-column grid (a giant ghost "001" numeral in the first
         track, content in the second) — the numeral didn't tie to anything a
         reader could see and was dropped as part of toning down the home
         screen. .incident-content is the only child now, so this is plain
         block flow rather than a grid. */
      .incident-sheet { flex: 1; padding: 42px 0 0; }
      .incident-content { min-width: 0; display: flex; flex-direction: column; }
      .incident-headline { font-size: clamp(44px, 5.4vw, 78px); line-height: .99; font-weight: 860; letter-spacing: -.035em; text-transform: uppercase; margin: 24px 0 20px; max-width: 850px; }
      .incident-facts { border-top: 1px solid ${C.border}; margin-top: 22px; }
      .incident-fact { display: grid; grid-template-columns: 28px minmax(130px, .45fr) minmax(0, 1fr); gap: 18px; align-items: center; min-height: 72px; border-bottom: 1px solid ${C.border}; }
      .incident-actions { display: grid; grid-template-columns: 1.06fr 1fr; gap: 18px; margin-top: 20px; }
      .field-button { min-height: 70px; padding: 14px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-radius: 0; cursor: pointer; font-size: ${C.size.head}px; font-weight: 800; font-stretch: 72%; letter-spacing: .025em; text-transform: uppercase; }
      .lab-masthead { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding-bottom: 14px; border-bottom: 1px solid ${C.border}; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
      }
      @media (max-width: 980px) {
        .incident-home { grid-template-columns: 1fr; gap: 18px; }
        .incident-rail { min-height: auto; padding: 18px 20px; flex-direction: row; align-items: center; gap: 18px; }
        .incident-rail .rail-detail { display: none; }
        /* Collapse to the same compact single-lockup row the runner and scene
           mastheads already use, instead of the two full-size logos stacked. */
        .rail-brand { flex-direction: row; align-items: center; gap: 14px; }
        .rail-brand-mark { display: none !important; }
        .rail-brand-rule { display: none; }
        .rail-brand-wordmark { width: 168px !important; }
        .incident-main { padding: 0 12px 32px; }
        .scene-grid { grid-template-columns: minmax(0, 1fr) !important; }
        .scene-grid > * { border-right: none !important; }
      }
      @media (max-width: 760px) {
        .incident-home { padding: 8px; }
        .incident-rail { border-left: 3px solid ${C.signal}; }
        .incident-sheet { padding-top: 28px; }
        .incident-headline { font-size: clamp(38px, 12vw, 56px); max-width: 92%; }
        .incident-fact { grid-template-columns: 24px 1fr; gap: 12px; padding: 13px 0; }
        .incident-fact > :last-child { grid-column: 2; }
        .incident-actions { grid-template-columns: 1fr; }
        .field-button { min-height: 58px; font-size: ${C.size.body}px; }
        .incident-masthead > :last-child { display: none; }
        /* Was clipped at the viewport edge (nowrap, no truncation) rather than
           overflowing the page — same fix as the other masthead kicker above. */
        .masthead-tagline { display: none; }
        .lab-masthead { align-items: flex-start; }
        /* Same nowrap-clips-at-the-edge shape as .masthead-tagline above, on
           the runner/scene mastheads: "LIVE INCIDENT REPLAY" and "EVIDENCE
           WORKSPACE" wrapped to 2-3 ragged lines against the logo and the
           HOME/back link on a phone, instead of clipping cleanly. Hide it —
           the wordmark alone still says what app this is. */
        .lab-masthead-tagline { display: none; }
        /* No room beside a 168px wordmark on a phone; the wordmark alone
           still carries the identity at this width. */
        .rail-brand-caption { display: none; }
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
