# ISO/IEC 42001 Relevance Notes

These notes explain how Sleeper uses ISO/IEC 42001 references. They are traceability aids, not certification claims.

## Source Basis

- Official source page: ISO/IEC 42001:2023, "Information technology - Artificial intelligence - Management system"
- User-provided working reference: `sunilp/ai-governance-framework`, `framework/compliance/iso-42001-mapping.md`

The official ISO page describes ISO/IEC 42001 as an AI management system standard for establishing, implementing, maintaining, and continually improving an AIMS. The project uses the user-provided mapping for section 9 labels:

- 9.1 Monitoring, measurement, analysis, and evaluation
- 9.2 Internal audit
- 9.3 Management review

## How Sleeper Uses Section 9

Sleeper turns local adversarial testing into performance-evaluation evidence:

- **9.1 Monitoring, measurement, analysis, and evaluation:** case results, verdicts, model metadata, response evidence, trendable control gaps, and retest outcomes.
- **9.2 Internal audit:** run IDs, case versions, mapped controls, reviewer decisions, and retained evidence that can support an audit sample.
- **9.3 Management review:** repeated findings, unresolved reviewer decisions, systemic failure patterns, and mitigation/retest status that can be escalated to management review.

## Important Boundary

Sleeper does not determine ISO/IEC 42001 conformance. It helps show where an AI management system would need evidence that controls are working, failing, or improving over time.
