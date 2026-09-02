# Sleeper — Local-First Agent Assurance Lab

[![CI](https://github.com/humintloop/Sleeper/actions/workflows/ci.yml/badge.svg)](https://github.com/humintloop/Sleeper/actions/workflows/ci.yml)

> Run agents against adversarial content in the browser. Watch the tool calls. Map the control gap.

---

## What This Is

Sleeper tests whether an AI agent can be manipulated into taking an action it should not
take, and turns the result into reviewable evidence mapped to published control frameworks.

The question is not "did the model say something bad." It is:

> Given real tools, does the agent act on an instruction hidden in something it reads — and
> does anything stop it?

An agent's security properties live in the gap between what it *says* and what it *does*.
Sleeper instruments that gap: a real tool-calling loop where the model genuinely decides
whether to call `send_email`, against mock tools where nothing actually leaves the browser.

The sharpest demonstration of that isn't one model's reply to one adversarial prompt — it's
running the *same* case against the *same* model under multiple control postures and comparing
what the model attempted, what each deterministic control actually did, and what evidence
survived. Outcomes are observations, not promises: a run may fail, hold within a stated scope,
degrade, or remain `INCONCLUSIVE` when the model never exercises the relevant control. The
claim is narrower and testable: security decisions must come from controls around the model,
not from assuming the model will refuse an adversarial instruction.

Sleeper descends from [ELICIT](https://github.com/humintloop/ELICIT), a single-turn adversarial
assurance lab. It no longer runs single-turn probes itself — the agent harness demonstrates the
same claim more directly, by comparing control postures against the same case rather than
comparing single-turn refusal against agentic follow-through. ELICIT remains the place for
single-turn evaluation.

## Status

The agent harness is built and wired end to end in the browser, with a no-key deterministic
replay plus live API and local WebLLM targets. The automated suite is 508 tests across 25
files; 170 of those tests, across 9 files (`computeVerdict`, `VerdictBanner`,
`authorityRegistry`, `toolAuthorizationGate`, `approvalPolicy`, `runProvenance`,
`replayTarget`, `evidenceContract`, `evidenceWitness`), cover the verdict, authorization,
provenance, replay, and evidence-contract invariants specifically. See
[`docs/agent-module-plan.md`](./docs/agent-module-plan.md) for the architecture and the
source-verified framework crosswalk.

## Threat Cases (v1 scope)

| Case | Scenario | Primary mapping |
|---|---|---|
| **1. Indirect injection → unauthorized action** | An employee points an agent at untrusted content — a ticket, a PR, an email, a scraped page. Hidden instructions in that content hijack the agent into an action nobody asked for. | `AML.T0051.001` + `AML.T0053` · ASI01 |
| **2. Excessive agency / insufficient approval** | The agent holds tool access to consequential, irreversible, or externally-visible actions with an approval gate that is missing, bypassable, or degrades under load. | `LLM03:2026` Excessive Agency · `AML.M0029` |
| **3a. Poisoned MCP tool descriptor** | A tool's *definition* is poisoned at runtime — the interface of an otherwise legitimate tool is manipulated. | `AML.T0110.000` · ASI02 |
| **3b. Malicious or over-permissioned MCP server** | An agent connects to an unsanctioned or compromised MCP server, or an internal one scoped far broader than the task needs. | `AML.T0010.005` · AIUC-1 `E006`/`E009` |

Deferred to a later scope: memory poisoning (ASI06), inter-agent communication (ASI07),
identity spoofing.

## Evidence Discipline

Every finding records what it actually permits you to claim, on three axes:

- **Evidence class (E1–E5).** Observation → runtime characterization → enforcement →
  persistence/replay resistance → isolation. Nothing Sleeper produces reaches E4 or E5, and
  it says so — enforced in code, not just documented.
- **Oracle independence (I0–I2).** Who produced the verdict: self-authored, independently
  reimplemented, or an independent sensor the target does not control. Sleeper is I0.
- **Status.** Mapped / executed / independently reviewed / certified. A framework crosswalk is
  E1 material regardless of how many requirements it covers.

Two consequences worth stating up front:

1. When Sleeper blocks a tool call, that is enforcement **by Sleeper's own gate**, and
   evidence about the target's behavior only. A mock-tool run does not establish that a
   production system would have blocked anything.
2. An unexercised control resolves to `INCONCLUSIVE`, never to "held." If the model never
   attempted the tool call, the tool-authorization control was not tested.

## Framework Traceability

Findings map to MITRE ATLAS, the OWASP Top 10 for LLM Applications, the OWASP Top 10 for
Agentic Applications, AIUC-1, NIST AI RMF, ISO/IEC 42001 §9, and conditional EU AI Act
readiness notes.

Every framework reference is pinned to a source version in
[`docs/source-ledger.md`](./docs/source-ledger.md), which also records whether each mapping is
**direct** (the source asserts the relationship) or **inferred** (this project asserts it).
Most are inferred, and the ledger says which.

Current pins: MITRE ATLAS content v2026.07 · OWASP LLM Top 10 2026 · OWASP Agentic Top 10 2026
· AIUC-1 2026-07-15.

## Responsible Use

For authorized security research, internal AI assurance, and evaluation of systems you own or
have explicit permission to test. Do not use against production AI systems without
authorization.

Framework mappings are control traceability aids. They are **not** legal conclusions, audit
determinations, certification evidence, or findings of noncompliance. No Sleeper output is a
conformity assessment against any standard.

Mock tools never take real actions — no email is sent, no file is written, no API is called.
Every run carries `simulated_only` so a mock effect is never mistaken for a real one.

Attribution and sources: [`ATTRIBUTION.md`](./ATTRIBUTION.md),
[`docs/source-ledger.md`](./docs/source-ledger.md). Security reports: [`SECURITY.md`](./SECURITY.md).
Licensed Apache 2.0; see [`LICENSE`](./LICENSE).

## Local Setup

```bash
npm install
npm run dev
```

Requires a desktop browser with WebGPU (Chrome, Edge, or Arc) for the local-model target.
Models download into browser storage on first load and are cached there. The live-API target
needs no local model at all.

```bash
npm test    # vitest
npm run lint
npm run build
```

## Targets

- **Sample Replay (no key)** — a deterministic scripted tool path for a reliable walkthrough.
  It exercises Sleeper's gates and evidence pipeline, but is E1 target evidence because no
  model made a decision. The contract states that limitation explicitly.
- **Local (WebLLM/WebGPU)** — models run entirely in the browser. Nothing leaves the machine.
  Small models call tools unreliably, so this path never uses real tool-calling: a prompted
  JSON schema stands in, and every run against a local model is recorded `degraded: true` —
  visible on the trace, never hidden.
- **Live API (Anthropic first)** — agent runs against a real endpoint, with real provider
  tool-calling. The API key is held in memory for the session and never written to storage.

Use repeat trials for a distribution rather than treating one stochastic model run as a
stable result. Each trial gets its own Evidence Contract; the aggregate reports verdict and
action rates and whether the recorded configurations match. Repeated Sample Replay trials are
determinism checks, not independent model observations.

An optional **secondary local-model judge** can review a blinded, bounded trace for malicious
goal adoption and unauthorized-action intent. Its prompt/model/packet digests and raw structured
opinion are retained. It never overrides deterministic trace facts and does not raise oracle
independence above I0; it is triangulation, not independent review. When the target is local,
Sleeper requires a different judge model to reduce correlated failure.

## Persistence

Completed agent-case runs — verdict, reason, and the full Evidence Contract — are saved to
this browser's local storage (most recent 20), so navigating away doesn't lose the run. Nothing
else is persisted: there is no in-progress "resume a half-configured case" state, since a run
is a single self-contained action, not a multi-step wizard.

Each contract records the source revision/dirty state when available and digests the case,
profile, configuration, and advertised tool schema. It also carries an unsigned SHA-256
self-digest that detects accidental mutation. Browser-local records remain editable and the
digest can be recomputed by an attacker; this is not signed, replay-resistant audit evidence.

Retained browser runs are also linked into a SHA-256 history chain. Verification detects
accidental record mutation, deletion, or reordering within the retained window. Legacy records
are labeled unverifiable and migrated when the next run is appended. Because localStorage and
the application share one trust boundary, the whole chain can still be replaced and recomputed.

The harness includes a deliberately unconfigured external-witness interface. A future signer
must both attest and verify a receipt bound to the contract digest; replay resistance is claimed
only when that verified receipt also carries append-only sequencing, a nonce, and a timestamp.
Sleeper contains no private signing key and makes no remote call by default.

For a concise portfolio presentation, follow the
[`7-minute walkthrough`](./docs/portfolio-walkthrough.md).

## Limitations

- Evaluates model behavior in a lab, against a mock-tool harness. It does not prove production
  exploitability, and no tool effect in this project is ever real.
- Results vary by model, provider, runtime, quantization, prompt, context, and temperature.
- Browser inference is bounded by GPU memory, WebGPU support, cache storage, and tab lifecycle.
- ISO/IEC 42001 and EU AI Act relevance depends on system role, scope, risk classification,
  jurisdiction, and deployment context. High-risk *readiness* is not high-risk *classification*.

## Roadmap

See [`docs/agent-module-plan.md`](./docs/agent-module-plan.md) for the architecture and
framework crosswalk. Open: AIUC-1 3a/3b crosswalk allocation and two inferred OWASP LLM
mappings are this project's own judgment calls rather than sourced facts (flagged as such in
the plan doc); there's a favicon but no social-preview asset, and the wordmark is text-only.
