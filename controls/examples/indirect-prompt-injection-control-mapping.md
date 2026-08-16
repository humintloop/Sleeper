# Example: Indirect Prompt Injection / RAG Control Mapping

## Scenario

An evaluation case embeds malicious instructions inside content the model is asked to process, such as a document, email, web page, ticket, retrieved chunk, or tool output.

## Source Relevance

- MITRE ATLAS: `AML.T0051.001` Indirect
- OWASP LLM Top 10: `LLM01:2026` Prompt Injection
- OWASP LLM Top 10: `LLM09:2026` Vector and Embedding Weaknesses
- OWASP LLM Top 10: `LLM02:2026` Sensitive Information Disclosure

## Project-Defined Controls

- `LLM-SEC-003` RAG and External Content Trust Boundaries
- `LLM-SEC-001` Prompt Injection Resistance
- `LLM-SEC-005` Sensitive Data Handling
- `LLM-EVAL-001` Adversarial Evaluation and Regression Testing
- `LLM-MON-001` AI Output Monitoring and Incident Detection

## Evidence to Preserve

- indirect evaluation case ID and version
- source type such as document, email, webpage, ticket, retrieved content, or tool output
- source trust label if available
- injected content excerpt
- model response excerpt
- evaluator decision
- mapped controls
- notes on whether the model treated content as data or instruction

## Official Mitigation References

- MITRE ATLAS: `AML.M0024` AI Telemetry Logging
- MITRE ATLAS: `AML.M0033` Input and Output Validation for AI Agent Components

## NETRUNNER Recommended Actions

- Clearly label retrieved and external content as untrusted data.
- Keep user instructions, system instructions, retrieved content, and tool output in separate channels or structures where possible.
- Use permission-aware retrieval and tenant-aware vector stores.
- Validate and sanitize documents before indexing or retrieval.
- Log retrieved sources used in high-impact responses.
- Test that retrieved content cannot authorize tool calls or override higher-priority instructions.

## Retest Guidance

Rerun indirect injection cases after:

- adding or changing retrieval sources
- changing chunking or embedding strategy
- changing vector-store permissions
- adding web, email, ticket, document, or tool-output ingestion
- remediating retrieval contamination or cross-tenant leakage
