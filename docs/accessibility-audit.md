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

**Finding, not fixed here:** `borderHi` (#3A3A37) is the default (unselected/inactive) border
color for a large number of pre-existing interactive elements across the whole app — case cards,
profile cards, target toggles, and more — not something introduced in Phases 1–2. Its
1.74:1 contrast against `panel` fails the 3:1 non-text threshold. Decorative borders are exempt
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
- The `borderHi` non-text-contrast finding above is identified, not fixed — deferred to the visual
  token pass by design, to avoid duplicating the work.
- No automated accessibility linting (e.g. `eslint-plugin-jsx-a11y`, `axe-core`) wired into CI yet.
  Worth adding alongside the Playwright critical-flow tests this Phase 3 pass adds separately, as
  a follow-up rather than in this audit.
