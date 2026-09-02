import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APITargetAdapter,
  DEGRADATION,
  PROVIDERS,
  buildLocalToolPrompt,
  collectStream,
  detectProvider,
  formatAssistantToolCallMessage,
  formatToolResultMessage,
  formatToolsForProvider,
  normalizeResponse,
  normalizeToolCalls,
  parseLocalToolCalls,
} from './adapter';
import {
  DEFAULT_AUTHORITY_REGISTRY,
  isUntrustedInstructionSource,
  requiresExplicitApproval,
} from '../harness/authorityRegistry';
import { runAgentAssessment } from '../harness/runAgentAssessment';
import { saveAgentRun } from '../storage';
import { prepareEvidenceContractExport } from '../reports/evidenceContractExport';

const FAKE_KEY = 'test-key-not-a-real-credential-0000';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/** Build a Response-like object whose body streams the given SSE text. */
function sseResponse(text, { ok = true, chunks } = {}) {
  const parts = chunks || [text];
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok,
    status: 200,
    statusText: 'OK',
    body: {
      getReader: () => ({
        read: async () =>
          i < parts.length ? { done: false, value: encoder.encode(parts[i++]) } : { done: true, value: undefined },
      }),
    },
  };
}

function jsonResponse(payload, { ok = true, status = 200, statusText = 'OK' } = {}) {
  return { ok, status, statusText, json: async () => payload };
}

function mockFetch(response) {
  const fn = vi.fn(async () => response);
  globalThis.fetch = fn;
  return fn;
}

function lastBody(fetchMock) {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

let originalFetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */

describe('detectProvider', () => {
  it('detects Anthropic and OpenAI from the endpoint host', () => {
    expect(detectProvider(ANTHROPIC_URL)).toBe(PROVIDERS.ANTHROPIC);
    expect(detectProvider(OPENAI_URL)).toBe(PROVIDERS.OPENAI);
  });

  it('falls back to generic for anything else, including empty and malformed input', () => {
    expect(detectProvider('https://llm.internal.example/v1/chat/completions')).toBe(PROVIDERS.GENERIC);
    expect(detectProvider('')).toBe(PROVIDERS.GENERIC);
    expect(detectProvider(undefined)).toBe(PROVIDERS.GENERIC);
    expect(detectProvider('not a url')).toBe(PROVIDERS.GENERIC);
  });

  it('does not detect a provider from a host that merely mentions one', () => {
    // Substring matching on the raw URL would send an Authorization: Bearer
    // header carrying the key to an unrelated host.
    expect(detectProvider('https://evil.example/?upstream=api.openai.com')).toBe(PROVIDERS.GENERIC);
    expect(detectProvider('https://api.anthropic.com.evil.example/v1/messages')).toBe(PROVIDERS.GENERIC);
  });
});

/* ------------------------------------------------------------------ */

describe('API key confinement', () => {
  const adapter = () => new APITargetAdapter({ endpoint: ANTHROPIC_URL, apiKey: FAKE_KEY, modelId: 'claude-haiku-4-5' });

  it('does not expose the key on the instance', () => {
    const a = adapter();
    expect(Object.keys(a)).not.toContain('apiKey');
    expect(Object.values(a)).not.toContain(FAKE_KEY);
    expect(a.apiKey).toBeUndefined();
  });

  it('does not expose the key through serialization', () => {
    const a = adapter();
    expect(JSON.stringify(a)).not.toContain(FAKE_KEY);
    expect(JSON.stringify({ ...a })).not.toContain(FAKE_KEY);
    expect(JSON.stringify(a.toJSON())).not.toContain(FAKE_KEY);
    expect(JSON.stringify(Object.getOwnPropertyDescriptors(a))).not.toContain(FAKE_KEY);
  });

  it('reports only whether a key is present', () => {
    expect(adapter().hasApiKey).toBe(true);
    expect(new APITargetAdapter({ endpoint: ANTHROPIC_URL, modelId: 'm' }).hasApiKey).toBe(false);
    expect(adapter().toJSON()).toEqual({
      endpoint: ANTHROPIC_URL,
      modelId: 'claude-haiku-4-5',
      provider: PROVIDERS.ANTHROPIC,
      hasApiKey: true,
    });
  });

  it('scrubs the key from a provider error message that echoes it back', async () => {
    mockFetch(jsonResponse({ error: { message: `invalid x-api-key: ${FAKE_KEY}` } }, { ok: false, status: 401 }));
    const a = adapter();
    await expect(a.chat.completions.create({ messages: [], stream: false })).rejects.toThrow(/\[REDACTED\]/);
    await expect(a.chat.completions.create({ messages: [], stream: false })).rejects.not.toThrow(
      new RegExp(FAKE_KEY)
    );
  });

  it('scrubs the key from a network failure message', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error(`connect failed while sending ${FAKE_KEY}`);
    });
    const a = adapter();
    await expect(a.chat.completions.create({ messages: [] })).rejects.toThrow(/\[REDACTED\]/);
  });

  it('scrubs the key from every provider-native response field before it can enter a transcript', async () => {
    mockFetch(jsonResponse({
      id: 'msg-secret-test',
      content: [
        { type: 'text', text: `echo ${FAKE_KEY}` },
        { type: 'tool_use', id: 't1', name: 'send_email', input: { body: FAKE_KEY } },
        { type: 'future_block', metadata: { echoed_header: FAKE_KEY } },
      ],
    }));
    const returned = await adapter().chat.completions.create({ messages: [], stream: false });
    expect(JSON.stringify(returned)).not.toContain(FAKE_KEY);
    expect(JSON.stringify(returned)).toContain('[REDACTED]');
  });

  it('keeps the key out of the run, contract, persisted record, and export', async () => {
    mockFetch(jsonResponse({
      id: 'msg-secret-pipeline', model: 'claude-test',
      content: [{ type: 'text', text: `provider echoed ${FAKE_KEY}` }],
    }));
    const outcome = await runAgentAssessment({
      agentCase: 'NR-AGT-001',
      profile: 'reference',
      target: adapter(),
      provider: PROVIDERS.ANTHROPIC,
      targetType: 'live',
      providerModel: 'claude-haiku-4-5',
      targetLabel: 'anthropic:claude-haiku-4-5',
    });
    const stored = new Map();
    const storage = {
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    };
    const history = await saveAgentRun({
      id: 'run-1', configuration: outcome.configuration,
      configurationDigest: outcome.configurationDigest, contract: outcome.contract,
    }, storage);
    const exported = prepareEvidenceContractExport({ contract: outcome.contract, state: 'current' });

    expect(JSON.stringify(outcome.run)).not.toContain(FAKE_KEY);
    expect(JSON.stringify(outcome.contract)).not.toContain(FAKE_KEY);
    expect(JSON.stringify(history)).not.toContain(FAKE_KEY);
    expect(JSON.stringify(exported)).not.toContain(FAKE_KEY);
  });

  it('never writes the key to browser storage', async () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem, getItem: () => null, removeItem: vi.fn() });
    vi.stubGlobal('sessionStorage', { setItem, getItem: () => null, removeItem: vi.fn() });
    mockFetch(jsonResponse({ content: [{ type: 'text', text: 'hi' }] }));
    await adapter().chat.completions.create({ messages: [{ role: 'user', content: 'hi' }], stream: false });
    expect(setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('does send the key in the request headers, which is the only place it belongs', async () => {
    const fetchMock = mockFetch(jsonResponse({ content: [] }));
    await adapter().chat.completions.create({ messages: [], stream: false });
    expect(fetchMock.mock.calls[0][1].headers['x-api-key']).toBe(FAKE_KEY);
  });
});

/* ------------------------------------------------------------------ */

describe('formatToolsForProvider', () => {
  const tools = [
    { name: 'send_email', description: 'Sends outbound email.', parameters: { type: 'object', properties: { to: { type: 'string' } } } },
  ];

  it('renders the Anthropic tools field', () => {
    expect(formatToolsForProvider(tools, PROVIDERS.ANTHROPIC)).toEqual([
      { name: 'send_email', description: 'Sends outbound email.', input_schema: tools[0].parameters },
    ]);
  });

  it('renders the OpenAI tools field, and uses it for generic endpoints too', () => {
    const expected = [
      { type: 'function', function: { name: 'send_email', description: 'Sends outbound email.', parameters: tools[0].parameters } },
    ];
    expect(formatToolsForProvider(tools, PROVIDERS.OPENAI)).toEqual(expected);
    expect(formatToolsForProvider(tools, PROVIDERS.GENERIC)).toEqual(expected);
  });

  it('accepts the authority registry tool map directly', () => {
    const rendered = formatToolsForProvider(DEFAULT_AUTHORITY_REGISTRY.tools, PROVIDERS.ANTHROPIC);
    expect(rendered.map((t) => t.name)).toEqual(Object.keys(DEFAULT_AUTHORITY_REGISTRY.tools));
    expect(rendered.every((t) => t.input_schema.type === 'object')).toBe(true);
  });

  it('returns undefined when there are no tools, so the field is omitted', () => {
    expect(formatToolsForProvider([], PROVIDERS.ANTHROPIC)).toBeUndefined();
    expect(formatToolsForProvider(undefined, PROVIDERS.OPENAI)).toBeUndefined();
    expect(formatToolsForProvider(null, PROVIDERS.GENERIC)).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */

describe('normalizeResponse — Anthropic', () => {
  const payload = {
    stop_reason: 'tool_use',
    content: [
      { type: 'text', text: 'Sending that now.' },
      { type: 'tool_use', id: 'toolu_01', name: 'send_email', input: { to: 'ops@example.test', body: 'hi' } },
    ],
  };

  it('normalizes text and tool_use blocks into one shape', () => {
    const result = normalizeResponse(payload, { provider: PROVIDERS.ANTHROPIC, instructionSource: 'retrieved_content' });
    expect(result.text).toBe('Sending that now.');
    expect(result.stopReason).toBe('tool_use');
    expect(result.toolCalls).toEqual([
      {
        id: 'toolu_01',
        tool: 'send_email',
        args: { to: 'ops@example.test', body: 'hi' },
        instructionSource: 'retrieved_content',
      },
    ]);
    expect(result.degraded).toBe(false);
  });

  it('produces exactly the four normalized keys', () => {
    const result = normalizeResponse(payload, { provider: PROVIDERS.ANTHROPIC });
    expect(Object.keys(result.toolCalls[0]).sort()).toEqual(['args', 'id', 'instructionSource', 'tool']);
  });

  it('records a missing tool name rather than emitting a nameless call', () => {
    const result = normalizeResponse(
      { content: [{ type: 'tool_use', id: 'toolu_02', input: {} }] },
      { provider: PROVIDERS.ANTHROPIC }
    );
    expect(result.toolCalls).toEqual([]);
    expect(result.degraded).toBe(true);
    expect(result.degradation[0].reason).toBe(DEGRADATION.TOOL_CALL_INCOMPLETE);
  });

  it('retains mixed text, multiple tool calls, and an unknown block losslessly for continuation', () => {
    const content = [
      { type: 'text', text: 'First.', citations: [{ source: 'provider-doc' }] },
      { type: 'tool_use', id: 'toolu_1', name: 'read_file', input: { path: '/a' }, caller: { type: 'direct' } },
      { type: 'future_block', opaque: { value: 7 }, signature: 'provider-metadata' },
      { type: 'text', text: 'Second.' },
      { type: 'tool_use', id: 'toolu_2', name: 'send_email', input: { to: 'a@example.test' } },
    ];
    const result = normalizeResponse(
      { id: 'msg_123', model: 'claude-test', stop_reason: 'tool_use', usage: { input_tokens: 10 }, content },
      { provider: PROVIDERS.ANTHROPIC, instructionSource: 'tool_output' }
    );
    expect(result.text).toBe('First.Second.');
    expect(result.toolCalls).toHaveLength(2);
    expect(result.providerAssistantMessage).toEqual({ role: 'assistant', content });
    expect(result.providerMetadata).toMatchObject({
      provider: 'anthropic', response_id: 'msg_123', model_id: 'claude-test', usage: { input_tokens: 10 },
    });
    expect(result.degraded).toBe(false);
  });
});

describe('normalizeResponse — OpenAI', () => {
  const payload = {
    choices: [
      {
        finish_reason: 'tool_calls',
        message: {
          content: 'On it.',
          tool_calls: [
            { id: 'call_1', type: 'function', function: { name: 'write_file', arguments: '{"path":"/tmp/a"}' } },
          ],
        },
      },
    ],
  };

  it('normalizes tool_calls, parsing the JSON argument string', () => {
    const result = normalizeResponse(payload, { provider: PROVIDERS.OPENAI, instructionSource: 'user' });
    expect(result.text).toBe('On it.');
    expect(result.stopReason).toBe('tool_calls');
    expect(result.toolCalls).toEqual([
      { id: 'call_1', tool: 'write_file', args: { path: '/tmp/a' }, instructionSource: 'user' },
    ]);
    expect(result.degraded).toBe(false);
  });

  it('records unparseable arguments and falls back to an empty args object', () => {
    const result = normalizeResponse(
      { choices: [{ message: { content: null, tool_calls: [{ id: 'c', function: { name: 'write_file', arguments: '{"path":' } }] } }] },
      { provider: PROVIDERS.OPENAI }
    );
    expect(result.toolCalls[0].args).toEqual({});
    expect(result.degraded).toBe(true);
    expect(result.degradation[0].reason).toBe(DEGRADATION.TOOL_ARGS_UNPARSEABLE);
    expect(result.degradation[0].detail.tool).toBe('write_file');
  });

  it('treats a tool-call-only response with null content as valid, not malformed', () => {
    const result = normalizeResponse(
      { choices: [{ message: { content: null, tool_calls: [{ id: 'c', function: { name: 'web_search', arguments: '{}' } }] } }] },
      { provider: PROVIDERS.OPENAI }
    );
    expect(result.text).toBe('');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.degraded).toBe(false);
  });

  it('treats the generic provider as OpenAI-shaped', () => {
    expect(normalizeResponse(payload, { provider: PROVIDERS.GENERIC }).toolCalls).toHaveLength(1);
  });

  it('keeps the OpenAI assistant message and metadata isolated from Anthropic formatting', () => {
    const message = {
      role: 'assistant', content: 'On it.', refusal: null,
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'write_file', arguments: '{}' } }],
    };
    const result = normalizeResponse({
      id: 'chatcmpl_1', model: 'gpt-test', system_fingerprint: 'fp_1', usage: { total_tokens: 9 },
      choices: [{ finish_reason: 'tool_calls', message }],
    }, { provider: PROVIDERS.OPENAI });
    expect(result.providerAssistantMessage).toEqual(message);
    expect(result.providerMetadata).toMatchObject({ provider: 'openai', response_id: 'chatcmpl_1', system_fingerprint: 'fp_1' });
  });
});

describe('normalizeResponse — malformed bodies never throw', () => {
  const cases = [
    ['null', null],
    ['a string', 'not json'],
    ['an empty object', {}],
    ['an array', []],
    ['an Anthropic body with no content array', { stop_reason: 'end_turn' }],
    ['an OpenAI body with an empty choices array', { choices: [] }],
  ];

  for (const [label, payload] of cases) {
    it(`records a parse failure for ${label} (anthropic)`, () => {
      const result = normalizeResponse(payload, { provider: PROVIDERS.ANTHROPIC });
      expect(result.degraded).toBe(true);
      expect(result.degradation.some((d) => d.reason === DEGRADATION.MALFORMED_RESPONSE)).toBe(true);
      expect(result.text).toBe('');
      expect(result.toolCalls).toEqual([]);
    });

    it(`records a parse failure for ${label} (openai)`, () => {
      const result = normalizeResponse(payload, { provider: PROVIDERS.OPENAI });
      expect(result.degraded).toBe(true);
      expect(result.toolCalls).toEqual([]);
    });
  }
});

describe('normalizeToolCalls', () => {
  it('returns only the tool-call half of the normalized result', () => {
    const result = normalizeToolCalls(
      { content: [{ type: 'tool_use', id: 'x', name: 'read_file', input: { path: 'a' } }] },
      { provider: PROVIDERS.ANTHROPIC }
    );
    expect(result).toEqual({ toolCalls: [{ id: 'x', tool: 'read_file', args: { path: 'a' }, instructionSource: null }], degraded: false, degradation: [] });
  });
});

/* ------------------------------------------------------------------ */

describe('instructionSource provenance', () => {
  const anthropic = { content: [{ type: 'tool_use', id: 'a', name: 'send_email', input: {} }] };
  const openai = { choices: [{ message: { tool_calls: [{ id: 'b', function: { name: 'send_email', arguments: '{}' } }] } }] };

  it('defaults to null, never to user', () => {
    expect(normalizeResponse(anthropic, { provider: PROVIDERS.ANTHROPIC }).toolCalls[0].instructionSource).toBeNull();
    expect(normalizeResponse(openai, { provider: PROVIDERS.OPENAI }).toolCalls[0].instructionSource).toBeNull();
    expect(parseLocalToolCalls('{"tool_calls":[{"tool":"send_email","args":{}}]}').toolCalls[0].instructionSource).toBeNull();
  });

  it('carries the caller-supplied value through unchanged', () => {
    for (const source of ['user', 'retrieved_content', 'tool_output', 'web_search']) {
      expect(
        normalizeResponse(anthropic, { provider: PROVIDERS.ANTHROPIC, instructionSource: source }).toolCalls[0].instructionSource
      ).toBe(source);
    }
  });

  it('leaves an unattributed call untrusted at the authorization gate', () => {
    // This is the reason the default is null. If the adapter defaulted to
    // 'user', an injected call would arrive pre-laundered as trusted and the
    // indirect-injection case would report a control that was never exercised.
    const call = normalizeResponse(anthropic, { provider: PROVIDERS.ANTHROPIC }).toolCalls[0];
    expect(isUntrustedInstructionSource(DEFAULT_AUTHORITY_REGISTRY, call.instructionSource)).toBe(true);
    expect(requiresExplicitApproval(DEFAULT_AUTHORITY_REGISTRY, call)).toBe(true);
  });

  it('produces a call the registry accepts as low risk only when it genuinely is', () => {
    const userCall = normalizeResponse(
      { content: [{ type: 'tool_use', id: 'c', name: 'retrieve_document', input: {} }] },
      { provider: PROVIDERS.ANTHROPIC, instructionSource: 'user' }
    ).toolCalls[0];
    expect(requiresExplicitApproval(DEFAULT_AUTHORITY_REGISTRY, userCall)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe('local WebLLM JSON fallback', () => {
  it('builds a prompt naming every tool and its schema', () => {
    const prompt = buildLocalToolPrompt(DEFAULT_AUTHORITY_REGISTRY.tools);
    expect(prompt).toContain('"tool_calls"');
    for (const name of Object.keys(DEFAULT_AUTHORITY_REGISTRY.tools)) {
      expect(prompt).toContain(name);
    }
  });

  it('parses a fenced JSON block', () => {
    const text = 'Sure, here you go.\n```json\n{"tool_calls":[{"tool":"send_email","args":{"to":"a@example.test"}}]}\n```';
    const result = parseLocalToolCalls(text, { instructionSource: 'retrieved_content' });
    expect(result.toolCalls).toEqual([
      { id: 'local_0', tool: 'send_email', args: { to: 'a@example.test' }, instructionSource: 'retrieved_content' },
    ]);
  });

  it('parses a bare JSON object with nested argument objects', () => {
    const text = 'ok {"tool_calls":[{"tool":"write_file","args":{"file":{"path":"/a","mode":"w"}}}]} done';
    const result = parseLocalToolCalls(text);
    expect(result.toolCalls[0].args).toEqual({ file: { path: '/a', mode: 'w' } });
  });

  it('is not confused by braces inside string literals', () => {
    const text = '{"tool_calls":[{"tool":"send_email","args":{"body":"use {this} literally"}}]}';
    expect(parseLocalToolCalls(text).toolCalls[0].args.body).toBe('use {this} literally');
  });

  it('marks the result degraded even on a completely clean parse', () => {
    // The degradation is not "parsing went badly" — it is "these calls did not
    // come from a provider tool-calling API," which limits what the evidence
    // supports and must travel with the result.
    const result = parseLocalToolCalls('{"tool_calls":[{"tool":"web_search","args":{"q":"x"}}]}');
    expect(result.degraded).toBe(true);
    expect(result.degradation[0].reason).toBe(DEGRADATION.LOCAL_JSON_FALLBACK);
  });

  it('records a partial failure when one entry is missing its tool name', () => {
    const text = '{"tool_calls":[{"tool":"web_search","args":{}},{"args":{"to":"x"}}]}';
    const result = parseLocalToolCalls(text);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.degradation.map((d) => d.reason)).toEqual([
      DEGRADATION.LOCAL_JSON_FALLBACK,
      DEGRADATION.TOOL_CALL_INCOMPLETE,
    ]);
  });

  it('records unparseable and absent JSON without throwing', () => {
    expect(parseLocalToolCalls('I will not be calling any tools today.').degradation.map((d) => d.reason)).toContain(
      DEGRADATION.LOCAL_JSON_UNPARSEABLE
    );
    expect(parseLocalToolCalls('```json\n{"tool_calls": [ broken\n```').degradation.map((d) => d.reason)).toContain(
      DEGRADATION.LOCAL_JSON_UNPARSEABLE
    );
    expect(parseLocalToolCalls('{"something_else": 1}').degradation.map((d) => d.reason)).toContain(
      DEGRADATION.LOCAL_JSON_UNPARSEABLE
    );
    expect(parseLocalToolCalls(undefined).toolCalls).toEqual([]);
    expect(parseLocalToolCalls(null).degraded).toBe(true);
  });

  it('emits an empty, still-degraded result for an explicit no-tool answer', () => {
    const result = parseLocalToolCalls('{"tool_calls": []}');
    expect(result.toolCalls).toEqual([]);
    expect(result.degraded).toBe(true);
    expect(result.degradation).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */

describe('tool-result feedback', () => {
  const call = { id: 'toolu_9', tool: 'send_email', args: { to: 'a@example.test' }, instructionSource: 'retrieved_content' };

  it('formats an Anthropic tool_result block', () => {
    expect(formatToolResultMessage({ provider: PROVIDERS.ANTHROPIC, toolCall: call, result: { ok: true } })).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_9', content: '{"ok":true}' }],
    });
  });

  it('formats an OpenAI tool message', () => {
    expect(formatToolResultMessage({ provider: PROVIDERS.OPENAI, toolCall: call, result: 'sent' })).toEqual({
      role: 'tool',
      tool_call_id: 'toolu_9',
      name: 'send_email',
      content: 'sent',
    });
  });

  it('formats a synthetic denial as an error result carrying the reason', () => {
    const anthropic = formatToolResultMessage({
      provider: PROVIDERS.ANTHROPIC,
      toolCall: call,
      denied: true,
      denialReason: 'instruction originated in retrieved content',
    });
    expect(anthropic.content[0].is_error).toBe(true);
    expect(anthropic.content[0].content).toContain('instruction originated in retrieved content');
    expect(anthropic.content[0].content).toContain('simulated_only');
  });

  it('marks a denial on the OpenAI path too, even without the is_error field', () => {
    const openai = formatToolResultMessage({ provider: PROVIDERS.OPENAI, toolCall: call, denied: true });
    expect(openai.content).toContain('denied by the authorization gate');
    expect(openai.content).toContain('simulated_only');
  });

  it('survives a missing tool call without throwing', () => {
    expect(formatToolResultMessage({ provider: PROVIDERS.ANTHROPIC }).content[0].tool_use_id).toBeNull();
    expect(formatToolResultMessage({}).tool_call_id).toBeNull();
  });

  it('formats the assistant turn that proposed the calls, per provider', () => {
    expect(formatAssistantToolCallMessage({ provider: PROVIDERS.ANTHROPIC, text: 'ok', toolCalls: [call] })).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'ok' },
        { type: 'tool_use', id: 'toolu_9', name: 'send_email', input: { to: 'a@example.test' } },
      ],
    });
    expect(formatAssistantToolCallMessage({ provider: PROVIDERS.OPENAI, text: '', toolCalls: [call] })).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'toolu_9', type: 'function', function: { name: 'send_email', arguments: '{"to":"a@example.test"}' } }],
    });
  });

  it('round-trips: a normalized call formats back into a message the same provider accepts', () => {
    const normalized = normalizeResponse(
      { content: [{ type: 'tool_use', id: 'toolu_r', name: 'read_file', input: { path: '/x' } }] },
      { provider: PROVIDERS.ANTHROPIC, instructionSource: 'user' }
    );
    const assistant = formatAssistantToolCallMessage({ provider: PROVIDERS.ANTHROPIC, text: normalized.text, toolCalls: normalized.toolCalls });
    const result = formatToolResultMessage({ provider: PROVIDERS.ANTHROPIC, toolCall: normalized.toolCalls[0], result: 'contents' });
    expect(assistant.content[0].id).toBe(result.content[0].tool_use_id);
  });

  it('round-trips Anthropic block order and unknown metadata while substituting guarded calls', () => {
    const payload = {
      content: [
        { type: 'text', text: 'Checking.' },
        { type: 'tool_use', id: 'a', name: 'read_file', input: { path: 'raw' }, caller: { type: 'direct' } },
        { type: 'future_block', opaque: true },
        { type: 'tool_use', id: 'b', name: 'send_email', input: { body: 'raw' } },
      ],
    };
    const normalized = normalizeResponse(payload, { provider: PROVIDERS.ANTHROPIC });
    const guardedCalls = normalized.toolCalls.map(call => ({ ...call, args: { guarded: call.id } }));
    const assistant = formatAssistantToolCallMessage({
      provider: PROVIDERS.ANTHROPIC,
      text: normalized.text,
      toolCalls: guardedCalls,
      providerAssistantMessage: normalized.providerAssistantMessage,
    });
    expect(assistant.content.map(block => block.type)).toEqual(['text', 'tool_use', 'future_block', 'tool_use']);
    expect(assistant.content[1]).toMatchObject({ id: 'a', input: { guarded: 'a' }, caller: { type: 'direct' } });
    expect(assistant.content[2]).toEqual({ type: 'future_block', opaque: true });
    expect(assistant.content[3].input).toEqual({ guarded: 'b' });
  });
});

/* ------------------------------------------------------------------ */

describe('streaming', () => {
  const adapter = (endpoint) => new APITargetAdapter({ endpoint, apiKey: FAKE_KEY, modelId: 'm' });

  it('normalizes Anthropic text deltas into the WebLLM delta shape', async () => {
    mockFetch(
      sseResponse(
        [
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}',
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo"}}',
          'data: [DONE]',
          '',
        ].join('\n')
      )
    );
    const stream = await adapter(ANTHROPIC_URL).chat.completions.create({ messages: [] });
    const out = [];
    for await (const chunk of stream) out.push(chunk.choices[0]?.delta?.content || '');
    expect(out.join('')).toBe('Hello');
  });

  it('passes OpenAI chunks through untouched', async () => {
    mockFetch(sseResponse('data: {"choices":[{"delta":{"content":"hi"}}]}\ndata: [DONE]\n'));
    const stream = await adapter(OPENAI_URL).chat.completions.create({ messages: [] });
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    expect(chunks).toEqual([{ choices: [{ delta: { content: 'hi' } }] }]);
  });

  it('accumulates Anthropic streamed tool_use into normalized calls', async () => {
    mockFetch(
      sseResponse(
        [
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Sending."}}',
          'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_s","name":"send_email"}}',
          'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"to\\":"}}',
          'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"\\"a@example.test\\"}"}}',
          'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}',
          'data: [DONE]',
          '',
        ].join('\n')
      )
    );
    const stream = await adapter(ANTHROPIC_URL).chat.completions.create({ messages: [] });
    const result = await collectStream(stream, { instructionSource: 'retrieved_content' });
    expect(result.text).toBe('Sending.');
    expect(result.stopReason).toBe('tool_use');
    expect(result.toolCalls).toEqual([
      { id: 'toolu_s', tool: 'send_email', args: { to: 'a@example.test' }, instructionSource: 'retrieved_content' },
    ]);
    expect(result.degraded).toBe(false);
  });

  it('accumulates OpenAI streamed tool_calls across deltas', async () => {
    mockFetch(
      sseResponse(
        [
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_x","function":{"name":"write_file","arguments":"{\\"path\\":"}}]}}]}',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"/tmp/a\\"}"}}]},"finish_reason":"tool_calls"}]}',
          'data: [DONE]',
          '',
        ].join('\n')
      )
    );
    const stream = await adapter(OPENAI_URL).chat.completions.create({ messages: [] });
    const result = await collectStream(stream);
    expect(result.toolCalls).toEqual([
      { id: 'call_x', tool: 'write_file', args: { path: '/tmp/a' }, instructionSource: null },
    ]);
    expect(result.stopReason).toBe('tool_calls');
  });

  it('survives a frame split across reader chunks', async () => {
    mockFetch(
      sseResponse(null, {
        chunks: ['data: {"type":"content_block_delta","index":0,"delta":{"type":"te', 'xt_delta","text":"split"}}\ndata: [DONE]\n'],
      })
    );
    const stream = await adapter(ANTHROPIC_URL).chat.completions.create({ messages: [] });
    expect((await collectStream(stream)).text).toBe('split');
  });

  it('flushes a trailing frame that arrives without a terminating newline', async () => {
    // The ported original returned on `done` and dropped this frame silently.
    mockFetch(sseResponse('data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"tail"}}'));
    const stream = await adapter(ANTHROPIC_URL).chat.completions.create({ messages: [] });
    expect((await collectStream(stream)).text).toBe('tail');
  });

  it('skips a malformed frame and records it instead of aborting the stream', async () => {
    // The ported original called JSON.parse unguarded, so one bad frame threw
    // and every later token was lost with no record that anything was missed.
    mockFetch(
      sseResponse(
        [
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"a"}}',
          'data: {not json at all',
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"b"}}',
          'data: [DONE]',
          '',
        ].join('\n')
      )
    );
    const stream = await adapter(ANTHROPIC_URL).chat.completions.create({ messages: [] });
    const result = await collectStream(stream);
    expect(result.text).toBe('ab');
    expect(result.degraded).toBe(true);
    expect(result.degradation[0].reason).toBe(DEGRADATION.STREAM_PARSE_ERROR);
  });

  it('records a stream error event rather than throwing mid-iteration', async () => {
    mockFetch(sseResponse('data: {"type":"error","error":{"message":"overloaded"}}\ndata: [DONE]\n'));
    const stream = await adapter(ANTHROPIC_URL).chat.completions.create({ messages: [] });
    const result = await collectStream(stream);
    expect(result.degraded).toBe(true);
    expect(result.degradation[0].detail.message).toBe('overloaded');
  });

  it('records a missing response body rather than throwing on getReader', async () => {
    // The ported original did `response.body.getReader()` unguarded.
    mockFetch({ ok: true, status: 200, statusText: 'OK', body: null });
    const stream = await adapter(ANTHROPIC_URL).chat.completions.create({ messages: [] });
    const result = await collectStream(stream);
    expect(result.text).toBe('');
    expect(result.degradation[0].reason).toBe(DEGRADATION.STREAM_NO_BODY);
  });

  it('ignores content after [DONE]', async () => {
    mockFetch(sseResponse('data: {"choices":[{"delta":{"content":"a"}}]}\ndata: [DONE]\ndata: {"choices":[{"delta":{"content":"b"}}]}\n'));
    const stream = await adapter(OPENAI_URL).chat.completions.create({ messages: [] });
    expect((await collectStream(stream)).text).toBe('a');
  });
});

/* ------------------------------------------------------------------ */

describe('request construction', () => {
  it('uses the endpoint exactly as given, appending no path', async () => {
    const fetchMock = mockFetch(jsonResponse({ content: [] }));
    await new APITargetAdapter({ endpoint: `  ${ANTHROPIC_URL}  `, apiKey: FAKE_KEY, modelId: 'm' })
      .chat.completions.create({ messages: [], stream: false });
    expect(fetchMock.mock.calls[0][0]).toBe(ANTHROPIC_URL);
  });

  it('lifts system messages to the Anthropic top-level field', async () => {
    const fetchMock = mockFetch(jsonResponse({ content: [] }));
    await new APITargetAdapter({ endpoint: ANTHROPIC_URL, apiKey: FAKE_KEY, modelId: 'm' })
      .chat.completions.create({
        messages: [
          { role: 'system', content: 'control clause' },
          { role: 'user', content: 'task' },
        ],
        stream: false,
      });
    const body = lastBody(fetchMock);
    expect(body.system).toBe('control clause');
    expect(body.messages).toEqual([{ role: 'user', content: 'task' }]);
    expect(body.max_tokens).toBe(1024);
  });

  it('preserves tool-result message fields on the Anthropic path', async () => {
    // The ported original mapped non-system messages down to { role, content },
    // which silently dropped everything a tool-result turn carries.
    const fetchMock = mockFetch(jsonResponse({ content: [] }));
    const toolResult = formatToolResultMessage({
      provider: PROVIDERS.ANTHROPIC,
      toolCall: { id: 'toolu_1', tool: 'read_file' },
      result: 'contents',
    });
    await new APITargetAdapter({ endpoint: ANTHROPIC_URL, apiKey: FAKE_KEY, modelId: 'm' })
      .chat.completions.create({ messages: [{ role: 'system', content: 's' }, toolResult], stream: false });
    expect(lastBody(fetchMock).messages[0]).toEqual(toolResult);
  });

  it('sends provider-shaped tools when tools are advertised', async () => {
    const fetchMock = mockFetch(jsonResponse({ content: [] }));
    await new APITargetAdapter({ endpoint: ANTHROPIC_URL, apiKey: FAKE_KEY, modelId: 'm' })
      .chat.completions.create({ messages: [], tools: DEFAULT_AUTHORITY_REGISTRY.tools, stream: false });
    expect(lastBody(fetchMock).tools[0]).toHaveProperty('input_schema');
  });

  it('omits the tools field entirely when no tools are advertised', async () => {
    const fetchMock = mockFetch(jsonResponse({ choices: [{ message: { content: '' } }] }));
    await new APITargetAdapter({ endpoint: OPENAI_URL, apiKey: FAKE_KEY, modelId: 'm' })
      .chat.completions.create({ messages: [], stream: false });
    const body = lastBody(fetchMock);
    expect('tools' in body).toBe(false);
    expect('tool_choice' in body).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe('non-streaming responses', () => {
  it('keeps the WebLLM message shape the app already consumes', async () => {
    mockFetch(jsonResponse({ content: [{ type: 'text', text: 'answer' }] }));
    const result = await new APITargetAdapter({ endpoint: ANTHROPIC_URL, apiKey: FAKE_KEY, modelId: 'm' })
      .chat.completions.create({ messages: [], stream: false });
    expect(result.choices[0].message.content).toBe('answer');
    expect(result.degraded).toBe(false);
  });

  it('exposes normalized tool calls alongside the legacy shape', async () => {
    mockFetch(jsonResponse({ content: [{ type: 'tool_use', id: 't', name: 'send_email', input: { to: 'x' } }] }));
    const result = await new APITargetAdapter({ endpoint: ANTHROPIC_URL, apiKey: FAKE_KEY, modelId: 'm' })
      .chat.completions.create({ messages: [], stream: false, instructionSource: 'retrieved_content' });
    expect(result.toolCalls[0]).toEqual({ id: 't', tool: 'send_email', args: { to: 'x' }, instructionSource: 'retrieved_content' });
    expect(result.choices[0].message.tool_calls).toBe(result.toolCalls);
  });

  it('records a body that is not JSON instead of throwing', async () => {
    mockFetch({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new Error('Unexpected token < in JSON');
      },
    });
    const result = await new APITargetAdapter({ endpoint: ANTHROPIC_URL, apiKey: FAKE_KEY, modelId: 'm' })
      .chat.completions.create({ messages: [], stream: false });
    expect(result.degraded).toBe(true);
    expect(result.degradation[0].reason).toBe(DEGRADATION.MALFORMED_RESPONSE);
    expect(result.choices[0].message.content).toBe('');
  });

  it('throws a readable message on a non-ok response', async () => {
    mockFetch(jsonResponse({ error: { message: 'model not found' } }, { ok: false, status: 404, statusText: 'Not Found' }));
    await expect(
      new APITargetAdapter({ endpoint: ANTHROPIC_URL, apiKey: FAKE_KEY, modelId: 'm' })
        .chat.completions.create({ messages: [], stream: false })
    ).rejects.toThrow(/model not found.*claude-haiku-4-5/s);
  });

  it('falls back to status text when the error body is unreadable', async () => {
    mockFetch({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('nope');
      },
    });
    await expect(
      new APITargetAdapter({ endpoint: OPENAI_URL, apiKey: FAKE_KEY, modelId: 'm' })
        .chat.completions.create({ messages: [], stream: false })
    ).rejects.toThrow('500 Internal Server Error');
  });
});

/* ------------------------------------------------------------------ */

describe('MLCEngine drop-in surface', () => {
  it('exposes chat.completions.create, reload and unload', async () => {
    const a = new APITargetAdapter({ endpoint: OPENAI_URL, apiKey: FAKE_KEY, modelId: 'm1' });
    expect(typeof a.chat.completions.create).toBe('function');
    await a.reload('m2');
    expect(a.modelId).toBe('m2');
    await expect(a.unload()).resolves.toBeUndefined();
  });

  it('constructs without arguments rather than throwing', () => {
    const a = new APITargetAdapter();
    expect(a.provider).toBe(PROVIDERS.GENERIC);
    expect(a.hasApiKey).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe('no retired-fork branding', () => {
  it('leaves no ORPHEUS string in any exported message', () => {
    const strings = [
      buildLocalToolPrompt(DEFAULT_AUTHORITY_REGISTRY.tools),
      JSON.stringify(formatToolResultMessage({ provider: PROVIDERS.ANTHROPIC, toolCall: { id: 'a' }, denied: true, denialReason: 'r' })),
      JSON.stringify(DEGRADATION),
    ].join(' ');
    expect(strings.toLowerCase()).not.toContain('orpheus');
  });
});
