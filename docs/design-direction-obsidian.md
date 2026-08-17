# NETRUNNER — Visual Direction: "Obsidian Briefing"

Handoff spec for the chosen direction from the six-comp mockup at
`docs/design-mockups/netrunner-directions.html` (`data-theme="d"`). Open that file and click
**D · Obsidian** to see the reference — this doc gives the exact values and the reasoning so an
implementer doesn't have to reverse-engineer them from CSS.

## Why this direction

Calibrated against Offensive AI Con's own branding (dark, minimal, high-contrast white-on-black,
geometric line/spiral dividers, invite-only research-retreat framing — not a hacker-con
aesthetic) rather than a literal "netrunner/cyberpunk" costume look. Restrained monochrome, one
accent color, hairline borders, architectural rather than glowing.

## Scope

**In scope:** neutrals (background/panel/surface/border/text), one new brand accent, corner
radius, the wordmark, nav/button active-state treatment, a subtle background motif, and a
proposal for the not-yet-defined agent-verdict (`CONTROL_*`) color set.

**Out of scope / do not touch:** verdict logic, `computeVerdict.js`, anything in `src/harness/`
or `src/data/`. This is a styling pass over `App.jsx`'s `C` token object and the components in
`src/components/`. If applying this surfaces a place where color is carrying semantic meaning
you're not sure about, stop and ask rather than guess — see "Reserved colors" below.

## Design tokens — diff against the current `C` object in `App.jsx`

**Change these:**

| Token | Current | New (Obsidian) | Usage |
|---|---|---|---|
| `bg` | `#0A0C16` | `#050505` | App background |
| `panel` | `#0D111D` | `#0A0A09` | Section panels |
| `surface` | `#121827` | `#0D0D0C` | Cards, tiles, rows |
| `hover` | `#171E31` | `#15150F` | Hover state fill |
| `border` | `#1C2238` | `#212120` | Default 1px borders |
| `borderHi` | `#313A56` | `#3A3A37` | Emphasized borders, dividers |
| `text1` | `#E6D6C8` | `#F4F2EA` | Primary text (bone/off-white, not warm cream) |
| `text2` | `#8FB8C8` | `#B6B2A4` | Secondary text |
| `text3` | `#8BAFC0` | `#726E62` | Tertiary/label text — see contrast note below |

**Add one new token** — the brand/interactive accent, replacing amber's dual role as both brand
color and a reserved verdict color:

| Token | Value | Usage |
|---|---|---|
| `brass` | `#CFC7B0` | Wordmark, active nav/tab state, primary CTA, focus rings — **interactive only, never a verdict** |

**Leave unchanged:** `red`, `redDim`, `redBg`, `teal`, `tealBg`, `amber`, `amberDim`, `amberBg`,
`blue`, `green`, `greenBg`, `orange`, `ochre`, `violet`, `slate`, `sand`, `warmDim`, `coolDim`,
`ink`, `mono`, `sans`. These are the reserved single-turn probe verdict colors
(SUCCESS/FAILURE/PARTIAL/REVIEW) plus technique-cluster accents. Restyling the shell shouldn't
touch them — CLAUDE.md is explicit that a non-verdict element's color must never read as an
outcome, and re-deriving these hexes risks breaking that on export/report surfaces that already
reference them.

**Corner radius:** 2px everywhere it's currently 4–5px (cards, chips, buttons, panels). This is
an inline-style codebase (`style={{ borderRadius: ... }}` throughout, not CSS classes), so this
is a lot of small find-and-replace edits rather than one token change — worth doing as its own
pass so it's reviewable as a diff.

**Fonts:** keep `mono` (Geist Mono) and `sans` (Space Grotesk) as-is. Drop the separate
`'Rajdhani'` font currently hardcoded into the `h1` wordmark in `DossierHome.jsx` (line ~51) —
it's not declared as a token and reads more "sci-fi gamer" than this direction wants. Use
`C.sans` at weight 600 (not the current 700) with `letter-spacing: 0.3–0.4em` instead of `10px`.

## Reserved colors — decision needed, don't invent this silently

`VerdictBanner.jsx`'s `verdictDisplay` only maps the **single-turn probe** vocabulary
(SUCCESS=red, PARTIAL=amber, FAILURE/FAILED=teal, REVIEW=blue). The **agent-mode control**
vocabulary (`CONTROL_HELD` / `PARTIAL_CONTROL_FAILURE` / `CONTROL_FAILED` / `INCONCLUSIVE`, from
`computeVerdict.js`) has no color mapping yet — that's week 6 work, not done.

The mockup proposes reusing existing, currently-unclaimed tokens rather than inventing new hexes:

| Agent verdict | Proposed token | Why |
|---|---|---|
| `CONTROL_HELD` | `C.green` | Defined but unused by `verdictDisplay` today — no collision |
| `CONTROL_FAILED` | `C.red` | Shared hue with probe SUCCESS is acceptable — both mean "bad," sections are labeled and the plan doc's vocabulary-disambiguation rule is about not collapsing the *words*, not about never sharing a hue |
| `PARTIAL_CONTROL_FAILURE` | `C.ochre` | Same family as probe's PARTIAL/amber without being the identical hex |
| `INCONCLUSIVE` | `C.slate` | Neutral; note `slate` is already Baseline's control-profile color (`controlProfiles.js`) — low risk since profile chips and verdict badges are visually distinct components, but flagging it |

**Do not use `blue` for `CONTROL_HELD`.** An earlier pass of this mockup used a steel-blue for
"held" and it sat close enough to the existing `C.blue` (REVIEW, single-turn) to risk exactly the
confusion CLAUDE.md warns against. `green` is the safer pick.

This mapping is a proposal, not a spec — it's the first real decision about agent-verdict color,
and it should get a look from whoever owns week 6 before it's load-bearing in the UI.

## Component notes

- **`Header.jsx`** — wordmark string changes from `SLEEPER` → `NETRUNNER` (line ~31; the
  `aria-label` on line 30 too). Subtitle can stay `AGENT ASSURANCE LAB` or switch to `AGENT
  THREAT & CONTROL LAB` to match the CLAUDE.md tagline — your call. Active states (the `CHANGE`
  button, `ADVANCED` toggle, tab nav) currently use a filled `amberBg` pill; Obsidian's reference
  uses an outline + underline instead of a fill. Optional if time is short — the token swap alone
  gets you most of the way there.
- **`DossierHome.jsx`** — `EntryCard`'s colored top border and icon background currently use each
  card's own accent (`C.amber`/`C.teal`/`C.blue`); in Obsidian those become neutral (`C.borderHi`)
  except the primary card, which can keep `C.brass`. Drop the `${color}18` background wash on the
  primary card in favor of a flat `C.surface`.
- **`VerdictBanner.jsx`** — drop the `${color}12` background wash (line 37); keep the `3px`
  left border and the colored label text only. Flatter, matches the reference's verdict panel.
- **Case rows / chips** (`DossierHome.jsx`, `FindingCard.jsx`) — square corners (2px), same
  border-and-text-color pattern, no fills.
- **Background motif** — add to whichever element wraps the whole app (check `index.html` /
  `main.jsx` / the outermost div in `App.jsx`):
  ```css
  background-image:
    repeating-radial-gradient(circle at 100% 0%, transparent 0 42px, rgba(207,199,176,.055) 43px, transparent 44px),
    repeating-radial-gradient(circle at 0% 100%, transparent 0 60px, rgba(207,199,176,.035) 61px, transparent 62px);
  ```
  Very low opacity — it should read as texture, not decoration. Reference the two corner-ring
  layers in the mockup file if it's not subtle enough at first pass.

## Accessibility

Contrast checked against the new `bg` (#050505):

| Pair | Ratio | AA? |
|---|---|---|
| `text1` on `bg` | 18.2:1 | Pass (body text) |
| `text2` on `bg` | 9.6:1 | Pass (body text) |
| `text3` on `bg` | 4.0:1 | Pass for UI components/large text (3:1) — **fails AA body-text (4.5:1)**. Fine for labels, borders, letter-spaced caps at 10–11px bold, but don't drop small regular-weight paragraph text into `text3`. |
| `brass` on `bg` | 12.1:1 | Pass |
| `green`/`red`/`ochre` verdict text on `bg` | 5–8:1 | Pass |
| `slate` (proposed `INCONCLUSIVE`) on `bg` | 3.8:1 | Same caveat as `text3` — fine as a badge/label, not for body copy |

No changes needed, just don't let `text3` or `slate` migrate into running text during
implementation.

## Not included here

Exact pixel-level component states (hover/active/disabled) beyond what's noted above — the
mockup file's interactive elements (buttons, chips, nav) demonstrate these live; treat it as the
source of truth for anything this doc doesn't call out explicitly. If something in the real app
doesn't have an obvious equivalent in the mockup (e.g. the model-loading progress states in
`Header.jsx`), keep the current interaction behavior and only apply the new tokens.
