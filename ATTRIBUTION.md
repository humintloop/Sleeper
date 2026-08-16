# Attribution

NETRUNNER references public taxonomy and framework sources so findings can be traced back to maintained external material. NETRUNNER's controls, recommended actions, framework mappings, and retest guidance are project-defined unless explicitly labeled as MITRE ATLAS, OWASP, ISO/IEC, EU AI Act, NIST, or another named source.

## MITRE ATLAS

This project references MITRE ATLAS technique and mitigation identifiers, names, and taxonomy metadata from the MITRE ATLAS data repository.

- Source: https://github.com/mitre-atlas/atlas-data
- License: Apache License 2.0
- Copyright: Copyright 2021-2026 MITRE
- Referenced file: `dist/v6/ATLAS-2026.07.yaml` (content v2026.07, format-version 6.0.0)

MITRE ATLAS references are used as source-grounded technique and mitigation references. NETRUNNER's control mappings, recommended actions, and retest guidance are not official MITRE guidance.

## OWASP LLM Top 10

This project references OWASP Top 10 for Large Language Model Applications categories and names for risk traceability.

- Source: https://github.com/GenAI-Security-Project/GenAI-LLM-Top10
- License: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)
- Referenced material: OWASP Top 10 for LLM Applications 2026 category IDs and names, and the ID-level relationships published in Appendix A, *Related Framework Mappings*
- Referenced commit: `7bbe0f06f468cdcc61fa73e1752183c6cfd23987`

OWASP references are used as source-grounded risk categories. NETRUNNER's control mappings, recommended actions, and retest guidance are not official OWASP guidance.

## OWASP Top 10 for Agentic Applications (ASI)

This project references the OWASP Top 10 for Agentic Applications risk IDs and names in the agent threats module.

- Source: https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/
- License: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)
- Referenced material: OWASP Top 10 for Agentic Applications 2026 (v2026, December 2025) — ASI01–ASI10 IDs and titles, and the scope boundaries between entries

**ShareAlike note:** OWASP material is CC BY-SA 4.0 while this repository is Apache 2.0. NETRUNNER reproduces OWASP identifiers, entry titles, and ID-level mapping relationships with attribution, and does not reproduce OWASP's descriptive or relevance prose. Any future work that adapts substantial OWASP text into this repository needs a licensing decision first.

## AIUC-1

This project references AIUC-1 requirement and control identifiers and short requirement names in the agent threats module.

- Source: https://www.aiuc-1.com — change history at https://github.com/aiunderwriting/AIUC-1-Changelog
- License: none published; identifiers and short requirement names are cited directly, control language is paraphrased rather than reproduced
- Referenced material: AIUC-1 2026-07-15 release, requirement and control IDs and requirement names

AIUC-1 revises quarterly. Every AIUC-1 citation in this repository records the release date it was read from. NETRUNNER does not reproduce the requirement or control set in bulk, and no NETRUNNER output is an AIUC-1 conformity assessment or certification.

## Framework References

ISO/IEC 42001, EU AI Act, and NIST AI RMF references are used as relevance indicators for assurance and readiness discussions. They are not legal, audit, certification, or compliance determinations.

See [`docs/source-ledger.md`](./docs/source-ledger.md) for the detailed source ledger.
