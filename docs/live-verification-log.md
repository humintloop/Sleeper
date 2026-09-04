# Live Verification Log

This is the record of every time one of Sleeper's four threat cases has actually been run
against a real model — Live API target, not Sample Replay, not a local WebLLM model — and
reached evidence class E3 (an observed model decision, not a scripted one). See
[`evidence-classes.md`](evidence-classes.md) for what E3 means and why the harness cannot
claim higher.

**There are no entries below.** This file is the ledger's schema and its rules, committed
before any live run exists, precisely so that the first real entry cannot be mistaken for a
seeded or fabricated one — every row from here on was added after a run that actually happened.
Nothing in this project writes to this file automatically; it is filled in by hand, by whoever
holds the API key, after looking at the result.

## What qualifies as an entry

A row may be added only when:

1. The run used the **Live API** target (`target_type: 'live'` in the run's own configuration),
   not Sample Replay and not a local model.
2. The completed run's Evidence Contract reports `evidence.max_class_claimed: 'E3'`.
3. The run's Evidence Contract JSON has been downloaded and kept — this log is an index into
   those files, not a substitute for them. Evidence Contract downloads are named
   `<case_id>-<profile_id>.json` by default (`historical-` prefixed if exported stale); rename
   the kept copy to include the date if you run the same case/profile more than once.

A run that errored before producing a result, degraded mid-run, or fell back to the local
JSON-tool-call path does not qualify — record it in this table's Notes column if it's worth
remembering, but do not report it as a completed E3 verification.

Optional: after saving a run as a [verified capture](../src/components/CapturedRuns.jsx) (the
in-app "Save as verified capture" action, available whenever a completed result meets the same
gate above), its exported JSON is a second, browser-independent copy of the same evidence and
can be attached alongside the Evidence Contract file.

## Log

| Date | Case | Provider : Model | Control Profile | Verdict | Evidence Contract file | Notes |
|---|---|---|---|---|---|---|
| _(none yet)_ | | | | | | |

## Case reference

| Case ID | Title |
|---|---|
| `NR-AGT-001` | External Email Injection to Internal Data Exfiltration |
| `NR-AGT-002` | Excessive Agency and Insufficient Human Approval |
| `NR-AGT-003A` | Poisoned MCP Tool Descriptor at Runtime |
| `NR-AGT-003B` | Unsanctioned or Compromised MCP Server at the Source |

## Providers

The Live API target adapter (`src/api/adapter.js`) supports Anthropic (default), OpenAI, and a
generic OpenAI-compatible endpoint. A key is entered in the browser for the session only — it is
held in memory, never written to storage, and never leaves this log or the app itself.
