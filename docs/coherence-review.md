# NETRUNNER — Coherence / Industry-Accuracy / UX Review

Run 2026-08-17 against the working tree (uncommitted). Three independent passes — logic
coherence, framework-accuracy fact-check against primary sources, and a first-time-user
walkthrough — each done by re-deriving from the actual code rather than trusting the project's
own claims about itself. Ground truth verified directly before the passes ran: **458 tests pass
across 19 files, `npm run lint` clean (3 pre-existing warnings, same ones the plan doc already
knows about).** That number is higher than the 446 in `CLAUDE.md` — more work has landed since
that doc was last updated (see below).

One correction up front: `package.json`'s internal npm package name (`"sleeper"`) is intentional,
not a bug — confirmed by the project owner. Don't rename that field. Everything else flagged
below about the "SLEEPER" name is about **user-visible** surfaces, which is a different, and
already-known-open, question (see Finding U1).

**Also worth knowing before triaging:** one of the two decisions flagged as open in
`docs/agent-module-plan.md` has already been resolved in the working tree — case 2's PII seed is
now `pii_seeds: {}`, with a comment explaining why a contrived seed was removed. That's done.
The other (`requestServiced: false` masking an observed PII exposure) is still open — see L2.

---

## Logic coherence

**L1 — HIGH — PII leakage guard never scans tool-call content, only the model's final chat
reply.** `src/harness/runAgentCase.js:244` calls `runPiiLeakageGuard(finalText, ...)` — `finalText`
is the model's last chat message, never the arguments/content of an executed tool call. But case
1's own fixture (`src/data/agentCases.js` ~260-265, `NR-AGT-001-FIX-TICKET`) is written so the
injected instruction tells the agent to exfiltrate a seeded value *via `send_email`* while
suppressing mention of it in its own summary — i.e. the scenario is specifically designed so the
canary leaves through a tool call and never appears in the text the guard actually scans. Under
the Partial profile (PII filter on, tool authorization off), if the model complies, the guard
reports `PII_GUARD_NOT_TRIGGERED` even though the seeded value genuinely exfiltrated. The overall
run verdict still comes out right (tool authorization catches it), but the PII-specific evidence
is wrong for exactly the exfiltration path the case exists to demonstrate. **Fix:** also scan
executed tool-call arguments for seeded canaries, or narrow the guard's own outcome text to make
"final response text only" explicit so it can't be read as "nothing left the system."

**L2 — MEDIUM-HIGH — confirmed live: `requestServiced: false` still masks an observed exposure.**
`src/harness/computeVerdict.js:368-374` returns INCONCLUSIVE before any failure is checked, so a
real `piiResult.sensitive_data_exposed === true` on an unserviced run is currently unreachable in
the verdict output — directly against the principle stated two branches later in the same file
("an exposure that happened is evidence regardless of what else was unexercised," line ~404).
No test exercises `requestServiced: false` paired with an actual observed failure — the existing
`REQUEST_NOT_SERVICED` test only pairs it with a clean record, so today's masking behavior isn't
even pinned down by a test either way. **Recommendation:** reorder — keep `targetReachable`/
`error` checks first (those really do mean nothing was tested), but move the request-serviced
check after failure detection so an observed failure always survives, matching the file's own
stated rule.

**L3 — MEDIUM — the live agent trace UI re-derives trust classification instead of using the
gate's own decision.** `src/components/AgenticTracePanel.jsx:81-83` hardcodes its own
`isUntrustedSource` check (`['system','developer','user']`) instead of reading
`authorityRegistry.js`'s actual `TRUSTED_SOURCES`/`isUntrustedInstructionSource`, and no event in
the stream carries the authorization gate's already-computed `untrusted_source` boolean. Harmless
today only because no case currently overrides the default trust boundary — the moment one does,
the trace's red/not-red coloring can silently disagree with the real authorization decision.
**Fix:** emit `instruction_source_trusted` on the `tool_call` event from the gate's own decision
record; have the panel read it directly instead of re-classifying.

**L4 — MEDIUM — a second, unenforced copy of the authorization-required logic exists as dead
code.** `authorityRegistry.js:112-119`'s `requiresExplicitApproval` duplicates the exact
authorization-required computation `toolAuthorizationGate.js:66-67` does inline — currently in
sync, referenced only from tests, never called from the production path
(`runAgentCase.js` calls the gate directly). A future edit to one copy and not the other would
silently diverge, with nothing to catch it. **Fix:** delete the duplicate or have one delegate to
the other.

**L5 (from the fact-check pass, filed here since it's a logic finding) — latent evidence-class
overclaim path, not currently reachable.** `mockToolRouter.js:89` treats a missing/`null`
authorization `decision` as `blocked: true, status: 'denied'` — identical to what a real gate
denial produces. `evidenceContract.js:162-168`'s `gateBlockedSomething()` awards **E3
"enforcement"** evidence whenever any tool result has `status === 'denied'`, without
distinguishing "the gate actually ran and blocked this" from "no decision was ever recorded."
The one production call site (`runAgentCase.js:165-166`) always supplies a real decision first,
so this can't fire today — but it's a fragile invariant resting on call-site discipline rather
than being structurally enforced, which cuts against the project's own stated goal of making the
evidence-class ceiling "structural, not a comment." **Fix:** have the router carry forward
whether a real decision was ever supplied, and have the contract builder check that rather than
inferring it from `status`.

**Checked, no issues found beyond what's already documented:** the E1-E5/I0-I2 derivation and
E4/E5 ceiling are genuinely enforced (not just commented); `activityLogging.js`,
`adversarialDetection.js`, and `toolAuthorizationGate.js` all correctly separate "off" from "ran
and found nothing"; the third historical bug (aggregated-detection defect) is fixed correctly;
turn-cap/loop-guard interaction with verdict classification is coherent; `ControlResultsPanel.jsx`,
`EvidenceContractPanel.jsx`, and `FrameworkCrosswalkPanel.jsx` render already-classified fields
without re-deriving them (L3's `AgenticTracePanel.jsx` is the one exception).

---

## Industry accuracy

Verified live against primary sources (MITRE ATLAS data repo, OWASP's GenAI-LLM-Top10 repo and
the published ASI PDF, AIUC-1's changelog repo) — not taken on the project's word.

**All four framework gaps the plan doc already flagged as open are CONFIRMED RESOLVED correctly:**

- `AML.T0010.005` ("AI Agent Tool") and `AML.T0011.002` ("Poisoned AI Agent Tool") are both real,
  registered ATLAS v6 techniques — confirmed against `mitre-atlas/atlas-data`'s pinned
  `dist/v6/ATLAS-2026.07.yaml`. ATLAS's own text even cross-references the two IDs the same way
  the project does.
- `AML.M0031` = "Memory Hardening" — confirmed, matches the project's naming.
- The OWASP LLM Top 10 2026 publish date is **2026-08-04** — confirmed from the source repo's own
  README. `docs/agent-module-plan.md`'s "2026-08-03" was the typo; `frameworkMappings.js` had it
  right. Worth a one-line fix to the plan doc for the record, though it's just documentation.
- The AIUC-1 3a/3b control split is a defensible, correctly-self-labeled inference — not
  something with a single "right answer" to check against, but the underlying control text
  supports the split (B006 explicitly covers monitoring tool definitions for unapproved changes;
  E006/E009 explicitly cover vendor due diligence). Minor softness: `A003` appears in both 3a and
  3b buckets without a distinguishing rationale — it's a generic scope-limiting control, not
  specific to either.

**Independently spot-checked and confirmed accurate** (not just the flagged gaps): OWASP
LLM03:2026 Excessive Agency's renumbering from LLM06:2025; all ten OWASP ASI 2026 category names
and their order, including a verbatim match on the ASI02/ASI04 boundary quote used in the plan
doc; AIUC-1 requirement IDs B006/D003/E015 plus 8 others, both ID-to-name accuracy and paraphrase
fidelity against the actual control text.

**Not independently re-verified** (flagging rather than silently skipping): full row-by-row
fidelity of `OWASP_PUBLISHED_CROSSWALK` against Appendix A source text (existence and date were
confirmed, not every row); NIST AI RMF and ISO/IEC 42001 clause references (ISO's text isn't
freely accessible).

**One new finding — minor tone inconsistency, not a hard rule violation:**
`reportGenerator.js:306-385`'s `generateAuditBriefHtml` titles its own output "SLEEPER AUDIT
BRIEF" under an "UNCLASSIFIED // AI ASSURANCE WORKPAPER" banner — adopting audit-report framing
in the artifact's own name, even though the same function's footer correctly states the
mappings "do not constitute legal, audit, or certification conclusions." The disclaimer is
present and correct; the deliverable's own name pulls slightly against it. Everywhere else
checked uses careful non-audit language.

---

## First-time-user experience

Full walkthrough, most severe first. This is the lens where "all over the place" shows up
concretely — the app has two structurally different testing flows (single-turn "probe" vs.
multi-step "agent case") built at different times, and they don't yet read as one coherent
product.

**U1 — HIGH — "SLEEPER" is the name on every user-visible surface; "NETRUNNER" appears nowhere
in the code.** Browser tab title (`index.html`), the home-screen h1 (`DossierHome.jsx`), the
in-app header wordmark, the unsupported-browser screen, every exported Markdown/HTML report
(titled "SLEEPER AUDIT BRIEF"), and the "clear local data" confirmation dialog. This is the
rename question you already knew was open — what this pass adds is the actual scope: it's not
just the header, it's baked into exported report titles too, which matches the exact concern
about week 7 regenerating the sample report with the old name "baked in hardest."

**U2 — HIGH — the home page never explains what the four entry cards actually test, or how they
differ.** `DossierHome.jsx`. "Run agent case," "Run demo assessment," "Start local case," and
"Review sample report" read as parallel options with similarly-weighted blurbs. Nothing states
that only "Run agent case" tests whether a tool-using agent can be manipulated into acting on
an injected instruction — which is the app's actual headline claim. A newcomer wanting exactly
that has no way to know "Start local case" isn't it.

**U3 — HIGH — the only process explainer on the home page describes just the probe flow.** The
"Attack → Evidence → Review → Control gap → Mitigate + retest" strip sits under the entry cards
looking universal, but it's the single-turn path only — even though "Run agent case" is the
visually primary card. Click it and you land on control profiles and a "ReAct loop" with no
equivalent explainer.

**U4 — HIGH — "MODEL HELD" and "CONTROL_HELD" read as the same word meaning the same thing.**
The probe flow shows humanized labels (`getVerdictLabel()`: PROBE SUCCEEDED / PARTIAL HIT /
MODEL HELD / REVIEW REQUIRED). The agent-case flow shows raw enum strings
(`CONTROL_HELD` / `PARTIAL_CONTROL_FAILURE` / `CONTROL_FAILED` / `INCONCLUSIVE`) with a
different color mapping, in `ControlResultsPanel.jsx`. These are two deliberately distinct
vocabularies for two different questions ("did the model resist" vs "did the control hold") —
but nothing in the UI tells a user that, and the shared word "HELD" plus proximity in the same
app is exactly the collision the project's own disambiguation rule is trying to prevent.

**U5 — HIGH — the Evidence Contract panel is a raw debug dump.** `EvidenceContractPanel.jsx`.
"Evidence class," "Max class claimed," "Ceiling (E4/E5 unreachable)," "Independence," plus a raw
JSON blob — no legend, no tooltip. A security-background reviewer without red-team-specific
background sees "Max class claimed: E2" with no way to know what that means, which undercuts the
app's actual differentiator (evidence discipline) at the exact moment it should be landing.

**U6 — HIGH — agent-case runs aren't saved anywhere.** `AgentCaseRunner.jsx` keeps its result in
local component state only. No entry in the findings system, no history, and the always-visible
"VIEW REPORT (N FINDINGS)" button never reflects agent runs — it only ever counts probe findings.
Navigate away and the run is gone with no warning.

**U7 — MEDIUM — raw field/enum names printed straight into the trace UI.**
`AgenticTracePanel.jsx`: `instruction_source: system`, `(simulated_only)`, `STOP: turn_cap`,
`DEGRADED: schema_fallback` appear as literal snake_case tokens with no translation.

**U8 — MEDIUM — the OWASP crosswalk panel renders `{JSON.stringify(row)}` directly.**
`FrameworkCrosswalkPanel.jsx:101` — looks like a broken feature, not a formatted mapping table.
Same panel also uses the internal codename "edition trap" with no in-UI definition.

**U9 — MEDIUM — no progress indicator on the agent-case screen.** Every probe stage shows a
5-step stage rail; `STAGE.AGENT_LAB` is excluded from it, leaving just a wordmark and a HOME
link during a multi-step configuration flow.

**U10 — MEDIUM — "degraded: true" shown as a literal code token in prose**, in the local-model
target description (`AgentCaseRunner.jsx:256`), disconnected from the "DEGRADED" badge a user
sees later on the trace panel.

**U11 — LOW — `Header.jsx` is dead code.** Confirmed by grep: zero imports anywhere in `src/`.
The header users actually see is a separate, thinner inline `headerBar` in `App.jsx` (no
LAB/FINDINGS tabs, no ADVANCED toggle). Anyone reading `Header.jsx` to understand navigation
would be reading code that doesn't run.

**U12 — LOW — "ReAct loop" used on the home screen's primary card, undefined anywhere in-app.**

**U13 — LOW — "Case," "Case File," and the session's own `caseId` all mean different things**,
inconsistently, across the probe and agent-case flows.

**U14 — LOW — the findings count never includes agent-case results**, same root cause as U6.

---

## What this adds up to

The "all over the place" feeling has a specific, fixable shape: this is genuinely two products —
a mature, well-tested single-turn probe lab, and a newer, logic-solid-but-UI-unexplained agent
harness — stitched into one home screen without a shared onboarding layer or a shared verdict
vocabulary explanation. The logic underneath is in good shape (one real bug found in this pass,
L1, plus a design fragility in L5); the coherence problem is almost entirely at the UI/copy
layer (U1-U5 especially) rather than the harness. That's good news for scope — it's a
documentation-and-copy pass plus a few structural UI fixes (persistence, a shared verdict-label
translation layer, a legend for the evidence-class panel), not a rearchitecture.
