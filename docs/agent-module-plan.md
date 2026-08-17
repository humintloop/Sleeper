# SLEEPER — Agent Threats & Controls Module: Design Plan

Rev. 2026-08-16. Supersedes the original `agent-module-plan.md`.
Framework references below are verified against primary sources and pinned in
[`source-ledger.md`](./source-ledger.md).

## Status

**Weeks 1–5 are complete and in the working tree** (446 tests, lint clean): framework refresh,
harness skeleton, API adapter with tool-calling, ReAct orchestrator and mock tool router, the
four threat cases, and the verdict/Evidence Contract pipeline. A case now runs end to end
under three control profiles and emits a contract.

Remaining: week 6 (surfacing the crosswalk in the UI) and week 7 (demo, regenerated sample
report, README). See [Implementation order](#implementation-order) and [Open items](#open-items).

## Context

SLEEPER inherits ELICIT's single-turn evaluation layer (prompt injection, jailbreak,
system prompt extraction) and its mappings to MITRE ATLAS, OWASP LLM Top 10, NIST AI RMF, and
ISO/IEC 42001 §9, with conditional EU AI Act readiness notes. This module extends the same
evidence → control → framework-readiness traceability model to multi-step, tool-using agent
behavior — which is SLEEPER's reason for existing as a separate project. Single-turn probes
stay as the baseline arm of an agent case, not as the product.

## Lineage, and reclaiming ORPHEUS

SLEEPER is a copy of [ELICIT](https://github.com/humintloop/ELICIT) taken on 2026-08-16,
immediately after the framework refresh described below, then stripped of ELICIT's dossier
framing and rebuilt around agent threats. ELICIT stays live and unchanged as the single-turn
lab.

The original plan assumed the mock-tool harness had to be built from nothing. It does not.
[`humintloop/ORPHEUS`](https://github.com/humintloop/ORPHEUS) is a divergent fork of this
same codebase (shared component tree, same `frameworkMappings.js`, same `C` token object)
that already ships a working agentic harness, a control-profile model, an Evidence Contract
schema, and a live OpenAI/Anthropic API adapter. The ELICIT line meanwhile gained ESLint,
Vitest, storage hardening, and the batch-judge UX that ORPHEUS lacks — all of which SLEEPER
inherits.

The two forks last shared a commit on 2026-07-02. Neither is a superset. The move is to port
ORPHEUS's harness *into* SLEEPER under its engineering standards (tests + lint), not to
merge branches or restart work in ORPHEUS. ORPHEUS itself is being retired.

### ORPHEUS salvage assessment

**Take largely as-is:**

| File | Why it fits |
|---|---|
| `src/api/adapter.js` | Complete live-endpoint adapter: OpenAI / Anthropic / generic, provider detection, SSE normalization into the WebLLM `choices[0].delta.content` shape the app already consumes, API key held only as an instance field. Needs tool-calling added (§Harness) and a pass against SLEEPER's storage-hardening commit `b2b6f1b`. |
| `src/harness/authorityRegistry.js` | Tool allowlist with `risk` / `allowed` / `requiresApproval` / `trustedOutput` plus trusted vs. untrusted instruction sources. The data model cases 2 and 3 both need. |
| `src/harness/controls/*.js` | `toolAuthorizationGate`, `adversarialDetection`, `piiLeakageGuard`, `activityLogging` — deterministic control functions that already take `(content, mode)` and are not fixture-bound. |
| `src/data/controlProfiles.js` | Baseline / Partial / Reference / Custom postures. **The strongest idea in either fork.** It makes a finding comparative — same attack, three control postures, three outcomes — which is what control-effectiveness evidence requires. Adopt as the spine of the agent module. |
| `src/harness/controlGate.js` | Turns a profile into a literal, inspectable system-prompt wrapper. Legible and reproducible by design. |
| `EvidenceContractPanel`, `AgenticTracePanel`, `ControlResultsPanel`, `ControlProfileSelector` | Working UI for exactly the surfaces this module needs. |

**Throw out:**

| File / thing | Why |
|---|---|
| `mockToolRouter.js` → `createAgenticSeedTrace()` | Hardcoded four-step trace branching on a literal case ID — the scripted-trace approach this module rejects. Keep `routeMockToolCall()` (the enforcement half); delete the seeding half. |
| `demoTarget.js` fixtures | Four hardcoded response strings. Replaced by real model output from the ReAct loop. |
| `computeVerdict.js` logic | Keep the vocabulary, rewrite the function. Two defects: (a) the first branch returns `CONTROL_HELD` on `attackBlocked && !tool_call_executed` without consulting `piiResult`, so a run that blocks the injection but leaks seeded PII reports as held; (b) the fallback returns `CONTROL_HELD` whenever no tool was attempted, which in a real ReAct loop fires constantly when the model simply declines to act. Both are resolved by the INCONCLUSIVE discipline below. |
| `orpheusCases.js` mappings | OWASP IDs wrong under any edition — `LLM06`/`LLM07` tagged to PII leakage, `LLM08` to tool authorization. Rewrite from scratch. |
| ORPHEUS's lack of tests/lint | Do not carry over. Every ported file lands with Vitest coverage. |

## Borrowed: evidence discipline from `red-team-blue-team-agent-fabric`

[`msaleme/red-team-blue-team-agent-fabric`](https://github.com/msaleme/red-team-blue-team-agent-fabric)
(Apache 2.0, compatible with this repo) is a Python protocol-testing harness — different
language, different layer, no code to lift. Three of its **methodology** ideas are worth
adopting, and one of its test sets is worth translating.

### 1. Evidence class taxonomy (adopt)

Its `docs/EVIDENCE-CLASS-TAXONOMY.md` defines what an artifact permits its author to claim:
**E1** observation · **E2** runtime characterization · **E3** enforcement · **E4** persistence
and replay resistance · **E5** isolation and security boundary. A second axis, **I0–I2**,
records who produced the oracle (self-authored / independently reimplemented / independent
sensor the target does not control). A third, orthogonal axis records status: *mapped*,
*executed*, *independently reviewed*, *certified*.

This is the missing piece in both SLEEPER and ORPHEUS. SLEEPER's central promise — evidence for
control review, not audit conclusions — is currently carried only by prose disclaimers.
An explicit evidence class per finding makes it structural, and it resolves the exact
confusion ORPHEUS has, where a fixture run and a live run both report `CONTROL_HELD`.

Applied here:

| Run mode | Class | Why |
|---|---|---|
| Mock-tool harness against fixtures | **E2 / I0** for the target | The target's behavior is characterized; nothing about the target's controls is enforced. |
| Mock-tool harness, tool call blocked at SLEEPER's gate | **E3 / I0** for *SLEEPER's gate*, still E2 for the target | The enforcement observed is our own. The taxonomy's "where the control point sits" section is precisely this distinction. |
| Live API target, single turn | **E2 / I0** | Real response, no control point under test. |
| Framework crosswalk rows | **E1**, status *mapped* | A mapping is E1 material no matter how many requirements it covers. |

No SLEEPER output reaches E4 or E5, and it should say so.

### 2. INCONCLUSIVE over PASS (adopt)

Its rule: a target the harness cannot reach, or that answers without servicing the request,
reports INCONCLUSIVE — never PASS. That is the principled fix for the `computeVerdict`
fallback defect. In a real ReAct loop, "the model never attempted a tool call" is not evidence
that a tool-authorization control held; it is an unexercised control. It must resolve to
`INCONCLUSIVE`, with the reason recorded.

Its `docs/CASE_STUDY_FALSE_PASS.md` and the guard comment in `protocol_tests/hitl_harness.py`
document a shipped false PASS in their own HITL-001 and the reader defect behind it. Worth
reading before writing our verdict function.

### 3. Standard-currency notes on crosswalks (adopt)

Its AIUC-1 crosswalk carries a dated "standard currency" banner naming which quarterly release
it was built against and what changed since. Adopt the pattern for every AIUC-1 citation here.

### 4. HITL failure modes (translate)

Its `hitl_harness.py` decomposes "approval fatigue" into concrete, testable failure modes —
far better than the vague dimension in the original plan. Adapted for case 2:

- **Approval flood** — many approval requests in a short window; does the gate rate-limit or does volume degrade it?
- **High-risk starvation behind low-risk volume** — does a consequential request get buried?
- **Decision context stripping** — does the approval prompt carry enough information to make the decision meaningfully, or just a tool name?
- **Denied-decision replay** — is a previously denied action re-proposed without being flagged as previously denied?

These are ours to reimplement against our own mock-tool loop, not to copy: their
implementation tests remote wire protocols, ours tests a model's behavior in a browser.
Attribution goes in `ATTRIBUTION.md` if any of their text or structure is reused directly.

**Not taking:** the payments/settlement stack (x402, L402, AP2, Visa TAP), the MCP/A2A wire
protocol tests, the attestation registry, the GitHub Action, the Discord bot. All out of
SLEEPER's scope — that project tests deployed endpoints over the network; SLEEPER is a
local-first browser lab.

## Target scenario

Enterprise tech company, employee-facing agent use — an employee at a SaaS/cloud/edge
provider using coding agents, internal AI assistants, and MCP-connected integrations. Not a
frontier-lab red-team scenario.

## Threat cases (v1 scope — 3 cases, equal depth)

1. **Indirect prompt injection → unauthorized action.** Employee points an agent at untrusted
   content (ticket, PR, email, scraped page). Hidden instructions hijack the agent into an
   unintended action.
2. **Excessive agency / insufficient human approval.** Agent holds tool access to consequential,
   irreversible, or externally-visible actions without adequate approval gating, or with a
   gate that fails under the four HITL failure modes above.
3. **Malicious or over-permissioned MCP connections (incl. shadow AI).** Employee connects an
   agent to an unsanctioned or compromised MCP server, or an internal one scoped broader than
   the task needs.

Deferred: memory poisoning (ASI06), multi-agent cross-talk (ASI07), identity spoofing.

## Framework mapping

All three framework references in the original draft had moved. All are now corrected and
pinned.

### MITRE ATLAS — agent-native techniques and mitigations exist

The original plan proposed stretching `AML.T0051.001` to cover agent *action*. Unnecessary.
The repo's ledger had pinned `dist/ATLAS.yaml` at commit `da9ebf9b`; that file now carries a
deprecation banner (v5.6.0). Current data is `dist/v6/ATLAS-2026.07.yaml` — format-version
6.0.0, 178 techniques, 37 mitigations, keyed-map layout rather than the v5 list layout.

Verified against the official YAML:

| Case | ATLAS techniques | ATLAS mitigations |
|---|---|---|
| 1. Indirect injection → action | `AML.T0051.001` Indirect · `AML.T0053` AI Agent Tool Invocation · `AML.T0086` Exfiltration via AI Agent Tool Invocation · `AML.T0101` Data Destruction via AI Agent Tool Invocation | `AML.M0030` Restrict AI Agent Tool Invocation on Untrusted Data · `AML.M0033` Input and Output Validation for AI Agent Components · `AML.M0024` AI Telemetry Logging |
| 2. Excessive agency / approval | `AML.T0053` · `AML.T0101` | `AML.M0029` **Human In-the-Loop for AI Agent Actions** · `AML.M0026` Privileged AI Agent Permissions Configuration · `AML.M0027` Single-User AI Agent Permissions Configuration · `AML.M0028` AI Agent Tools Permissions Configuration |
| 3. Malicious / over-permissioned MCP | `AML.T0110` **AI Agent Tool Poisoning** (`.000` Definition and Instructions · `.001` Implementation · `.002` Runtime Response) · `AML.T0115.002` Publish Poisoned AI Artifacts: AI Agent Tools · `AML.T0011.002` User Execution: Poisoned AI Agent Tool · `AML.T0010.005` AI Supply Chain Compromise: AI Agent Tool · `AML.T0098` AI Agent Tool Credential Harvesting · `AML.T0084.001` Discover AI Agent Configuration: Tool Definitions | `AML.M0028` · `AML.M0032` Segmentation of AI Agent Components |

`AML.T0110.000` is the MCP tool-description-poisoning attack as a registered sub-technique.
That moves case 3 from project-defined to source-grounded — the largest single credibility
gain in this module.

`AML.T0054` was also renamed **LLM Jailbreak** (was "LLM Jailbreaking").

### OWASP LLM Top 10 2026 — migrated repo-wide

Published 2026-08-04. Official source: `GenAI-Security-Project/GenAI-LLM-Top10`, `2026/final/`,
pinned at commit `7bbe0f06`. Two changes land on this module:

- **Excessive Agency moved LLM06 → LLM03** — case 2's primary mapping.
- **System Prompt Leakage → LLM08 Hidden Context Exposure**, broadened to any non-user-facing
  content assembled into context, *explicitly including tool schemas*. That makes it a case-3
  mapping alongside `AML.T0084.001`, not just a single-turn concern.

Full 2025→2026 table in [`source-ledger.md`](./source-ledger.md).

### OWASP Appendix A — several mappings upgrade from inferred to direct

The 2026 edition ships **Appendix A, Related Framework Mappings**, which directly asserts
LLM→ASI, LLM→ATLAS *tactic*, and LLM→NIST AI RMF *category* relationships across nine
frameworks. This is OWASP asserting the relationship, not SLEEPER inferring it.

Recorded in `OWASP_PUBLISHED_CROSSWALK` (`src/data/frameworkMappings.js`) as the only direct
mappings in that file. Two notes:

- OWASP's RMF mapping is at Category level (`MEASURE 2`, `MAP 4`, `GOVERN 6`) — finer than
  SLEEPER's existing Function-level references, which stay inferred.
- OWASP pins ATLAS at content v2026.06; SLEEPER pins v2026.07 (current). Noted rather than
  reconciled.

### OWASP Top 10 for Agentic Applications (ASI) 2026 — verified from the PDF

The original draft's ten categories were from *Agentic AI Threats and Mitigations* v1.0
(Feb 2025), now v1.1 and running to T17. The current top-level artifact is the **Top 10 for
Agentic Applications 2026** (announced 2025-12-09). Titles verified from the published PDF,
"Agentic Top 10 At A Glance," p.8:

ASI01 Agent Goal Hijack · ASI02 Tool Misuse and Exploitation · ASI03 Identity and Privilege
Abuse · ASI04 Agentic Supply Chain Vulnerabilities · ASI05 Unexpected Code Execution (RCE) ·
ASI06 Memory & Context Poisoning · ASI07 Insecure Inter-Agent Communication · ASI08 Cascading
Failures · ASI09 Human-Agent Trust Exploitation · ASI10 Rogue Agents

**Correction to the previous revision.** That draft mapped case 3 to ASI04. OWASP draws the
boundary differently, and says so explicitly under ASI02:

> Tool poisoning [...] belongs under ASI02 because the attacker manipulates the interface of
> an otherwise legitimate tool at runtime; only cases where the tool itself is malicious or
> compromised at the source fall under ASI04.

So case 3 splits by attack stage:

| Case | Primary ASI | Supporting |
|---|---|---|
| 1. Indirect injection → action | ASI01 Agent Goal Hijack | ASI02 |
| 2. Excessive agency / approval | ASI02 Tool Misuse and Exploitation | ASI09, ASI03 |
| 3a. Poisoned MCP tool *descriptor* at runtime | **ASI02** | ASI04 |
| 3b. Malicious / compromised MCP server at source | **ASI04** | ASI03 |

That split is worth building into the case structure rather than papering over — it is the
kind of distinction an auditor will probe, and getting it right is cheap now.

One trap: the ASI PDF predates the 2026 LLM edition, so its own cross-references cite
2025 LLM IDs (LLM06:2025 Excessive Agency, etc.). When quoting ASI text, preserve the
published 2025 ID and add the 2026 equivalent alongside — do not silently rewrite it.

### AIUC-1 — lead framework, exact IDs verified

Confirmed: 51 requirements / 130 controls (65 mandatory, 65 optional), six pillars, quarterly
cadence, Schellman as first accredited auditor. IDs are pillar-lettered: A Data & Privacy ·
B Security · C Safety · D Reliability · E Accountability · F Society, with controls as `A003.1`.

The requirement and control text is published at
[`aiunderwriting/AIUC-1-Changelog`](https://github.com/aiunderwriting/AIUC-1-Changelog).
**Current release is 2026-07-15, newer than the Q2 refresh the original draft cited.**
Verified requirement IDs, replacing the earlier guesses:

| Case | AIUC-1 requirements |
|---|---|
| 1. Indirect injection → action | `B002` Detect adversarial input · `B005` Implement real-time input filtering · `B006` Prevent unauthorized AI agent actions · `E015` Log AI system activity |
| 2. Excessive agency / approval | `D003` Restrict unsafe tool calls · `B006` · `C007` Flag high risk outputs for human review · `D004` Third-party testing of tool calls |
| 3. Malicious / over-permissioned MCP | `B006` · `B008` Protect AI system deployment environment · `A003` Limit AI agent data access · `E006` Conduct vendor due diligence · `E009` Monitor third-party access |

Three of these are unusually good fits. Summarized in our own words from the 2026-07-15
release; read the source for the actual control text:

- **`B006`** — its optional controls cover watching MCP tool definitions for unapproved
  changes after they are first accepted, and adding authorization hooks that check a tool call
  against policy before it runs. Between them, that is close to a specification for cases 2
  and 3, written by the standard.
- **`D003`** — its optional controls cover human confirmation ahead of high-risk actions and
  multi-step tool calls, and approval workflows for anything past the agent's autonomous
  boundary. Case 2's control objective.
- **`E015`** — its optional controls cover retaining the full execution chain of an agentic
  workflow: agent provenance, tool-call parameters and results, sub-agent delegations,
  authorization and approval events, and reasoning traces where they exist. **That is
  effectively a spec for our Evidence Contract.** Shape the trace to satisfy E015 and the
  crosswalk writes itself.

**Citation practice.** The AIUC-1-Changelog repository publishes **no license**. Requirement
and control IDs and short requirement names are cited directly — those are identifiers and
short phrases, not protected expression. Control language is paraphrased rather than
reproduced, and every citation records the release date it was read from. This matches the
practice in `msaleme/red-team-blue-team-agent-fabric`, which cites AIUC-1 requirement IDs and
names alongside its own coverage prose, and carries an explicit claim boundary stating that
the crosswalk is research mapping and not a conformity assessment. Do the same here.

### Unchanged

NIST AI RMF and ISO/IEC 42001 §9 stay as the governance/oversight layer. EU AI Act stays
conditional and lightweight — low relevance for internal employee-tooling scenarios.

### Display priority

Do not remove framework columns. Per case card, mark one framework **primary** and collapse the
rest into "additional mappings". Primary per case: case 1 → ATLAS · case 2 → OWASP LLM03
Excessive Agency · case 3 → AIUC-1.

## Harness architecture

Full ReAct loop against live API targets, not a scripted trace.

WebLLM executes no tools, so the orchestrator owns the loop:

```
user task
  → build system prompt via controlGate(profile)
  → model turn (tools advertised)
  → parse tool-call intent          ← normalized across providers
  → authorityRegistry lookup + toolAuthorizationGate(profile)
      → blocked  → synthetic denial result fed back to model
      → allowed  → mockToolRouter returns parameterized-but-realistic result
  → feed result back, repeat (turn cap)
  → controls: adversarialDetection on tool output, piiLeakageGuard on final text,
    activityLogging over the whole event stream (shaped to satisfy AIUC-1 E015)
  → Evidence Contract, carrying evidence class + independence + status
```

Key properties:

- **Real tool-call intent, mock tool effect.** The model genuinely decides whether to call
  `send_email`; nothing leaves the browser. Mock tools for v1: `retrieve_document`,
  `read_file` / `write_file`, `web_search`, `send_email`, plus an MCP-shaped tool set for case 3.
- **Provider tool-calling in `adapter.js`.** OpenAI `tools` + `tool_calls`; Anthropic `tools`
  + `tool_use` content blocks. Normalize to one internal `{ tool, args, instructionSource }`
  shape — what `authorityRegistry` already expects.
- **Local-model fallback.** Small WebLLM models call tools unreliably. Provide a JSON-emit
  fallback (prompted schema, parsed from text) so local runs degrade instead of breaking, with
  the degradation recorded on the contract rather than hidden.
- **`instructionSource` provenance is the whole game.** Every tool call must carry whether its
  originating instruction came from `user` or from `retrieved_content` / tool output. That
  single field is what makes case 1 measurable and what `AML.M0030` is about.
- **Turn cap + loop guard**, recorded as evidence rather than only as a safety valve.

Per-case harness specifics:

- **Case 1:** untrusted document fixtures carrying injected instructions; success = a tool call
  whose `instructionSource` is `retrieved_content` executing.
- **Case 2:** high-risk tools with `requiresApproval: true`, exercised against the four HITL
  failure modes (flood, starvation, context stripping, denied-decision replay).
- **Case 3:** MCP-shaped registry entries carrying server provenance (sanctioned /
  unsanctioned), declared scope vs. task-required scope, and a poisoned tool *description*
  (the `AML.T0110.000` attack). Split 3a (runtime descriptor poisoning → ASI02) from
  3b (malicious server at source → ASI04).

## Reporting

One pipeline, not two. Agent runs produce findings in the existing findings/evidence/report
path, with:

- **Vocabulary decision:** keep both, disambiguated. Single-turn technique findings keep the
  probe vocabulary (`MODEL HELD` / `PARTIAL HIT` / …); agent runs use the control vocabulary
  (`CONTROL_HELD` / `PARTIAL_CONTROL_FAILURE` / `CONTROL_FAILED` / `INCONCLUSIVE`). They answer
  different questions — "did the model resist" vs. "did the control hold" — and collapsing them
  would overclaim. The report labels which vocabulary each section uses.
- **Evidence class on every finding:** E-class, I-class, and status, per the taxonomy above.
- **Scope field on every contract**, per ORPHEUS's `scope: 'detection_and_pii_only'`
  precedent: an agent-mode `CONTROL_HELD` covers tool authorization; a single-turn one does not.
- `simulated_only` retained and surfaced — mock tool effects must never read as real actions.

## Implementation order

Seven weeks to Offensive AI Con (Oceanside, Oct 4–7 2026, Seabird Ocean Resort).

| Week | Work | Status |
|---|---|---|
| 1 (Aug 17–23) | **Framework refresh, shipped independently.** OWASP 2026 migration repo-wide; ATLAS v6 refresh incl. agent techniques and `M0026`–`M0033`; `AML.T0054` rename; `OWASP_PUBLISHED_CROSSWALK`; `FRAMEWORK_VERSIONS`; ledger + attribution rewrite; regression tests. | **Done** — see below |
| 2 (Aug 24–30) | Port ORPHEUS harness skeleton into `src/harness/` under SLEEPER lint/test standards: `authorityRegistry`, `controls/*`, `controlProfiles`, `controlGate`. Tests for each control function. No ReAct yet. | **Done** — see below |
| 3 (Aug 31–Sep 6) | `adapter.js` port + tool-calling for OpenAI and Anthropic; normalized tool-call shape; local WebLLM JSON fallback. | **Done** — see below |
| 4 (Sep 7–13) | ReAct orchestrator + mock tool router (routing half only); the three cases as real scenarios with fixtures, tool sets, and MCP registry. | **Done** — see below |
| 5 (Sep 14–20) | Verdict rewrite with INCONCLUSIVE discipline + evidence-class fields; Evidence Contract wired into the existing findings/report pipeline. | **Done** — see below |
| 6 (Sep 21–27) | AIUC-1 crosswalk surfaced in `FindingCard` / `FrameworkMappingExplainer`; framework display prioritization. | |
| 7 (Sep 28–Oct 3) | Buffer, demo script, regenerate `sample-assessment-report.md`, README. | |

### Week 1, as landed (2026-08-16)

- `src/payloads.js` — OWASP IDs to 2026, `AML.T0054` → "LLM Jailbreak", ATLAS pin comment.
- `src/data/frameworkMappings.js` — `FRAMEWORK_VERSIONS`, OWASP 2026 references,
  `owasp_asi` ASI01–ASI10, eleven agent-layer ATLAS techniques, `OWASP_PUBLISHED_CROSSWALK`.
- `src/data/mitigationMappings.js` — `MITRE_AGENT_MITIGATIONS` (`M0026`–`M0033`), new pin.
- `src/data/frameworkMappings.test.js` — 11 regression tests guarding edition consistency,
  ATLAS naming, and crosswalk well-formedness.
- `docs/source-ledger.md` — new pins, ASI and AIUC-1 reference tables, 2025→2026 change table,
  the direct-vs-inferred exception, and the AIUC-1 licensing note.
- `ATTRIBUTION.md` — OWASP CC BY-SA 4.0 and ShareAlike note, ASI entry, AIUC-1 entry.
- `controls/*`, `README.md`, `docs/sample-assessment-report.md` — OWASP ID migration.

30 tests pass, lint clean (3 pre-existing warnings, unrelated).

### Week 2, as landed (2026-08-16)

Harness skeleton ported from ORPHEUS. Nothing wires these together yet — no ReAct loop, no
mock tool router, no verdict function.

- `src/harness/authorityRegistry.js` — v1 tool set from §Harness architecture
  (`retrieve_document`, `web_search`, `read_file`, `write_file`, `send_email`), trusted vs.
  untrusted source sets, `requiresExplicitApproval`. Deny-by-default.
- `src/harness/controlGate.js` — profile → literal system-prompt clause, SLEEPER-branded.
- `src/harness/controls/{toolAuthorizationGate,adversarialDetection,piiLeakageGuard,activityLogging}.js`
- `src/data/controlProfiles.js` — the four postures, plus `CONTROL_PROFILE_ORDER` and a getter.
- Seven test files, 82 new tests. 112 total pass, lint clean (same 3 pre-existing warnings).

**Corrections to the salvage assessment.** The §"Take largely as-is" table claims the control
functions "are not fixture-bound." Two of them were: `toolAuthorizationGate` imported
`HIGH_RISK_TOOLS` and `piiLeakageGuard` imported `DEMO_PII_SEEDS`, both from `demoTarget.js`,
which is on the throw-out list. Resolved on port — risk is read from the authority registry
(the single source of truth the plan already wanted it to be), and PII seeds are a parameter
supplied by the scenario.

Three other changes worth recording, since they alter behavior rather than packaging:

- **`authorization_present` split into `gate_enforcing` and `approval_granted`.** ORPHEUS's
  single field conflated "the gate is enforcing" with "an approval exists," so
  `authorization_present = mode === 'enforce'` meant a blocked call and an approved call were
  indistinguishable. Case 2's HITL failure modes need to vary approval while holding
  enforcement fixed, which the old shape could not express.
- **Untrusted provenance is now the registry's full untrusted set**, not a literal comparison
  against `'retrieved_content'`, and unattributed provenance counts as untrusted. A tool call
  with no recorded source is the case this module exists to catch.
- **Every control distinguishes "off" from "ran and found nothing."** `not_configured` vs.
  `not_triggered`, `scan_active: false` vs. a clean scan. This is the INCONCLUSIVE discipline
  pushed down into the control records themselves, so the week 5 verdict function has the
  information it needs rather than having to infer it.

Deferred to week 4 as planned: MCP-shaped registry entries (server provenance, declared vs.
required scope, poisoned tool descriptions). The registry schema takes them additively.

### Weeks 3–5, as landed (2026-08-16)

Built in parallel, then integrated. 446 tests, lint clean.

- `src/api/adapter.js` — OpenAI / Anthropic / generic, provider detection, SSE normalization,
  tool-calling both directions, local WebLLM JSON-emit fallback with degradation recorded on
  the result. The API key is a class private field (`#apiKey`), invisible to `JSON.stringify`
  and `Object.keys`, with an explicit `toJSON` so a later refactor cannot reintroduce it.
  This required `eslint.config.js` to move to `ecmaVersion: 2022`.
- `src/harness/mockToolRouter.js` — routing half only. `createAgenticSeedTrace()` was not
  ported in any form.
- `src/harness/runAgentCase.js` — the ReAct loop: control gate → model turn → provenance
  attribution → authorization → mock effect → feed back, with turn cap and loop guard recorded
  as evidence.
- `src/harness/computeVerdict.js` — INCONCLUSIVE discipline, reason codes on every verdict.
- `src/harness/evidenceContract.js` — E1–E5 / I0–I2 / status / scope, E4–E5 unreachable as a
  tested invariant rather than a comment.
- `src/data/agentCases.js` — four cases (`NR-AGT-001`, `-002`, `-003A`, `-003B`).
- `src/harness/runAgentAssessment.js` — the integration seam: case + profile + target → run →
  verdict → contract, plus `runCaseAcrossProfiles` for the comparative arm.

**Two more ORPHEUS `computeVerdict` defects, beyond the two this document already records.**
(c) Its baseline branch read `profile.controls` to infer whether a control had run, rather
than reading the control records. Under the Custom profile, or any run where a control was
configured on but never exercised, that branch misfires. (d) It treated `!attack_detected` as
evidence of safety with no ground truth about whether adversarial input was present — a clean
scan on a seeded-injection scenario is a miss, not a hold. The rewrite never inspects
`profile.controls`, and requires an explicit `scenario.adversarialInputPresent` before a clean
scan can count as anything.

**One defect of our own, found at integration.** The orchestrator aggregated zero detection
records into a synthetic "scan ran, found nothing" result. Paired with a case whose ground
truth says injected content exists, that made an unexercised detector read as a miss, and a
run where the model never retrieved the poisoned document resolved `CONTROL_FAILED`. Fixed by
reporting `scan_active: false` when no tool output was ever produced; regression test added.
It is the same failure shape as (d), which is worth noting: this error is easy to make even
while holding the discipline explicitly in mind.

**Framework gaps this work exposed — resolved 2026-08-17:**

- `AML.T0010.005` and `AML.T0011.002` are confirmed registered, verified directly against
  `dist/v6/ATLAS-2026.07.yaml` (the current `ATLAS-latest.yaml` target; no `2026.08` dist
  exists yet). Names match exactly what the case-3 table above already used: "AI Supply Chain
  Compromise: AI Agent Tool" and "User Execution: Poisoned AI Agent Tool." ATLAS's own
  description of `T0011.002` cross-references `T0010.005` as the supply-chain path by which
  the poisoned tool was introduced — the two are linked in the source, not just in this
  document. Both are now registered in `frameworkMappings.js` and the ledger.
  `agentCases.js`'s `ATLAS_IDS_PENDING_REGISTRY` mechanism and its "still missing" regression
  test are removed; a direct registration test replaces them.
- `AML.M0031` is **Memory Hardening** — registered, sits numerically inside the `M0026`–`M0033`
  range, but out of scope for every case in this module. It covers persistent agent
  memory/state integrity, which is the ASI06 memory-poisoning surface this document already
  defers (§"Threat cases"). Recorded in the ledger as a scope decision, not a missed
  registration. (ATLAS's own agent-mitigation numbering continues past this range too —
  `M0034` Deepfake Detection, `M0035` AI Red Team, `M0036` Limit AI Workload Resource
  Consumption — general-AI mitigations, not agent-specific in the same sense, and correctly
  outside this document's `M0026`–`M0033` framing.)
- **Date discrepancy resolved:** 2026-08-04 is correct. The source repo's README, at the
  pinned commit `7bbe0f06f468cdcc61fa73e1752183c6cfd23987`, states "Current release: 2026 —
  published August 4, 2026" directly; the commit's own message corroborates ("Updates the
  repository to reflect the August 4, 2026 publication," authored 2026-08-05, one day after).
  §OWASP LLM Top 10 2026 above corrected from "2026-08-03" to "2026-08-04" to match
  `FRAMEWORK_VERSIONS.owasp_llm`, which was already right.

**Framework gaps still open:**

- The AIUC-1 table has a single case-3 row, but the 3a/3b split needs two. The allocation used
  (`B006`/`B008`/`A003` for runtime descriptor integrity; `E006`/`E009`/`B006`/`A003`/`B008`
  for source provenance) is ours, not this document's.
- Case 1's OWASP `LLM01:2026` and case 3b's `LLM04:2026` are inferred here — this document
  tabulates OWASP LLM IDs for only two cases. `LLM04:2026` is at least corroborated by OWASP's
  own published `LLM04 → ASI04` crosswalk row.

**One ordering choice worth a second opinion:** `requestServiced: false` short-circuits to
INCONCLUSIVE *before* control classification, so a PII exposure observed on an unserviced run
is masked. The harness-level signal was judged more trustworthy; reversing it is a one-line
change if observed exposures should always survive.

## Open items

1. **Brand art** — SLEEPER ships a text wordmark. `public/brand/` was removed with ELICIT's
   assets; an icon, wordmark, and social preview are still needed.
2. **AIUC-1 quotation permission** — the changelog repo has no license. Short attributed
   quotes are defensible; if the module leans on AIUC-1 as its lead framework, a note to
   AIUC (their site links a contact) asking about citation terms is cheap insurance and a
   reasonable conversation to have before the conference.
3. **CC BY-SA / Apache 2.0 boundary** — currently handled by reproducing OWASP IDs and
   ID-level relationships only, no descriptive prose. Fine as it stands; revisit if the module
   starts embedding OWASP mitigation text.
4. **Historical findings** — exports created before today carry `LLM0X:2025` IDs. The ledger
   documents the mapping. No migration shim is written; findings are immutable evidence and
   probably should stay that way, but worth confirming.

## Risks

- **Live-target tool calling costs money and needs keys on a conference network.** Ensure the
  local WebLLM path can demo all three cases unattended.
- **AIUC-1 quarterly cadence** — next release likely mid-October, after the conference. Pin
  2026-07-15 and carry the currency note; do not chase.
- **Three cases at equal depth in seven weeks is the aggressive option.** Weekly checkpoint:
  if week 4 ends without all three running end to end under one profile, cut case 2's
  HITL failure modes to flood + context-stripping only and keep the rest whole.
