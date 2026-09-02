# Accessibility Audit

Phase 3 of `codex-implementation-handoff.md`. This is a self-audit against WCAG 2.1 AA
acceptance criteria the handoff doc names explicitly — not a certification, and not performed
with a screen reader or assistive-technology user testing. Treat it the same way this project
treats every other claim: state what was actually checked, and how.

## Method

- Contrast ratios computed directly from the `C` token hex values in `src/App.jsx` (WCAG relative
  luminance formula), not estimated by eye.
- Reflow tested by setting the browser viewport to 320 CSS px — the standard equivalent of 400%
  zoom on a 1280px design (WCAG 1.4.10) — and checking `document.body.scrollWidth` against
  `clientWidth` on every screen and every workspace tab.
- Keyboard operability and ARIA structure verified by reading the rendered accessibility tree and
  exercising controls without a mouse (`Tab`/`Enter`/arrow keys via the automation harness).
- `:focus-visible` and `prefers-reduced-motion` verified by reading `src/App.jsx`'s
  `GlobalStyle`, not visually inspected frame-by-frame.

## Results

### Contrast — text (WCAG 1.4.3, AA = 4.5:1 normal text)

| Text token | On `bg` | On `panel` | On `surface` |
|---|---|---|---|
| `text1` (#F4F2EA) | 18.18:1 | 17.67:1 | 17.35:1 |
| `text2` (#B6B2A4) | 9.60:1 | 9.33:1 | 9.16:1 |
| `text3` (#8B877A) | 5.67:1 | 5.51:1 | 5.41:1 |

All three text tokens, including the muted `text3` tier the handoff doc specifically flagged for
checking, clear AA normal-text contrast (4.5:1) against every surface color in the app with
margin. No fix needed.

### Contrast — non-text UI components (WCAG 1.4.11, AA = 3:1)

| Element | Ratio | Verdict |
|---|---|---|
| Focus outline (`amber` on `panel`) | 5.87:1 | Passes with margin |
| `brass` interaction accent on `bg` | 12.08:1 | Passes with margin |
| `borderHi` divider on `panel` | **1.74:1** | **Fails 1.4.11 where a border is the only signal of an interactive boundary or state** |

**Finding, since fixed — see the 2026-09-02 re-measurement at the end of this document.**
`borderHi` (then #3A3A37) is the default (unselected/inactive) border color for a large number of
pre-existing interactive elements across the whole app — case cards, profile cards, target
toggles, and more — not something introduced in Phases 1–2. Its 1.74:1 contrast against `panel`
failed the 3:1 non-text threshold. Decorative borders are exempt
from 1.4.11, but several of these borders are the primary visual signal that an element is
selectable, which is in scope. Fixing this piecemeal across dozens of pre-existing call sites
right before a token-system pass would mean doing the work twice. It is carried forward as a
required input to the visual-system token redesign later in this Phase 3 pass (see
`docs/visual-system.md` once that lands) rather than patched here in isolation.

### Reflow (WCAG 1.4.10)

Tested at 320 CSS px width — home screen, Run agent case screen, and all four `InvestigationWorkspace`
tabs (Compare/Trace/Evidence/Report) after a live comparison run. `document.body.scrollWidth` equaled
`clientWidth` (320) in every case: **zero horizontal overflow**, no clipped content, no
information lost. The identity strips added in this Phase 2 pass (manifest/configuration digests)
use `overflowWrap: anywhere`, which held up under test rather than forcing horizontal scroll.

### Keyboard operability and focus

- `:focus-visible` is applied globally (`src/App.jsx` `GlobalStyle`) to every native interactive
  element (`button`, `a`, `[role="button"]`, `select`, `input`, `textarea`) with a 2px `amber`
  outline — not just a color change, an actual outline, so it survives a color-blindness
  simulation too.
- `@media (prefers-reduced-motion: reduce)` disables all animation/transition/smooth-scroll
  globally, not per-component — already correct, nothing to add.
- `InvestigationWorkspace.jsx`'s tabs implement the full WAI-ARIA Tabs pattern: `role="tablist"`/
  `"tab"`/`"tabpanel"`, `aria-selected`, `aria-controls`/`aria-labelledby`, roving `tabIndex`
  (only the selected tab is in the tab order; arrow keys move focus and selection, `Home`/`End`
  jump to the first/last tab) — this was built correctly from Phase 2, not retrofitted here.
- Every interactive control audited (case/profile/target selectors, run buttons, export buttons,
  the retry-isolation-check button) is a real `<button>` element, not a `<div onClick>` — keyboard
  operable by default, no custom key handling needed or added.
- No icon-only buttons found: every button in `src/components/` pairs an icon with visible text
  (`COPY JSON`, `DOWNLOAD`, `HOME`, `RETRY ISOLATION CHECK`, etc.), so accessible names come from
  visible text content rather than requiring `aria-label` — checked by grep across every
  `<button>` in the component tree.

### Programmatic announcements (state changes)

`role="status"` + `aria-live` (`polite`, or `assertive` specifically for the `error` state) is
present on: `RunContextSummary` (idle/running/current/stale/degraded/error), the historical-export
banner and confirmation dialog (`role="alert"`) in `EvidenceContractPanel.jsx` and
`ReportPanel.jsx`, the local-model compatibility message, and the COI retry status. A screen
reader user is told when a result goes stale, when a run starts/finishes, and when an export
requires confirmation, without having to poll the page visually.

### Color as the only carrier of meaning

Checked every verdict/state surface: verdict badges always pair color with the literal verdict
text (`getVerdictLabel`, never color alone); the `RunContextSummary` state banner always shows the
state name as text (`CURRENT`/`STALE`/etc.) plus a written message, not just a colored border; the
Trace tab's OBSERVED/DERIVED badges are text, not color-coded dots. No instance found where color
alone carries a verdict or state distinction.

## Not done in this pass

- No actual screen-reader (VoiceOver/NVDA/JAWS) walkthrough — this audit checked the accessibility
  tree and ARIA structure, not real assistive-technology behavior. That gap should be named
  explicitly to anyone relying on this document, not glossed over.
- The `borderHi` non-text-contrast finding above was identified here and deferred to the visual
  token pass by design, to avoid duplicating the work. It was fixed in that pass — see the
  2026-09-02 re-measurement below.
- No automated accessibility linting (e.g. `eslint-plugin-jsx-a11y`, `axe-core`) wired into CI yet.
  Worth adding alongside the Playwright critical-flow tests this Phase 3 pass adds separately, as
  a follow-up rather than in this audit.

---

## Re-measurement — 2026-09-02 (elevation-ramp change)

The surface tokens changed in the visual-hierarchy pass: `panel` #0A0A09 → #121211 and `surface`
#0D0D0C → #191917, widening a canvas-to-raised step that was 1.03:1 (imperceptible, and invisible
entirely on a projector) to 1.09:1. Raising the surfaces lowers the contrast of everything drawn on
them, so every token in the tables above was re-measured against the new values rather than assumed
to have survived.

### Text (WCAG 1.4.3, AA normal text = 4.5:1)

| Token | on `bg` #050505 | on `panel` #121211 | on `surface` #191917 |
|---|---|---|---|
| `text1` (#F4F2EA) | 18.18:1 | 16.72:1 | 15.71:1 |
| `text2` (#B6B2A4) | 9.60:1 | 8.83:1 | 8.29:1 |
| `text3` (#8B877A) | 5.67:1 | 5.22:1 | 4.90:1 |

All three still clear 4.5:1 on every surface. `text3` on `surface` is the tightest at 4.90:1 and is
the constraint on any further lightening of the ramp — `surface` cannot go much above #191917
without either failing, or `text3` having to lighten with it.

### Non-text UI components (WCAG 1.4.11, AA = 3:1)

| Element | on `bg` | on `panel` | on `surface` | Verdict |
|---|---|---|---|---|
| `borderHi` (#666663) | 3.54:1 | 3.25:1 | 3.06:1 | Passes on every surface |
| Focus outline (`amber` #C87844) | 6.04:1 | 5.56:1 | 5.22:1 | Passes with margin |
| `brass` interaction accent (#CFC7B0) | 12.08:1 | 11.11:1 | 10.44:1 | Passes with margin |
| `border` (#2A2A27) | 1.42:1 | 1.30:1 | 1.22:1 | Decorative only — see below |

The original `borderHi` finding is resolved: at #666663 it passes 1.4.11 against all three
surfaces, with `surface` the tightest at 3.06:1.

### New finding, fixed in the same pass

The original audit measured `borderHi` but did not check `border`, and `border` was in fact the
unselected boundary on three sets of genuinely interactive elements — the case cards, the executable
variant cards, and the control-profile cards. On those, the border is the primary signal that the
element is selectable, so 1.4.11 applies and 1.30:1 fails it. (This predates the elevation change;
at the old `border` #212120 on the old `panel` it was worse.)

Fixed by moving all five of those call sites to `borderHi`. The rule the token comments now carry:
`border` is decoration — section rules, the edge of a non-interactive card — and must never be the
only signal that something is selectable; interactive boundaries use `borderHi`.

### Reflow, re-tested (WCAG 1.4.10)

Re-run at 320 CSS px because this pass changed the DOM, not just colors — sections lost their
boxes, the setup form collapses after a run, and the run history gained a nested disclosure.
`document.scrollingElement.scrollWidth` equalled `clientWidth` (320) in all eight states measured:
home, runner with setup open, runner with setup collapsed after a comparison run, each of the four
workspace tabs, and every `<details>` on the screen forced open at once. **Zero horizontal
overflow**, unchanged from the original audit.

### Not re-checked

No new manual keyboard or screen-reader walkthrough. `e2e/accessibility.spec.js` still passes,
which covers the live-region and keyboard assertions it encodes — including the roving-tabindex tab
navigation — but the two controls this pass introduced (the collapsed-setup toggle and the run
history's group disclosure) are native buttons carrying `aria-expanded` and were not put through a
real assistive-technology walkthrough. The standing caveat from the original audit applies to them
too: this document checks the accessibility tree, not actual AT behavior.
