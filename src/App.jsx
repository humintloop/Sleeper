import { useState } from 'react';
import ConferenceStory from './components/ConferenceStory';
import SceneWalkthrough from './components/SceneWalkthrough';
import McpDescriptorScene from './components/McpDescriptorScene';
import McpMarketplaceScene from './components/McpMarketplaceScene';
import AgentCaseRunner from './components/AgentCaseRunner';
import { MCP_DESCRIPTOR_CASE_ID } from './data/mcpDescriptorScene';
import { MCP_MARKETPLACE_CASE_ID } from './data/mcpMarketplaceScene';

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
  signal:   '#B8F12B',
  signalStrong: '#C5FF36',
  signalBg: 'rgba(184,241,43,.08)',
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
  // Was #FF5A52 — 3.1° of hue from CONTROL_FAILED red (#DC4838, 5.9°), close
  // enough to read as the same claim next to a real verdict. Every reserved
  // verdict hue (red 5.9°, ochre 40.3°, green 138.3°, slate 220.4°) covers
  // most of the wheel; the only arc 60°+ from all four is violet/magenta
  // territory (~280-306°). Landed on 300° — matched to red's own lightness
  // and saturation (0.54L/0.70S) so it carries the same tonal weight, and
  // still 46.8° from the existing `violet` technique-accent token.
  attack:   '#E03EE0', // untrusted instruction / hostile influence
  attackBg: 'rgba(224,62,224,.10)',
  agent:    '#73D7E8', // model / agent decision layer
  agentBg:  'rgba(115,215,232,.09)',

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
// Three or five now, and they are a narrative in that order — consequence,
// then how, then proof. HOME is the conference story: a five-beat explanation
// of how untrusted content changes an employee agent's behavior. SCENE plays
// case 1's run in the interface it would have happened in; MCP_DESCRIPTOR_SCENE
// and MCP_MARKETPLACE_SCENE do the same for cases 3a and 3b, each in its own
// visual metaphor (a tool registry, a marketplace listing) rather than a
// second copy of the inbox. AGENT_LAB is the evidence, unchanged. A reader who
// already believes the premise skips straight to the lab, and the lab itself
// offers a way into whichever scene matches the case currently selected —
// reachable without ever passing through Home. Each screen owns its own back
// navigation, so there is no persistent header/stage rail to coordinate
// between them.
const STAGE = {
  HOME: 'home',
  SCENE: 'scene',
  MCP_DESCRIPTOR_SCENE: 'mcp_descriptor_scene',
  MCP_MARKETPLACE_SCENE: 'mcp_marketplace_scene',
  AGENT_LAB: 'agent_lab',
};

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
      .display-type { font-stretch: 72%; font-variation-settings: "wdth" 72, "opsz" 44; }
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
      .rail-brand { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
      /* SleeperBrand sets width/display inline (it merges a caller \`style\`
         prop, but nothing is passed here), so overriding either from a
         breakpoint needs !important — same reason .scene-grid/.agent-runner
         below already do, not a new pattern. */
      .rail-brand-wordmark { width: 210px !important; max-width: 100%; }
      .incident-main { min-width: 0; padding: 12px 18px 30px 0; display: flex; flex-direction: column; }
      .incident-masthead { min-height: 62px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 14px; border-bottom: 1px solid ${C.border}; }
      /* Was a two-column grid (a giant ghost "001" numeral in the first
         track, content in the second) — the numeral didn't tie to anything a
         reader could see and was dropped as part of toning down the home
         screen. .incident-content is the only child now, so this is plain
         block flow rather than a grid. */
      .incident-sheet { flex: 1; padding: 42px 0 0; }
      .incident-content { min-width: 0; display: flex; flex-direction: column; }
      .incident-headline { font-size: clamp(42px, 4.8vw, 68px); line-height: 1.01; font-weight: 790; letter-spacing: -.028em; text-transform: uppercase; margin: 24px 0 20px; max-width: 780px; }
      .incident-facts { margin-top: 22px; }
      .incident-fact { display: grid; grid-template-columns: 28px minmax(130px, .45fr) minmax(0, 1fr); gap: 18px; align-items: center; min-height: 68px; border-bottom: 1px solid ${C.border}; }
      .incident-fact:last-child { border-bottom: none; }
      .incident-actions { display: grid; grid-template-columns: 1.06fr 1fr; gap: 18px; margin-top: 20px; }
      .field-button { min-height: 58px; padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-radius: 0; cursor: pointer; font-size: ${C.size.body}px; font-weight: 720; letter-spacing: 0; text-transform: none; }
      .lab-masthead { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding-bottom: 14px; border-bottom: 1px solid ${C.border}; }

      /* Conference-first story mode. Color is semantic: red is hostile
         influence, cyan is agent behavior, and brand green is defense/evidence. */
      .conference-shell { width: min(100%, 1500px); min-height: 100%; margin: 0 auto; padding: 0 34px 42px; }
      .conference-masthead { min-height: 76px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 24px; border-bottom: 1px solid ${C.border}; }
      .conference-brand { padding: 0; border: 0; background: transparent; cursor: pointer; }
      .conference-masthead__context { padding-left: 24px; border-left: 1px solid ${C.borderHi}; color: ${C.text2}; font-size: ${C.size.small}px; }
      .conference-masthead__actions { display: flex; align-items: center; gap: 17px; color: ${C.text3}; font-family: ${C.mono}; font-size: ${C.size.micro}px; text-transform: uppercase; letter-spacing: .08em; }
      .conference-masthead__actions button { min-height: 36px; padding: 7px 12px; border: 1px solid ${C.borderHi}; border-radius: ${C.radius}px; background: transparent; color: ${C.text1}; cursor: pointer; font-size: ${C.size.small}px; font-weight: 720; }
      .conference-opening__meta { display: flex; border-bottom: 1px solid ${C.border}; color: ${C.text3}; font: ${C.size.micro}px ${C.mono}; letter-spacing: .1em; text-transform: uppercase; }
      .conference-opening__meta span { padding: 12px 18px; border-right: 1px solid ${C.border}; }
      .conference-opening__meta span:first-child { padding-left: 0; color: ${C.text2}; }
      .conference-opening__grid { min-height: 610px; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, .65fr); gap: clamp(54px, 7vw, 110px); align-items: center; padding: 58px 0 45px; }
      .conference-opening__copy h1 { max-width: 900px; margin: 22px 0 26px; font-size: clamp(64px, 7.3vw, 112px); font-weight: 850; line-height: .85; letter-spacing: -.052em; text-transform: uppercase; text-wrap: balance; }
      .conference-opening__copy > p { max-width: 760px; margin: 0; color: ${C.text2}; font-size: clamp(19px, 1.7vw, 25px); line-height: 1.48; }
      .conference-opening__actions { display: flex; gap: 12px; margin-top: 35px; }
      .conference-opening__copy > small { display: block; margin-top: 15px; color: ${C.text3}; font-family: ${C.mono}; font-size: ${C.size.micro}px; }
      .conference-button { min-height: 50px; display: inline-flex; align-items: center; justify-content: center; gap: 12px; padding: 12px 20px; border-radius: ${C.radius}px; cursor: pointer; font-size: ${C.size.body}px; font-weight: 760; }
      .conference-button--primary { border: 1px solid ${C.signal}; background: ${C.signal}; color: ${C.ink}; }
      .conference-button--secondary { border: 1px solid ${C.borderHi}; background: transparent; color: ${C.text1}; }
      .conference-thesis { padding: 29px; border: 1px solid ${C.borderHi}; background: ${C.panel}; }
      .conference-thesis > span { display: block; padding-bottom: 16px; border-bottom: 1px solid ${C.border}; color: ${C.text3}; font: ${C.size.micro}px ${C.mono}; letter-spacing: .14em; text-transform: uppercase; }
      .conference-thesis p { margin: 0; padding: 18px 0; border-bottom: 1px solid ${C.border}; color: ${C.text2}; font-size: ${C.size.body}px; }
      .conference-thesis .conference-thesis__danger { color: ${C.attack}; }
      .conference-thesis strong { display: block; margin-top: 22px; color: ${C.text1}; font-size: ${C.size.body}px; line-height: 1.55; }
      .conference-signal { display: inline-flex; width: fit-content; padding: 6px 9px; border: 1px solid currentColor; border-radius: ${C.radius}px; font: 760 ${C.size.micro}px ${C.mono}; letter-spacing: .11em; text-transform: uppercase; }
      .conference-signal--danger { color: ${C.attack}; }
      .conference-signal--agent { color: ${C.agent}; }
      .conference-signal--held { color: ${C.signal}; }
      .conference-signal--trusted { color: ${C.text1}; }
      .conference-progress { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border-top: 1px solid ${C.borderHi}; border-bottom: 1px solid ${C.border}; }
      .conference-progress button { min-height: 72px; display: grid; grid-template-columns: 28px 1fr; grid-template-rows: auto auto; column-gap: 9px; align-content: center; padding: 11px 15px; border: 0; border-right: 1px solid ${C.border}; background: transparent; color: ${C.text1}; text-align: left; cursor: pointer; }
      .conference-progress button:last-child { border-right: 0; }
      .conference-progress button:hover { background: ${C.surface}; }
      .conference-progress button > span { grid-row: 1 / 3; align-self: center; color: ${C.text3}; font: ${C.size.micro}px ${C.mono}; }
      .conference-progress strong { font-size: ${C.size.small}px; }
      .conference-progress small { color: ${C.text3}; font-size: ${C.size.micro}px; }
      .conference-progress__active { background: ${C.surface} !important; box-shadow: inset 0 -3px 0 ${C.text1}; }
      .conference-scene__counter { display: flex; justify-content: space-between; padding: 18px 0 0; color: ${C.text3}; font: ${C.size.micro}px ${C.mono}; letter-spacing: .1em; text-transform: uppercase; }
      .conference-beat { min-height: 570px; padding: 36px 0 30px; animation: fadeUp .28s ease-out; }
      .conference-beat__heading { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(300px, .75fr); gap: 58px; align-items: end; margin-bottom: 40px; }
      .conference-beat__heading h1 { max-width: 880px; margin: 16px 0 0; font-size: clamp(48px, 5.4vw, 80px); font-weight: 830; line-height: .91; letter-spacing: -.045em; text-transform: uppercase; text-wrap: balance; }
      .conference-beat__heading > p { margin: 0; color: ${C.text2}; font-size: ${C.size.head}px; line-height: 1.6; }
      .conference-actors { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      .conference-actor { min-height: 245px; display: flex; flex-direction: column; padding: 27px; border: 1px solid ${C.borderHi}; background: ${C.panel}; }
      .conference-actor--employee { border-top: 3px solid ${C.text1}; }
      .conference-actor--agent { border-top: 3px solid ${C.agent}; background: ${C.agentBg}; }
      .conference-actor > div { display: flex; align-items: flex-start; gap: 12px; }
      .conference-actor > div span { display: flex; flex-direction: column; }
      .conference-actor > div strong { font-size: ${C.size.head}px; }
      .conference-actor > div small { color: ${C.text3}; font-size: ${C.size.small}px; }
      .conference-actor blockquote { max-width: 33ch; margin: auto 0 0; color: ${C.text1}; font-size: clamp(22px, 2.1vw, 32px); font-weight: 650; line-height: 1.3; }
      .conference-actor > p { max-width: 38ch; margin: auto 0 22px; color: ${C.text2}; font-size: ${C.size.head}px; line-height: 1.45; }
      .conference-email { max-width: 1110px; margin: 0 auto; padding: 28px 32px 32px; border: 1px solid ${C.borderHi}; background: ${C.panel}; }
      .conference-email__meta { display: grid; grid-template-columns: 1fr 2fr auto; gap: 20px; padding-bottom: 14px; border-bottom: 1px solid ${C.border}; color: ${C.text3}; font: ${C.size.micro}px ${C.mono}; text-transform: uppercase; }
      .conference-email__meta span:first-child { display: flex; align-items: center; gap: 8px; color: ${C.text2}; }
      .conference-email h2 { margin: 29px 0 11px; font-size: 30px; }
      .conference-email > p { color: ${C.text2}; font-size: 17px; line-height: 1.6; }
      .conference-injection { margin-top: 34px; padding: 22px 24px; border: 1px solid rgba(255,90,82,.56); border-left: 5px solid ${C.attack}; background: ${C.attackBg}; }
      .conference-injection span { display: block; margin-bottom: 12px; color: ${C.attack}; font: 780 ${C.size.micro}px ${C.mono}; letter-spacing: .12em; text-transform: uppercase; }
      .conference-injection strong { display: block; max-width: 70ch; color: #FFD2CE; font-size: 19px; line-height: 1.5; }
      .conference-context { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      .conference-context article { min-height: 205px; display: flex; flex-direction: column; padding: 24px; border: 1px solid ${C.borderHi}; background: ${C.panel}; }
      .conference-context article > span:first-child { color: ${C.text3}; font: ${C.size.micro}px ${C.mono}; letter-spacing: .08em; text-transform: uppercase; }
      .conference-context article > strong { margin: 33px 0 25px; font-size: ${C.size.head}px; line-height: 1.42; }
      .conference-context article .conference-signal { margin-top: auto; }
      .conference-context .conference-context--danger { border-color: rgba(255,90,82,.5); background: ${C.attackBg}; }
      .conference-context .conference-context--agent { border-color: rgba(115,215,232,.5); background: ${C.agentBg}; }
      .conference-callout { display: grid; grid-template-columns: 245px 1fr; gap: 24px; align-items: center; margin-top: 18px; padding: 18px 21px; border: 1px solid rgba(255,90,82,.45); background: ${C.attackBg}; }
      .conference-callout span { color: ${C.attack}; font: ${C.size.micro}px ${C.mono}; letter-spacing: .08em; text-transform: uppercase; }
      .conference-callout strong { font-size: ${C.size.body}px; }
      .conference-tools { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
      .conference-tools article { min-height: 190px; display: flex; flex-direction: column; padding: 22px; border: 1px solid ${C.borderHi}; background: ${C.panel}; }
      .conference-tools article > span { margin-top: 11px; color: ${C.text3}; font: ${C.size.micro}px ${C.mono}; letter-spacing: .08em; text-transform: uppercase; }
      .conference-tools article > strong { margin-top: auto; font-size: ${C.size.head}px; line-height: 1.35; }
      .conference-tools article > small { margin-top: 7px; color: ${C.text3}; font-size: ${C.size.small}px; }
      .conference-tools .conference-tools--danger { border-color: rgba(255,90,82,.4); }
      .conference-tools .conference-tools--held { border-color: rgba(184,241,43,.5); background: ${C.signalBg}; }
      .conference-comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
      .conference-outcome { min-height: 235px; display: flex; flex-direction: column; padding: 27px; border: 1px solid ${C.borderHi}; background: ${C.panel}; }
      .conference-outcome > span { font: ${C.size.micro}px ${C.mono}; letter-spacing: .08em; text-transform: uppercase; }
      .conference-outcome h2 { margin: 27px 0 9px; font-size: 34px; line-height: 1; text-transform: uppercase; }
      .conference-outcome p { max-width: 57ch; margin: 0; color: ${C.text2}; font-size: ${C.size.body}px; line-height: 1.55; }
      .conference-outcome > strong { margin-top: auto; padding-top: 22px; font-size: ${C.size.small}px; text-transform: uppercase; }
      .conference-outcome--fail { border-top: 4px solid ${C.attack}; background: ${C.attackBg}; }
      .conference-outcome--fail > span, .conference-outcome--fail > strong { color: ${C.attack}; }
      .conference-outcome--held { border-top: 4px solid ${C.signal}; background: ${C.signalBg}; }
      .conference-outcome--held > span, .conference-outcome--held > strong { color: ${C.signal}; }
      .conference-takeaway { display: grid; grid-template-columns: 230px 1fr; gap: 28px; align-items: start; margin-top: 18px; padding: 21px 23px; border: 1px solid ${C.border}; }
      .conference-takeaway > span { color: ${C.text3}; font: ${C.size.micro}px ${C.mono}; letter-spacing: .1em; text-transform: uppercase; }
      .conference-takeaway p { max-width: 82ch; margin: 0; color: ${C.text2}; font-size: ${C.size.body}px; line-height: 1.6; }
      .conference-controls { min-height: 78px; display: grid; grid-template-columns: 1fr auto 1fr; gap: 26px; align-items: center; border-top: 1px solid ${C.borderHi}; }
      .conference-controls > button:last-child, .conference-controls__finish { justify-self: end; }
      .conference-controls > div:not(.conference-controls__finish) { display: flex; align-items: baseline; gap: 10px; }
      .conference-controls > div > span { color: ${C.text3}; font-family: ${C.mono}; font-size: ${C.size.micro}px; }
      .conference-controls > div > p { margin: 0; color: ${C.text2}; font-size: ${C.size.small}px; }
      .conference-controls__finish { display: flex; gap: 10px; }

      /* McpDescriptorScene / McpMarketplaceScene — the two MCP-case scenes.
         Share .scene's outer scroll treatment and .lab-masthead, but need
         their own inner layout: a two-column registry panel for 003A, a
         chip/badge vocabulary both reuse. */
      .mcp-registry-grid { display: grid; grid-template-columns: minmax(200px, 260px) minmax(0, 1fr); }
      .mcp-chip { display: inline-flex; align-items: center; font-size: ${C.size.micro}px; padding: 2px 8px; border: 1px solid; border-radius: ${C.radius}px; white-space: nowrap; }
      .mcp-listing-card { border: 1px solid ${C.borderHi}; border-radius: ${C.radius}px; background: ${C.panel}; padding: 14px 16px; }

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
        .mcp-registry-grid { grid-template-columns: minmax(0, 1fr) !important; }
        .mcp-registry-grid > * { border-right: none !important; border-bottom: 1px solid ${C.border}; }
        .conference-opening__grid, .conference-beat__heading { grid-template-columns: 1fr; }
        .conference-opening__grid { min-height: 0; gap: 40px; }
        .conference-context { grid-template-columns: 1fr; }
        .conference-tools { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 760px) {
        .incident-home { padding: 8px; }
        .incident-rail { border-left: 3px solid ${C.signal}; }
        .incident-sheet { padding-top: 28px; }
        .incident-headline { font-size: clamp(34px, 10vw, 44px); max-width: 96%; }
        .incident-fact { grid-template-columns: 24px 1fr; gap: 12px; padding: 13px 0; }
        .incident-fact > :last-child { grid-column: 2; }
        .incident-actions { grid-template-columns: 1fr; order: 1; margin-top: 18px; }
        .incident-facts { order: 2; margin-top: 24px; }
        .incident-provenance { order: 3; }
        .incident-about { order: 4; }
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
        .scene-inbox { display: none !important; }
        .runner-intro p { max-width: 34rem !important; }
        .runner-jump { margin-top: -4px; }
        .runner-jump--compact { display: none !important; }
        .workspace-tabs { position: sticky; top: -20px; z-index: 5; background: ${C.bg}; padding-top: 10px; }
        .agent-runner { padding: 20px 16px 48px !important; gap: 16px !important; }
        .scene { padding: 20px 16px 48px !important; }
        .conference-shell { padding: 0 14px 32px; }
        .conference-masthead { min-height: 64px; grid-template-columns: 1fr auto; }
        .conference-masthead__context, .conference-masthead__actions > span { display: none; }
        .conference-opening__meta span:nth-child(2) { display: none; }
        .conference-opening__grid { padding: 42px 0 34px; }
        .conference-opening__copy h1 { font-size: 53px; }
        .conference-opening__actions { flex-direction: column; }
        .conference-progress { overflow-x: auto; grid-template-columns: repeat(5, minmax(130px, 1fr)); }
        .conference-progress button { min-height: 62px; padding: 9px; }
        .conference-beat { min-height: 0; }
        .conference-beat__heading { gap: 22px; margin-bottom: 28px; }
        .conference-beat__heading h1 { font-size: 43px; }
        .conference-beat__heading > p { font-size: ${C.size.body}px; }
        .conference-actors, .conference-comparison, .conference-tools { grid-template-columns: 1fr; }
        .conference-email { padding: 20px; }
        .conference-email__meta { grid-template-columns: 1fr; }
        .conference-callout, .conference-takeaway { grid-template-columns: 1fr; }
        .conference-controls { grid-template-columns: 1fr 1fr; padding-top: 16px; }
        .conference-controls > div:not(.conference-controls__finish) { display: none; }
        .conference-controls__finish { grid-column: 1 / -1; width: 100%; display: grid; grid-template-columns: 1fr; }
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
          <ConferenceStory
            C={C}
            onScene={() => setStage(STAGE.SCENE)}
            onAgentLab={() => { setHandoff(null); setStage(STAGE.AGENT_LAB); }}
          />
        )}

        {stage === STAGE.SCENE && (
          <SceneWalkthrough
            C={C}
            onHome={() => setStage(STAGE.HOME)}
            onEvidence={outcome => { setHandoff(outcome); setStage(STAGE.AGENT_LAB); }}
          />
        )}

        {stage === STAGE.MCP_DESCRIPTOR_SCENE && (
          <McpDescriptorScene
            C={C}
            onHome={() => setStage(STAGE.HOME)}
            onEvidence={outcome => { setHandoff(outcome); setStage(STAGE.AGENT_LAB); }}
          />
        )}

        {stage === STAGE.MCP_MARKETPLACE_SCENE && (
          <McpMarketplaceScene
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
            onWatchScene={caseId => {
              setHandoff(null);
              if (caseId === MCP_DESCRIPTOR_CASE_ID) setStage(STAGE.MCP_DESCRIPTOR_SCENE);
              else if (caseId === MCP_MARKETPLACE_CASE_ID) setStage(STAGE.MCP_MARKETPLACE_SCENE);
              else setStage(STAGE.SCENE);
            }}
          />
        )}
      </div>
    </div>
  );
}
