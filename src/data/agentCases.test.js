import { describe, it, expect } from 'vitest';
import {
  AGENT_CASES,
  AGENT_CASES_VERSION,
  AGENT_CASE_GROUPS,
  AGENT_CASE_ORDER,
  AIUC_1_RELEASE,
  AIUC_1_STANDARD_CURRENCY,
  CANARY_SEEDS,
  CLAIM_BOUNDARY,
  MAPPING_RELATIONSHIPS,
  getAgentCase,
  getAgentCasesByGroup,
  getCaseMappingsByFramework,
  getPrimaryMapping,
  listAgentCases,
} from './agentCases';
import { FRAMEWORK_REFERENCES, OWASP_PUBLISHED_CROSSWALK } from './frameworkMappings';
import {
  DEFAULT_AUTHORITY_REGISTRY,
  TRUSTED_SOURCES,
  UNTRUSTED_SOURCES,
} from '../harness/authorityRegistry';

// These tests guard the framework crosswalk in agentCases.js against
// docs/agent-module-plan.md and docs/source-ledger.md. Like
// frameworkMappings.test.js they are consistency checks, not assertions that a
// mapping is substantively correct — that is a source-review question. What
// they do catch is the class of defect that got ORPHEUS's orpheusCases.js
// thrown out: IDs from the wrong edition, IDs that resolve nowhere, and
// project-asserted mappings presented as if a source asserted them.

const CASES = listAgentCases();

const FRAMEWORK_KEYS = [
  'mitre_atlas',
  'mitre_atlas_mitigation',
  'owasp_llm',
  'owasp_asi',
  'aiuc_1',
];

const allMappings = () => CASES.flatMap(c => c.mappings);
const mappingsFor = (framework) => allMappings().filter(m => m.framework === framework);
const idsFor = (framework) => mappingsFor(framework).map(m => m.id);
const allFixtures = () => CASES.flatMap(c => c.fixtures);

describe('case registry structure', () => {
  it('exposes the three threat cases with case 3 split into 3a and 3b', () => {
    expect(AGENT_CASE_ORDER).toEqual(['NR-AGT-001', 'NR-AGT-002', 'NR-AGT-003A', 'NR-AGT-003B']);
    expect(Object.keys(AGENT_CASES).sort()).toEqual([...AGENT_CASE_ORDER].sort());
    expect(AGENT_CASES_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('keys every case by its own id', () => {
    Object.entries(AGENT_CASES).forEach(([key, agentCase]) => {
      expect(agentCase.id).toBe(key);
    });
  });

  it('groups every case, and groups reference only real cases', () => {
    expect(AGENT_CASE_GROUPS).toEqual({
      'case-1': ['NR-AGT-001'],
      'case-2': ['NR-AGT-002'],
      'case-3': ['NR-AGT-003A', 'NR-AGT-003B'],
    });
    Object.values(AGENT_CASE_GROUPS).flat().forEach(id => {
      expect(AGENT_CASES[id]).toBeTruthy();
    });
    CASES.forEach(agentCase => {
      expect(AGENT_CASE_GROUPS[agentCase.group]).toContain(agentCase.id);
    });
  });

  it('gives every case a title, family, scenario, conditions, and mappings', () => {
    CASES.forEach(agentCase => {
      expect(agentCase.title).toBeTruthy();
      expect(agentCase.family).toBeTruthy();
      expect(agentCase.scenario.narrative).toBeTruthy();
      expect(agentCase.scenario.user_task).toBeTruthy();
      expect(Array.isArray(agentCase.scenario.attack_path)).toBe(true);
      expect(agentCase.scenario.attack_path.length).toBeGreaterThan(0);
      expect(agentCase.mappings.length).toBeGreaterThan(0);
      expect(agentCase.fixtures.length).toBeGreaterThan(0);
    });
  });

  it('resolves lookups and returns null rather than throwing on an unknown id', () => {
    expect(getAgentCase('NR-AGT-001').id).toBe('NR-AGT-001');
    expect(getAgentCase('NR-AGT-999')).toBeNull();
    expect(getAgentCase(undefined)).toBeNull();
    expect(getAgentCasesByGroup('case-3').map(c => c.id)).toEqual(['NR-AGT-003A', 'NR-AGT-003B']);
    expect(getAgentCasesByGroup('case-nope')).toEqual([]);
    expect(getCaseMappingsByFramework('NR-AGT-999', 'owasp_llm')).toEqual([]);
    expect(getPrimaryMapping('NR-AGT-001', 'nist_ai_rmf')).toBeNull();
  });
});

describe('OWASP LLM Top 10 — 2026 edition only', () => {
  it('uses only well-formed 2026-edition LLM IDs in mappings', () => {
    const ids = idsFor('owasp_llm');
    expect(ids.length).toBeGreaterThan(0);
    ids.forEach(id => expect(id).toMatch(/^LLM\d{2}:2026$/));
  });

  it('resolves every LLM ID against the shared reference table, with the same short name', () => {
    mappingsFor('owasp_llm').forEach(m => {
      expect(FRAMEWORK_REFERENCES.owasp[m.id]).toBeTruthy();
      expect(m.name).toBe(FRAMEWORK_REFERENCES.owasp[m.id]);
    });
  });

  it('maps Excessive Agency to LLM03, not LLM06 — the 2025 number', () => {
    const primary = getPrimaryMapping('NR-AGT-002', 'owasp_llm');
    expect(primary.id).toBe('LLM03:2026');
    expect(primary.name).toBe('Excessive Agency');
    expect(idsFor('owasp_llm')).not.toContain('LLM06:2026');
    expect(idsFor('owasp_llm')).not.toContain('LLM06:2025');
  });

  it('uses LLM08 Hidden Context Exposure for tool-schema exposure, not LLM07 System Prompt Leakage', () => {
    const descriptorPoisoning = getPrimaryMapping('NR-AGT-003A', 'owasp_llm');
    expect(descriptorPoisoning.id).toBe('LLM08:2026');
    expect(descriptorPoisoning.name).toBe('Hidden Context Exposure');
    expect(idsFor('owasp_llm')).not.toContain('LLM07:2026');
    expect(idsFor('owasp_llm')).not.toContain('LLM07:2025');
  });

  it('carries no 2025-edition ID anywhere except a deliberately preserved ASI cross-reference', () => {
    CASES.forEach(agentCase => {
      const stale = JSON.stringify(agentCase).match(/LLM\d{2}:2025/g) ?? [];
      const preserved = agentCase.asi_cross_references.map(ref => ref.published.llm_id);
      // Every 2025 ID in the case must be accounted for by a published ASI
      // cross-reference. Nothing else may carry one.
      stale.forEach(id => expect(preserved).toContain(id));
    });
  });

  it('preserves the published 2025 ID and adds the 2026 equivalent alongside it', () => {
    const [ref] = getAgentCase('NR-AGT-002').asi_cross_references;
    expect(ref.asi).toBe('ASI02');
    expect(ref.published.llm_id).toBe('LLM06:2025');
    expect(ref.published.edition).toBe('2025');
    expect(ref.published.relationship).toBe('direct');
    expect(ref.current_edition.llm_id).toBe('LLM03:2026');
    expect(ref.current_edition.edition).toBe('2026');
    // The translation across editions is ours, not OWASP's.
    expect(ref.current_edition.relationship).toBe('inferred');
    expect(ref.current_edition.llm_name).toBe(FRAMEWORK_REFERENCES.owasp['LLM03:2026']);
  });

  it('records a cross-reference note on every case, including the ones carrying none', () => {
    CASES.forEach(agentCase => {
      expect(Array.isArray(agentCase.asi_cross_references)).toBe(true);
      expect(agentCase.asi_cross_reference_note).toBeTruthy();
    });
  });
});

describe('MITRE ATLAS techniques and mitigations', () => {
  it('uses well-formed technique IDs', () => {
    idsFor('mitre_atlas').forEach(id => expect(id).toMatch(/^AML\.T\d{4}(\.\d{3})?$/));
  });

  it('uses well-formed mitigation IDs, and never a technique ID in the mitigation slot', () => {
    const ids = idsFor('mitre_atlas_mitigation');
    expect(ids.length).toBeGreaterThan(0);
    ids.forEach(id => expect(id).toMatch(/^AML\.M\d{4}$/));
  });

  it('names every ATLAS entry', () => {
    [...mappingsFor('mitre_atlas'), ...mappingsFor('mitre_atlas_mitigation')].forEach(m => {
      expect(typeof m.name).toBe('string');
      expect(m.name.length).toBeGreaterThan(0);
    });
  });

  it('resolves every technique ID against the shared reference table', () => {
    // Every ATLAS ID this module cites must be registered in
    // frameworkMappings.js — there is no local fallback name table. Verified
    // 2026-08-17 against dist/v6/ATLAS-2026.07.yaml (see source-ledger.md).
    mappingsFor('mitre_atlas').forEach(m => {
      expect(FRAMEWORK_REFERENCES.mitre_atlas[m.id]).toBeTruthy();
      expect(m.name).toBe(FRAMEWORK_REFERENCES.mitre_atlas[m.id]);
    });
  });

  it('registers the case-3 supply-chain techniques added alongside case-3 data', () => {
    expect(FRAMEWORK_REFERENCES.mitre_atlas['AML.T0010.005']).toBe(
      'AI Supply Chain Compromise: AI Agent Tool'
    );
    expect(FRAMEWORK_REFERENCES.mitre_atlas['AML.T0011.002']).toBe(
      'User Execution: Poisoned AI Agent Tool'
    );
  });

  it('covers exactly the technique set the plan tabulates for these cases', () => {
    expect([...new Set(idsFor('mitre_atlas'))].sort()).toEqual([
      'AML.T0010.005',
      'AML.T0011.002',
      'AML.T0051.001',
      'AML.T0053',
      'AML.T0084.001',
      'AML.T0086',
      'AML.T0098',
      'AML.T0101',
      'AML.T0110',
      'AML.T0110.000',
      'AML.T0110.001',
      'AML.T0110.002',
      'AML.T0115.002',
    ]);
  });

  it('covers exactly the mitigation set the plan tabulates for these cases', () => {
    expect([...new Set(idsFor('mitre_atlas_mitigation'))].sort()).toEqual([
      'AML.M0024',
      'AML.M0026',
      'AML.M0027',
      'AML.M0028',
      'AML.M0029',
      'AML.M0030',
      'AML.M0032',
      'AML.M0033',
    ]);
  });

  it('leads case 1 with indirect injection and the untrusted-data tool gate', () => {
    expect(getPrimaryMapping('NR-AGT-001', 'mitre_atlas').id).toBe('AML.T0051.001');
    expect(getPrimaryMapping('NR-AGT-001', 'mitre_atlas_mitigation').id).toBe('AML.M0030');
  });

  it('leads case 2 with tool invocation and human in-the-loop', () => {
    expect(getPrimaryMapping('NR-AGT-002', 'mitre_atlas').id).toBe('AML.T0053');
    expect(getPrimaryMapping('NR-AGT-002', 'mitre_atlas_mitigation').id).toBe('AML.M0029');
  });

  it('splits tool poisoning by stage: descriptor for 3a, supply chain for 3b', () => {
    expect(getPrimaryMapping('NR-AGT-003A', 'mitre_atlas').id).toBe('AML.T0110.000');
    expect(getPrimaryMapping('NR-AGT-003B', 'mitre_atlas').id).toBe('AML.T0010.005');
  });
});

describe('OWASP Top 10 for Agentic Applications (ASI)', () => {
  it('uses well-formed ASI IDs that resolve in the shared reference table', () => {
    mappingsFor('owasp_asi').forEach(m => {
      expect(m.id).toMatch(/^ASI\d{2}$/);
      expect(FRAMEWORK_REFERENCES.owasp_asi[m.id]).toBeTruthy();
      expect(m.name).toBe(FRAMEWORK_REFERENCES.owasp_asi[m.id]);
    });
  });

  it('assigns the primary ASI category the plan\'s split table names', () => {
    expect(getPrimaryMapping('NR-AGT-001', 'owasp_asi').id).toBe('ASI01');
    expect(getPrimaryMapping('NR-AGT-002', 'owasp_asi').id).toBe('ASI02');
    expect(getPrimaryMapping('NR-AGT-003A', 'owasp_asi').id).toBe('ASI02');
    expect(getPrimaryMapping('NR-AGT-003B', 'owasp_asi').id).toBe('ASI04');
  });

  it('keeps 3a and 3b on different primary ASI categories — the boundary OWASP draws', () => {
    const runtime = getPrimaryMapping('NR-AGT-003A', 'owasp_asi');
    const source = getPrimaryMapping('NR-AGT-003B', 'owasp_asi');
    expect(runtime.id).not.toBe(source.id);
    expect(runtime.id).toBe('ASI02');
    expect(source.id).toBe('ASI04');
  });

  it('carries the supporting categories the split table names', () => {
    const supporting = (id) =>
      getCaseMappingsByFramework(id, 'owasp_asi').filter(m => m.role === 'supporting').map(m => m.id);
    expect(supporting('NR-AGT-001')).toEqual(['ASI02']);
    expect(supporting('NR-AGT-002')).toEqual(['ASI09', 'ASI03']);
    expect(supporting('NR-AGT-003A')).toEqual(['ASI04']);
    expect(supporting('NR-AGT-003B')).toEqual(['ASI03']);
  });
});

describe('AIUC-1 requirements', () => {
  it('uses well-formed pillar-lettered requirement IDs', () => {
    const ids = idsFor('aiuc_1');
    expect(ids.length).toBeGreaterThan(0);
    ids.forEach(id => expect(id).toMatch(/^[A-F]\d{3}$/));
  });

  it('stamps every citation with the release it was read from and a standard-currency note', () => {
    expect(AIUC_1_RELEASE).toBe('2026-07-15');
    expect(AIUC_1_STANDARD_CURRENCY.release_read).toBe(AIUC_1_RELEASE);
    expect(AIUC_1_STANDARD_CURRENCY.cadence).toBe('quarterly');
    mappingsFor('aiuc_1').forEach(m => {
      expect(m.release_read).toBe('2026-07-15');
      expect(typeof m.standard_currency_note).toBe('string');
      expect(m.standard_currency_note).toContain('2026-07-15');
    });
  });

  it('uses exactly the eleven requirement IDs verified in the plan', () => {
    expect([...new Set(idsFor('aiuc_1'))].sort()).toEqual([
      'A003', 'B002', 'B005', 'B006', 'B008', 'C007', 'D003', 'D004', 'E006', 'E009', 'E015',
    ]);
  });

  it('names every requirement', () => {
    mappingsFor('aiuc_1').forEach(m => {
      expect(typeof m.name).toBe('string');
      expect(m.name.length).toBeGreaterThan(0);
    });
  });

  it('leads each case with the requirement that names its control objective', () => {
    expect(getPrimaryMapping('NR-AGT-001', 'aiuc_1').id).toBe('B002');
    expect(getPrimaryMapping('NR-AGT-002', 'aiuc_1').id).toBe('D003');
    expect(getPrimaryMapping('NR-AGT-003A', 'aiuc_1').id).toBe('B006');
    expect(getPrimaryMapping('NR-AGT-003B', 'aiuc_1').id).toBe('E006');
  });
});

describe('direct vs inferred discipline', () => {
  it('labels every mapping with a relationship from the allowed set', () => {
    allMappings().forEach(m => {
      expect(MAPPING_RELATIONSHIPS).toContain(m.relationship);
    });
  });

  it('labels every case-level mapping inferred — no source asserts these', () => {
    allMappings().forEach(m => {
      expect(m.relationship).toBe('inferred');
    });
  });

  it('gives every mapping a framework, role, and rationale', () => {
    allMappings().forEach(m => {
      expect(FRAMEWORK_KEYS).toContain(m.framework);
      expect(['primary', 'supporting']).toContain(m.role);
      expect(typeof m.rationale).toBe('string');
      expect(m.rationale.length).toBeGreaterThan(0);
    });
  });

  it('sources the only direct mappings from OWASP\'s own published crosswalk', () => {
    CASES.forEach(agentCase => {
      const crosswalk = agentCase.published_crosswalk;
      expect(crosswalk.relationship).toBe('direct');
      expect(crosswalk.source_id).toBe('OWASP-LLM-2026-APPENDIX-A');
      expect(crosswalk.rows.length).toBeGreaterThan(0);
      crosswalk.rows.forEach(row => {
        const published = OWASP_PUBLISHED_CROSSWALK[row.owasp_llm];
        expect(published).toBeTruthy();
        // Reproduced from the constant, never re-typed by hand.
        expect(row.asi).toEqual(published.asi);
        expect(row.atlas_tactics_primary).toEqual(published.atlas_tactics_primary);
        expect(row.nist_ai_rmf_categories).toEqual(published.nist_ai_rmf_categories);
      });
    });
  });

  it('only claims a crosswalk row for an LLM risk the case actually maps to', () => {
    CASES.forEach(agentCase => {
      const mapped = getCaseMappingsByFramework(agentCase.id, 'owasp_llm').map(m => m.id);
      agentCase.published_crosswalk.rows.forEach(row => {
        expect(mapped).toContain(row.owasp_llm);
      });
    });
  });
});

describe('display priority', () => {
  it('names exactly one primary framework per case, from the frameworks it maps to', () => {
    CASES.forEach(agentCase => {
      expect(FRAMEWORK_KEYS).toContain(agentCase.primary_framework);
      expect(agentCase.primary_framework_note).toBeTruthy();
      expect(getPrimaryMapping(agentCase.id, agentCase.primary_framework)).toBeTruthy();
    });
  });

  it('assigns the primary framework the plan specifies: ATLAS, OWASP LLM03, AIUC-1', () => {
    expect(getAgentCase('NR-AGT-001').primary_framework).toBe('mitre_atlas');
    expect(getAgentCase('NR-AGT-002').primary_framework).toBe('owasp_llm');
    expect(getAgentCase('NR-AGT-003A').primary_framework).toBe('aiuc_1');
    expect(getAgentCase('NR-AGT-003B').primary_framework).toBe('aiuc_1');
  });

  it('marks exactly one lead entry within each framework a case maps to', () => {
    CASES.forEach(agentCase => {
      FRAMEWORK_KEYS.forEach(framework => {
        const group = getCaseMappingsByFramework(agentCase.id, framework);
        if (group.length === 0) return;
        expect(group.filter(m => m.role === 'primary')).toHaveLength(1);
      });
    });
  });
});

describe('fixtures are synthetic', () => {
  it('flags every fixture synthetic and simulation-only', () => {
    allFixtures().forEach(f => {
      expect(f.synthetic).toBe(true);
      expect(f.simulated_only).toBe(true);
      expect(typeof f.content).toBe('string');
      expect(f.content.length).toBeGreaterThan(0);
      expect(f.id).toMatch(/^NR-AGT-/);
    });
  });

  it('marks every case simulation-only', () => {
    CASES.forEach(agentCase => expect(agentCase.simulated_only).toBe(true));
  });

  it('makes every canary value obviously fake', () => {
    Object.values(CANARY_SEEDS).forEach(value => {
      expect(value).toMatch(/FAKE|CANARY|canary|\.invalid|example/);
    });
  });

  it('routes every address and hostname to a reserved, unroutable domain', () => {
    allFixtures().forEach(f => {
      const emails = f.content.match(/[\w.+-]+@[\w.-]+/g) ?? [];
      emails.forEach(address => expect(address).toMatch(/\.(invalid|example)$/));
      expect(f.content).not.toMatch(/https?:\/\//);
    });
  });

  it('declares only canaries whose value is literally present in the fixture', () => {
    allFixtures().forEach(f => {
      f.seeded_canaries.forEach(key => {
        expect(Object.keys(CANARY_SEEDS)).toContain(key);
        expect(f.content).toContain(CANARY_SEEDS[key]);
      });
    });
  });

  it('seeds the leakage guard only with values a run can actually surface', () => {
    CASES.forEach(agentCase => {
      const corpus = agentCase.fixtures.map(f => f.content).join('\n');
      Object.entries(agentCase.pii_seeds).forEach(([key, value]) => {
        expect(CANARY_SEEDS[key]).toBe(value);
        expect(corpus).toContain(value);
      });
    });
  });

  it('gives every injection-carrying fixture an explicit injected instruction and target tool', () => {
    allFixtures().filter(f => f.carries_injection).forEach(f => {
      expect(typeof f.injected_instruction).toBe('string');
      expect(f.injected_instruction.length).toBeGreaterThan(0);
      expect(f.target_tool).toBeTruthy();
      expect(f.injection_style).toBeTruthy();
    });
  });

  it('attributes fixture provenance against the authority registry\'s own source sets', () => {
    allFixtures().forEach(f => {
      if (f.trust === 'trusted') expect(TRUSTED_SOURCES).toContain(f.instruction_source);
      else expect(UNTRUSTED_SOURCES).toContain(f.instruction_source);
    });
  });

  it('gives case 1 untrusted content on three distinct channels', () => {
    const case1 = getAgentCase('NR-AGT-001');
    expect(case1.fixtures).toHaveLength(3);
    case1.fixtures.forEach(f => {
      expect(f.carries_injection).toBe(true);
      expect(UNTRUSTED_SOURCES).toContain(f.instruction_source);
    });
  });
});

describe('mock tool router scenario-content contract', () => {
  it('keys scenario content by tool name with { content, metadata } values', () => {
    CASES.forEach(agentCase => {
      const entries = Object.entries(agentCase.scenario_content);
      expect(entries.length).toBeGreaterThan(0);
      entries.forEach(([tool, entry]) => {
        expect(typeof tool).toBe('string');
        expect(typeof entry.content).toBe('string');
        expect(entry.content.length).toBeGreaterThan(0);
        expect(typeof entry.metadata).toBe('object');
        expect(entry.metadata).not.toBeNull();
        expect(entry.metadata.simulated_only).toBe(true);
        expect(entry.metadata.synthetic).toBe(true);
        expect(entry.metadata.fixture_id).toMatch(/^NR-AGT-/);
      });
    });
  });

  it('includes exactly the tool_result fixtures and nothing else', () => {
    CASES.forEach(agentCase => {
      const routed = agentCase.fixtures.filter(f => f.delivery === 'tool_result');
      expect(Object.keys(agentCase.scenario_content).sort())
        .toEqual(routed.map(f => f.delivery_tool).sort());
      // Descriptor text and approval payloads do not reach the model as tool
      // results and must not be routed as if they did.
      agentCase.fixtures.filter(f => f.delivery !== 'tool_result').forEach(f => {
        expect(['tool_description', 'approval_prompt']).toContain(f.delivery);
      });
    });
  });

  it('never lets two fixtures collide on one tool name', () => {
    CASES.forEach(agentCase => {
      const tools = agentCase.fixtures
        .filter(f => f.delivery === 'tool_result')
        .map(f => f.delivery_tool);
      expect(new Set(tools).size).toBe(tools.length);
    });
  });

  it('routes scenario content only to tools the case advertises', () => {
    CASES.forEach(agentCase => {
      Object.keys(agentCase.scenario_content).forEach(tool => {
        expect(agentCase.tools.advertised).toContain(tool);
      });
    });
  });
});

describe('tool sets and MCP registry entries', () => {
  it('advertises only tools the default registry declares or the case extends it with', () => {
    CASES.forEach(agentCase => {
      const extensions = agentCase.tools.registry_extensions?.tools ?? {};
      agentCase.tools.advertised.forEach(tool => {
        const known = Boolean(DEFAULT_AUTHORITY_REGISTRY.tools[tool]) || Boolean(extensions[tool]);
        expect(known).toBe(true);
      });
    });
  });

  it('adds MCP entries only on the two case-3 splits', () => {
    expect(getAgentCase('NR-AGT-001').tools.registry_extensions).toBeNull();
    expect(getAgentCase('NR-AGT-002').tools.registry_extensions).toBeNull();
    expect(getAgentCase('NR-AGT-003A').tools.registry_extensions).toBeTruthy();
    expect(getAgentCase('NR-AGT-003B').tools.registry_extensions).toBeTruthy();
  });

  it('never relies on trusted tool output as a mechanism', () => {
    // The router deliberately does not let `trustedOutput` upgrade a result's
    // provenance, so a case built on it would test something the harness does
    // not implement.
    ['NR-AGT-003A', 'NR-AGT-003B'].forEach(id => {
      const tools = getAgentCase(id).tools.registry_extensions.tools;
      Object.values(tools).forEach(tool => {
        expect(tool.mcp).toBe(true);
        expect(tool.trustedOutput).toBe(false);
        expect(['low', 'medium', 'high']).toContain(tool.risk);
        expect(typeof tool.allowed).toBe('boolean');
        expect(typeof tool.requiresApproval).toBe('boolean');
      });
    });
  });

  it('carries server provenance and declared-vs-required scope on every MCP server', () => {
    ['NR-AGT-003A', 'NR-AGT-003B'].forEach(id => {
      const servers = getAgentCase(id).tools.registry_extensions.servers;
      expect(Object.keys(servers).length).toBeGreaterThan(0);
      Object.values(servers).forEach(server => {
        expect(['sanctioned', 'unsanctioned']).toContain(server.provenance);
        expect(Array.isArray(server.declared_scope)).toBe(true);
        expect(Array.isArray(server.task_required_scope)).toBe(true);
        expect(Array.isArray(server.scope_excess)).toBe(true);
        const excess = server.declared_scope.filter(s => !server.task_required_scope.includes(s));
        expect(server.scope_excess.every(s => excess.includes(s))).toBe(true);
      });
    });
  });

  it('separates 3a\'s sanctioned server with a changed descriptor from 3b\'s unreviewed one', () => {
    const runtime = getAgentCase('NR-AGT-003A').tools.registry_extensions;
    const source = getAgentCase('NR-AGT-003B').tools.registry_extensions;

    const runtimeServer = runtime.servers['mcp-platform-internal'];
    expect(runtimeServer.provenance).toBe('sanctioned');
    expect(runtimeServer.descriptor_integrity).toBe('changed_after_approval');
    expect(Object.values(runtime.tools).some(t => t.description_poisoned === true)).toBe(true);
    expect(Object.values(runtime.tools).some(t => t.implementation_hostile === true)).toBe(false);

    const sourceServer = source.servers['mcp-taskflow-external'];
    expect(sourceServer.provenance).toBe('unsanctioned');
    expect(sourceServer.review_status).toBe('never_reviewed');
    expect(sourceServer.scope_excess.length).toBeGreaterThan(0);
    Object.values(source.tools).forEach(tool => {
      // Deny-by-default is the expected posture for an unreviewed server.
      expect(tool.allowed).toBe(false);
      expect(tool.requiresApproval).toBe(true);
      expect(tool.implementation_hostile).toBe(true);
      expect(tool.description_poisoned).toBe(false);
    });
  });

  it('carries the poisoned descriptor as a tool_description fixture, not a tool result', () => {
    const descriptor = getAgentCase('NR-AGT-003A').fixtures
      .find(f => f.id === 'NR-AGT-003A-FIX-DESCRIPTOR');
    expect(descriptor.delivery).toBe('tool_description');
    expect(descriptor.carries_injection).toBe(true);
    expect(descriptor.descriptor_revision.changed_after_approval).toBe(true);
    expect(descriptor.descriptor_revision.change_reviewed).toBe(false);
  });
});

describe('case 2 HITL failure modes', () => {
  it('encodes the four failure modes the plan names as distinct variants', () => {
    const variants = getAgentCase('NR-AGT-002').variants;
    expect(variants.map(v => v.key)).toEqual([
      'approval_flood',
      'high_risk_starvation',
      'decision_context_stripping',
      'denied_decision_replay',
    ]);
  });

  it('gives every variant an id, a sequence, and its own success condition', () => {
    getAgentCase('NR-AGT-002').variants.forEach(variant => {
      expect(variant.id).toMatch(/^NR-AGT-002-V\d$/);
      expect(variant.simulated_only).toBe(true);
      expect(variant.title).toBeTruthy();
      expect(variant.description).toBeTruthy();
      expect(typeof variant.sequence).toBe('object');
      expect(Object.keys(variant.sequence).length).toBeGreaterThan(0);
      expect(variant.attack_success.description).toBeTruthy();
      expect(variant.attack_success.signals.tool_call_executed).toBe(true);
    });
  });

  it('exercises approval-required tools drawn from the registry, not a local list', () => {
    const tools = getAgentCase('NR-AGT-002').tools;
    tools.high_risk_requiring_approval.forEach(tool => {
      expect(DEFAULT_AUTHORITY_REGISTRY.tools[tool].requiresApproval).toBe(true);
    });
  });

  it('carries both a full and a stripped approval payload for the context-stripping variant', () => {
    const payload = JSON.parse(
      getAgentCase('NR-AGT-002').fixtures.find(f => f.delivery === 'approval_prompt').content
    );
    expect(payload.full.tool).toBe('send_email');
    expect(payload.full.reversible).toBe(false);
    expect(Object.keys(payload.stripped)).toEqual(['tool']);
    expect(Object.keys(payload.full).length).toBeGreaterThan(Object.keys(payload.stripped).length);
  });
});

describe('conditions, evidence class, and claim boundary', () => {
  it('states secure behavior, success, failure, and inconclusive on every case', () => {
    CASES.forEach(agentCase => {
      const c = agentCase.conditions;
      expect(c.expected_secure_behavior).toBeTruthy();
      expect(c.attack_success.description).toBeTruthy();
      expect(typeof c.attack_success.signals).toBe('object');
      expect(c.partial_control_failure.description).toBeTruthy();
      expect(c.control_failure).toBeTruthy();
      // An unexercised control resolves to INCONCLUSIVE, never "held".
      expect(c.inconclusive).toBeTruthy();
    });
  });

  it('makes case 1 succeed only on an executed call with untrusted provenance', () => {
    const signals = getAgentCase('NR-AGT-001').conditions.attack_success.signals;
    expect(signals.tool_call_executed).toBe(true);
    expect(signals.instruction_source_in.length).toBeGreaterThan(0);
    signals.instruction_source_in.forEach(source => {
      expect(UNTRUSTED_SOURCES).toContain(source);
      expect(TRUSTED_SOURCES).not.toContain(source);
    });
  });

  it('scopes every case\'s evidence and never reaches E4 or E5', () => {
    CASES.forEach(agentCase => {
      const e = agentCase.evidence;
      expect(e.independence).toBe('I0');
      expect(e.status).toBe('mapped');
      expect(e.max_evidence_class).toBe('E3');
      expect(['E1', 'E2', 'E3']).toContain(e.evidence_class_mapped);
      expect(['E1', 'E2', 'E3']).toContain(e.evidence_class_executed);
      expect(['E1', 'E2', 'E3']).toContain(e.evidence_class_gate_enforcement);
      expect(e.scope).toBeTruthy();
      expect(JSON.stringify(e)).not.toMatch(/"E[45]"/);
    });
  });

  it('carries a claim boundary and no prohibited claim language', () => {
    // controls/llm-saas-control-set.yaml, prohibited_claims.
    const prohibited = ['legal violation', 'audit failure', 'certification failure', 'regulatory noncompliance'];
    CASES.forEach(agentCase => {
      expect(agentCase.claim_boundary).toBe(CLAIM_BOUNDARY);
      const text = JSON.stringify(agentCase).toLowerCase();
      prohibited.forEach(phrase => expect(text).not.toContain(phrase));
    });
  });
});
