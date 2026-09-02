# Results Write-ups

One results-writeup template per threat case, structured: claim under test → target model and
configuration digest → number of trials → outcome table → evidence class and scope →
limitations.

Every number in these files today comes from the Sample Replay path — deterministic, sourced,
and cross-checked against the contracts in [`../../examples/`](../../examples/). Nothing here is
invented. Anywhere a live or local model number belongs instead, the file says `TODO` rather
than guessing, per this project's evidence discipline: no fabricated trial counts, model
outputs, or statistics.

| File | Case |
|---|---|
| [`case-1-indirect-injection.md`](./case-1-indirect-injection.md) | External Email Injection to Internal Data Exfiltration |
| [`case-2-excessive-agency.md`](./case-2-excessive-agency.md) | Excessive Agency and Insufficient Human Approval |
| [`case-3a-poisoned-mcp-descriptor.md`](./case-3a-poisoned-mcp-descriptor.md) | Poisoned MCP Tool Descriptor at Runtime |
| [`case-3b-malicious-mcp-server.md`](./case-3b-malicious-mcp-server.md) | Unsanctioned or Compromised MCP Server at the Source |

A reviewer who has not cloned the repo can read these to see the shape of a real results
write-up — including its honest gaps — before any live-model trial exists.
