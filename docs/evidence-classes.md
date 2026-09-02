# Evidence Classes

This taxonomy — evidence class E1–E5, oracle independence I0–I2, and status — is **self-authored
by this project.** It is not MITRE, OWASP, NIST, ISO, an audit standard, or any other external
body's scale. It exists so every claim Sleeper produces states, structurally rather than in
prose, exactly what kind of evidence it is and what it does not let you conclude.

## A worked example first

Say a run denies a proposed `send_email` call under the Reference control profile. What does
that single event actually let you claim?

- **It lets you claim:** Sleeper's own authorization gate, faced with a tool call whose
  instruction came from untrusted content, denied it. That is a real, mechanical fact about this
  harness's control point — worth recording, worth citing.
- **It does not let you claim:** that a production system would have blocked the same call. The
  gate that fired is Sleeper's own, running in a lab against a mock tool router. Nothing about a
  real deployment's authorization layer was exercised.
- **It does not let you claim:** anything about *why* the model proposed the call in the first
  place, unless a real model was the one deciding — under Sample Replay, the tool intent came
  from a scripted fixture, not a model, so this event is silent on model behavior entirely.
- **It does not let you claim** that this record is tamper-proof, independently witnessed, or
  admissible the way a signed, append-only log would be. It's a JSON object in a browser, with a
  self-digest that only proves nobody edited it *after Sleeper wrote it* — not that Sleeper's own
  process couldn't be tampered with, and not that anyone outside this codebase reviewed it.

Every field below exists to make exactly this kind of distinction checkable instead of asserted.

## The taxonomy

Every finding records what it actually permits its author to claim, on three axes:

### Evidence class (E1–E5)

| Class | Name | What it means |
|---|---|---|
| E1 | Observation | A fact was recorded. No characterization of behavior, no enforcement. |
| E2 | Runtime characterization | Real behavior was observed under real conditions — e.g. a real model's live response to a prompt, no control point tested. |
| E3 | Enforcement | A control point actually intervened — blocked, redacted, or otherwise acted — and that action was recorded. |
| E4 | Persistence and replay resistance | The record survives replay/tampering attempts under an independently verifiable scheme (signed, append-only, nonce'd). |
| E5 | Isolation and security boundary | The claim is backed by an enforced security/isolation boundary, not just application logic. |

**Nothing Sleeper produces reaches E4 or E5.** `EVIDENCE_CLASS_CEILING` in
[`src/harness/evidenceContract.js`](../src/harness/evidenceContract.js) is `E3`, and
`assertClaimableEvidenceClass` in that file throws if any code path tries to claim higher — this
is an enforced invariant with a test behind it, not a comment that can drift out of date. A tool
call blocked at Sleeper's own gate is E3 *for that gate* and still only E2 for the target being
evaluated: the enforcement observed is Sleeper's own, and reporting one merged class would let
the harness's control point read as the target's.

### Oracle independence (I0–I2)

| Level | Name | What it means |
|---|---|---|
| I0 | Self-authored oracle | The controls, their records, and the verdict function are all authored by this project. |
| I1 | Independently reimplemented oracle | A separate implementation, built independently from this one, reached the same verdict. |
| I2 | Independent sensor the target does not control | A sensor outside the target's own control surface produced the observation. |

Every run in Sleeper is **I0** unless explicitly stated otherwise. The secondary local-model
judge (an optional triangulation feature) does not raise this — it is still self-authored
tooling reviewing the same run, not an outside check.

### Status

`mapped` → `executed` → `independently reviewed` → `certified`. A framework crosswalk entry is
`mapped` and E1 material *regardless of how many requirements it covers* — mapping many
requirements to one control does not make the mapping itself any more executed or reviewed.

### Two consequences worth stating up front

1. When Sleeper blocks a tool call, that is enforcement **by Sleeper's own gate**, and evidence
   about the target's behavior only. A mock-tool run does not establish that a production system
   would have blocked anything.
2. An unexercised control resolves to `INCONCLUSIVE`, never to "held." If the model never
   attempted the tool call, the tool-authorization control was not tested — and that has to
   survive even when a run also fails for an unrelated reason (`requestServiced: false` is
   checked *after* failure detection in `computeVerdict.js`, so an observed exposure can never be
   masked by a harness-level problem).

<!-- AUTHOR: review framing -->
## For assurance practitioners

If you come from financial or compliance audit rather than offensive security, the closest
mental model is the distinction between design effectiveness and operating effectiveness: a
framework crosswalk (`mapped`) says a control *should* address a requirement, the way a
walkthrough documents that a control is designed correctly, while an executed run (`executed`,
E2/E3) is closer to a test of operating effectiveness — did the control actually function during
the period observed. `INCONCLUSIVE` in place of a false "held" is the same discipline as an
auditor declining to conclude on a control that was never operated during the sample period,
rather than assuming it would have worked. And the E4/E5 ceiling functions like a scope
limitation stated in an assurance report: it says plainly what this lab's evidence cannot reach,
rather than letting the reader assume the report covers more than it does.

| Audit concept | Sleeper equivalent |
|---|---|
| Design effectiveness (walkthrough) | `mapped` — a framework crosswalk entry, E1 |
| Operating effectiveness (test of controls) | `executed` — a control actually fired during a run, E2/E3 |
| Scope limitation stated in the report | The E4/E5 ceiling — persistence/replay-resistance and isolation-boundary evidence are explicitly out of scope, always |
<!-- /AUTHOR: review framing -->
