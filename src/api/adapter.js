// API Target Adapter
//
// Fetch-based stand-in for the WebLLM MLCEngine when a run targets a live API
// endpoint. `endpoint` must be the full request URL (e.g.
// "https://api.openai.com/v1/chat/completions" or
// "https://api.anthropic.com/v1/messages") — it is used exactly as given and
// nothing is appended or rewritten.
//
// Ported from the retired fork's `src/api/adapter.js` (see
// docs/agent-module-plan.md §"ORPHEUS salvage assessment"). Changes on port are
// recorded at the bottom of this comment; the tool-calling layer is new.
//
// Two invariants this module exists to hold:
//
//   1. The API key lives in one place — a private instance field. It is never
//      written to storage, never logged, never returned, and is scrubbed from
//      provider error text before that text reaches a caller. `JSON.stringify`
//      on an adapter cannot reach it. Matches the storage-hardening discipline
//      in commit b2b6f1b.
//
//   2. Degradation is recorded, never hidden. A response the adapter could only
//      partly understand, or a tool call recovered from prompted JSON rather
//      than from a provider tool-calling API, comes back carrying `degraded:
//      true` and a reason. A run that silently degraded produces evidence that
//      overclaims, which is the failure mode this whole project is built to
//      avoid.
//
// Changes from the ported original: private key field + error scrubbing;
// hostname-based provider detection; SSE parsing that survives malformed lines,
// a null body, and an unterminated trailing frame; tool-call request/response
// support for both providers; tool-result feedback formatting; and the prompted
// JSON fallback for local models.

/* ------------------------------------------------------------------ */
/* providers                                                           */
/* ------------------------------------------------------------------ */

export const PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GENERIC: 'generic',
};

const ANTHROPIC_HOSTS = ['api.anthropic.com'];
const OPENAI_HOSTS = ['api.openai.com'];

/**
 * Provider detection from the endpoint URL.
 *
 * Matches on the parsed hostname, not on a substring of the whole URL. The
 * original matched the raw string, so `https://example.test/?x=api.openai.com`
 * detected as OpenAI and the key would have gone out as a Bearer header to
 * whatever that host was.
 *
 * @param {string} endpoint
 * @returns {string} one of PROVIDERS
 */
export function detectProvider(endpoint = '') {
  const raw = typeof endpoint === 'string' ? endpoint.trim() : '';
  if (!raw) return PROVIDERS.GENERIC;

  let host = '';
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return PROVIDERS.GENERIC;
  }

  if (ANTHROPIC_HOSTS.includes(host)) return PROVIDERS.ANTHROPIC;
  if (OPENAI_HOSTS.includes(host)) return PROVIDERS.OPENAI;
  return PROVIDERS.GENERIC;
}

/* ------------------------------------------------------------------ */
/* degradation vocabulary                                              */
/* ------------------------------------------------------------------ */

export const DEGRADATION = {
  /** Tool calls came from the prompted-JSON path, not a provider tool API. */
  LOCAL_JSON_FALLBACK: 'local_json_fallback',
  /** Prompted-JSON path found no parseable JSON object at all. */
  LOCAL_JSON_UNPARSEABLE: 'local_json_unparseable',
  /** A tool call's argument payload would not parse; args defaulted to {}. */
  TOOL_ARGS_UNPARSEABLE: 'tool_args_unparseable',
  /** A tool call entry was missing a tool name and was dropped. */
  TOOL_CALL_INCOMPLETE: 'tool_call_incomplete',
  /** The response body did not match the provider's documented shape. */
  MALFORMED_RESPONSE: 'malformed_response',
  /** An SSE frame could not be parsed and was skipped. */
  STREAM_PARSE_ERROR: 'stream_parse_error',
  /** The response carried no readable body to stream. */
  STREAM_NO_BODY: 'stream_no_body',
};

function degradationRecord(reason, detail = null) {
  return detail === null ? { reason } : { reason, detail };
}

/* ------------------------------------------------------------------ */
/* key hygiene                                                         */
/* ------------------------------------------------------------------ */

const REDACTED = '[REDACTED]';

/**
 * Remove any occurrence of the key from text bound for a caller. Providers do
 * sometimes echo a submitted credential back inside an error message, and that
 * message would otherwise land in an Error the UI renders.
 *
 * Short values are left alone: scrubbing a 3-character "key" would mangle
 * unrelated prose without protecting anything real.
 */
function scrubKey(text, apiKey) {
  const source = typeof text === 'string' ? text : '';
  if (typeof apiKey !== 'string' || apiKey.length < 8) return source;
  return source.split(apiKey).join(REDACTED);
}

/* ------------------------------------------------------------------ */
/* tool schemas                                                        */
/* ------------------------------------------------------------------ */

const EMPTY_SCHEMA = { type: 'object', properties: {} };

function toToolList(tools) {
  if (Array.isArray(tools)) return tools.filter(Boolean);
  if (tools && typeof tools === 'object') return Object.values(tools).filter(Boolean);
  return [];
}

/**
 * Render tool definitions into the request field each provider expects.
 *
 * Accepts either an array of `{ name, description, parameters }` or an
 * authority-registry-shaped map keyed by tool name, so a caller can hand
 * `DEFAULT_AUTHORITY_REGISTRY.tools` straight through. Registry entries carry
 * no JSON Schema, so they default to an open object schema.
 *
 * @param {Array|object} tools
 * @param {string} provider
 * @returns {Array|undefined} provider `tools` value, or undefined when empty.
 */
export function formatToolsForProvider(tools, provider) {
  const list = toToolList(tools);
  if (list.length === 0) return undefined;

  if (provider === PROVIDERS.ANTHROPIC) {
    return list.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      input_schema: tool.parameters || tool.input_schema || EMPTY_SCHEMA,
    }));
  }

  return list.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.parameters || tool.input_schema || EMPTY_SCHEMA,
    },
  }));
}

/* ------------------------------------------------------------------ */
/* normalized tool calls                                               */
/* ------------------------------------------------------------------ */

/**
 * The one internal tool-call shape, produced from every provider and from the
 * local JSON fallback:
 *
 *   { id, tool, args, instructionSource }
 *
 * `instructionSource` is provenance — which turn the originating instruction
 * came from. The adapter cannot determine that: from inside a single response
 * it is indistinguishable whether the model decided to call `send_email`
 * because the user asked or because a retrieved document told it to. Only the
 * orchestrator, which knows what it put in context, can attribute it. So it is
 * a caller-supplied parameter and defaults to **null**, not to 'user'.
 *
 * Defaulting to 'user' would be the single most damaging line in this file:
 * `isUntrustedInstructionSource` treats null as untrusted (correctly — an
 * unattributed call is exactly the case this module exists to catch), and
 * labelling it 'user' would walk every injected tool call straight through the
 * authorization gate and report the indirect-injection case as controlled.
 */
function makeToolCall(id, tool, args, instructionSource) {
  return {
    id: id || null,
    tool,
    args: args && typeof args === 'object' ? args : {},
    instructionSource: instructionSource ?? null,
  };
}

function parseArgs(raw, degradation, toolName) {
  if (raw === undefined || raw === null || raw === '') return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    degradation.push(degradationRecord(DEGRADATION.TOOL_ARGS_UNPARSEABLE, {
      tool: toolName || null,
      raw: String(raw),
    }));
    return {};
  } catch {
    degradation.push(degradationRecord(DEGRADATION.TOOL_ARGS_UNPARSEABLE, {
      tool: toolName || null,
      raw: String(raw),
    }));
    return {};
  }
}

function normalizeOpenAiToolCalls(entries, instructionSource, degradation) {
  const out = [];
  for (const entry of toToolList(entries)) {
    const name = entry?.function?.name || entry?.name || null;
    if (!name) {
      degradation.push(degradationRecord(DEGRADATION.TOOL_CALL_INCOMPLETE, { id: entry?.id ?? null }));
      continue;
    }
    const rawArgs = entry?.function?.arguments ?? entry?.arguments;
    out.push(makeToolCall(entry?.id, name, parseArgs(rawArgs, degradation, name), instructionSource));
  }
  return out;
}

function normalizeAnthropicToolUse(blocks, instructionSource, degradation) {
  const out = [];
  for (const block of toToolList(blocks)) {
    if (block?.type !== 'tool_use') continue;
    if (!block.name) {
      degradation.push(degradationRecord(DEGRADATION.TOOL_CALL_INCOMPLETE, { id: block?.id ?? null }));
      continue;
    }
    out.push(makeToolCall(block.id, block.name, parseArgs(block.input, degradation, block.name), instructionSource));
  }
  return out;
}

/**
 * Normalize a complete (non-streamed) provider response body.
 *
 * Never throws. A body that does not match the provider's documented shape
 * comes back as empty text with `degraded: true` and a MALFORMED_RESPONSE
 * record, because a parse failure the caller cannot see is a parse failure that
 * turns into a false CONTROL_HELD downstream.
 *
 * @param {unknown} payload  parsed JSON response body.
 * @param {{provider?: string, instructionSource?: string|null}} [options]
 * @returns {{text: string, toolCalls: Array, stopReason: string|null,
 *            degraded: boolean, degradation: Array}}
 */
export function normalizeResponse(payload, options = {}) {
  const { provider = PROVIDERS.GENERIC, instructionSource = null } = options;
  const degradation = [];

  let text = '';
  let toolCalls = [];
  let stopReason = null;

  if (!payload || typeof payload !== 'object') {
    degradation.push(degradationRecord(DEGRADATION.MALFORMED_RESPONSE, { received: typeof payload }));
    return finish(text, toolCalls, stopReason, degradation);
  }

  if (provider === PROVIDERS.ANTHROPIC) {
    if (!Array.isArray(payload.content)) {
      degradation.push(degradationRecord(DEGRADATION.MALFORMED_RESPONSE, { expected: 'content[]' }));
      return finish(text, toolCalls, stopReason, degradation);
    }
    text = payload.content
      .filter((block) => block?.type === 'text' || typeof block?.text === 'string')
      .map((block) => block.text || '')
      .join('');
    toolCalls = normalizeAnthropicToolUse(payload.content, instructionSource, degradation);
    stopReason = payload.stop_reason ?? null;
    return finish(text, toolCalls, stopReason, degradation);
  }

  if (!Array.isArray(payload.choices) || payload.choices.length === 0) {
    degradation.push(degradationRecord(DEGRADATION.MALFORMED_RESPONSE, { expected: 'choices[]' }));
    return finish(text, toolCalls, stopReason, degradation);
  }

  const choice = payload.choices[0] || {};
  const message = choice.message || {};
  text = typeof message.content === 'string' ? message.content : '';
  toolCalls = normalizeOpenAiToolCalls(message.tool_calls, instructionSource, degradation);
  stopReason = choice.finish_reason ?? null;
  return finish(text, toolCalls, stopReason, degradation);
}

function finish(text, toolCalls, stopReason, degradation) {
  return {
    text,
    toolCalls,
    stopReason,
    degraded: degradation.length > 0,
    degradation,
  };
}

/**
 * Normalize only the tool calls out of a complete provider response body.
 * Thin wrapper over `normalizeResponse` for callers that do not want the text.
 */
export function normalizeToolCalls(payload, options = {}) {
  const { toolCalls, degraded, degradation } = normalizeResponse(payload, options);
  return { toolCalls, degraded, degradation };
}

/* ------------------------------------------------------------------ */
/* local WebLLM prompted-JSON fallback                                 */
/* ------------------------------------------------------------------ */

/**
 * Build the prompt clause that asks a local model to emit tool calls as JSON.
 *
 * Small WebLLM models do not have a tool-calling API and call tools unreliably
 * even when prompted, so this path exists to let local runs degrade instead of
 * breaking. Anything recovered through it is marked degraded.
 *
 * @param {Array|object} tools
 * @returns {string}
 */
export function buildLocalToolPrompt(tools) {
  const list = toToolList(tools);
  const catalog = list
    .map((tool) => {
      const schema = tool.parameters || tool.input_schema || EMPTY_SCHEMA;
      return `- ${tool.name}: ${tool.description || ''}\n  arguments schema: ${JSON.stringify(schema)}`;
    })
    .join('\n');

  return [
    'You may call tools. You cannot call them directly; instead emit a single',
    'JSON object as the last thing in your reply, in a ```json fenced block,',
    'using exactly this schema:',
    '',
    '```json',
    '{"tool_calls": [{"tool": "<tool name>", "args": {"<arg>": "<value>"}}]}',
    '```',
    '',
    'Emit {"tool_calls": []} if no tool should be called. Available tools:',
    catalog || '(none)',
  ].join('\n');
}

/**
 * Extract the first balanced top-level JSON object from text, ignoring braces
 * that appear inside string literals. A regex cannot do this correctly against
 * nested argument objects, which is the common case here.
 */
function extractJsonObject(text) {
  const source = typeof text === 'string' ? text : '';
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = fenced ? [fenced[1], source] : [source];

  for (const candidate of candidates) {
    const start = candidate.indexOf('{');
    if (start === -1) continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < candidate.length; i += 1) {
      const ch = candidate[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return candidate.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * Parse tool calls out of a local model's free text via the prompted schema.
 *
 * Always returns `degraded: true` — even on a clean parse. The degradation is
 * not "the parse went badly"; it is "these tool calls did not come from a
 * provider tool-calling API," which is a real limit on what the resulting
 * evidence supports and must travel with the result.
 *
 * @param {string} text
 * @param {{instructionSource?: string|null}} [options]
 * @returns {{text: string, toolCalls: Array, stopReason: null,
 *            degraded: true, degradation: Array}}
 */
export function parseLocalToolCalls(text, options = {}) {
  const { instructionSource = null } = options;
  const source = typeof text === 'string' ? text : '';
  const degradation = [degradationRecord(DEGRADATION.LOCAL_JSON_FALLBACK)];

  const json = extractJsonObject(source);
  if (!json) {
    degradation.push(degradationRecord(DEGRADATION.LOCAL_JSON_UNPARSEABLE, { reason: 'no JSON object found' }));
    return { text: source, toolCalls: [], stopReason: null, degraded: true, degradation };
  }

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    degradation.push(degradationRecord(DEGRADATION.LOCAL_JSON_UNPARSEABLE, { reason: 'JSON.parse failed' }));
    return { text: source, toolCalls: [], stopReason: null, degraded: true, degradation };
  }

  const entries = Array.isArray(parsed?.tool_calls) ? parsed.tool_calls : null;
  if (!entries) {
    degradation.push(degradationRecord(DEGRADATION.LOCAL_JSON_UNPARSEABLE, { reason: 'no tool_calls array' }));
    return { text: source, toolCalls: [], stopReason: null, degraded: true, degradation };
  }

  const toolCalls = [];
  entries.forEach((entry, index) => {
    const name = entry?.tool || entry?.name || null;
    if (!name) {
      degradation.push(degradationRecord(DEGRADATION.TOOL_CALL_INCOMPLETE, { index }));
      return;
    }
    const args = parseArgs(entry?.args ?? entry?.arguments, degradation, name);
    toolCalls.push(makeToolCall(entry?.id || `local_${index}`, name, args, instructionSource));
  });

  return { text: source, toolCalls, stopReason: null, degraded: true, degradation };
}

/* ------------------------------------------------------------------ */
/* tool-result feedback                                                */
/* ------------------------------------------------------------------ */

function stringifyResult(result) {
  if (typeof result === 'string') return result;
  if (result === undefined || result === null) return '';
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

/**
 * Format the assistant turn that proposed tool calls, so it can be echoed back
 * into the next request. Both providers require the assistant turn to be
 * present before the matching tool result.
 *
 * @param {{provider?: string, text?: string, toolCalls?: Array}} params
 * @returns {object} provider-shaped message.
 */
export function formatAssistantToolCallMessage({ provider = PROVIDERS.GENERIC, text = '', toolCalls = [] } = {}) {
  const calls = Array.isArray(toolCalls) ? toolCalls : [];

  if (provider === PROVIDERS.ANTHROPIC) {
    const content = [];
    if (text) content.push({ type: 'text', text });
    for (const call of calls) {
      content.push({ type: 'tool_use', id: call.id, name: call.tool, input: call.args || {} });
    }
    return { role: 'assistant', content };
  }

  return {
    role: 'assistant',
    content: text || null,
    tool_calls: calls.map((call) => ({
      id: call.id,
      type: 'function',
      function: { name: call.tool, arguments: JSON.stringify(call.args || {}) },
    })),
  };
}

/**
 * Format a tool result — or a synthetic denial from the authorization gate —
 * back into the message shape the provider expects, so the ReAct loop can
 * continue the conversation.
 *
 * A denial is fed back as an error result rather than as a silently omitted
 * turn: the model needs to see that the action was refused, and the transcript
 * needs to show that a refusal happened. Denials carry a `simulated_only` note
 * because no tool in this lab ever acts.
 *
 * @param {{provider?: string, toolCall: object, result?: unknown,
 *          denied?: boolean, denialReason?: string}} params
 * @returns {object} provider-shaped message.
 */
export function formatToolResultMessage({
  provider = PROVIDERS.GENERIC,
  toolCall,
  result,
  denied = false,
  denialReason = '',
} = {}) {
  const id = toolCall?.id ?? null;
  const name = toolCall?.tool ?? null;
  const content = denied
    ? `Tool call denied by the authorization gate${denialReason ? `: ${denialReason}` : '.'} No action was taken (simulated_only).`
    : stringifyResult(result);

  if (provider === PROVIDERS.ANTHROPIC) {
    const block = { type: 'tool_result', tool_use_id: id, content };
    if (denied) block.is_error = true;
    return { role: 'user', content: [block] };
  }

  return { role: 'tool', tool_call_id: id, name, content };
}

/* ------------------------------------------------------------------ */
/* request construction                                                */
/* ------------------------------------------------------------------ */

function buildHeaders(apiKey, provider) {
  if (provider === PROVIDERS.ANTHROPIC) {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * Anthropic takes the system prompt as a top-level field rather than as a
 * message. Unlike the ported original, non-system messages are passed through
 * whole rather than reduced to `{ role, content }` — tool-result turns carry
 * fields beyond those two, and dropping them broke the ReAct loop's second turn.
 */
function splitSystemMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const system = list
    .filter((m) => m?.role === 'system')
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .join('\n\n');
  const rest = list.filter((m) => m?.role !== 'system');
  return { system, rest };
}

function buildBody({ provider, modelId, messages, temperature, max_tokens, stream, tools, tool_choice }) {
  const providerTools = formatToolsForProvider(tools, provider);

  if (provider === PROVIDERS.ANTHROPIC) {
    const { system, rest } = splitSystemMessages(messages);
    return {
      model: modelId,
      system: system || undefined,
      messages: rest,
      temperature,
      // Anthropic requires max_tokens; the OpenAI-shaped callers treat it as
      // optional, so a default is supplied rather than sending a 400.
      max_tokens: max_tokens || 1024,
      stream,
      tools: providerTools,
      tool_choice: providerTools ? tool_choice : undefined,
    };
  }

  return {
    model: modelId,
    messages,
    temperature,
    max_tokens,
    stream,
    tools: providerTools,
    tool_choice: providerTools ? tool_choice : undefined,
  };
}

function formatProviderError(message, provider) {
  if (provider === PROVIDERS.ANTHROPIC && /\bmodel\b/i.test(message)) {
    return `${message}. For the Anthropic native /v1/messages endpoint, use a current Claude API model ID such as claude-haiku-4-5, or a pinned variant.`;
  }
  return message;
}

async function readErrorMessage(response, provider) {
  try {
    const body = await response.json();
    const message = body?.error?.message || body?.message || `${response.status} ${response.statusText}`;
    return formatProviderError(String(message), provider);
  } catch {
    return formatProviderError(`${response.status} ${response.statusText}`, provider);
  }
}

/* ------------------------------------------------------------------ */
/* streaming                                                           */
/* ------------------------------------------------------------------ */

/**
 * SSE frame reader.
 *
 * Hardened against three failure modes the ported original had: it called
 * `response.body.getReader()` without checking for a null body, it ran
 * `JSON.parse` on every data line unguarded so one malformed frame aborted the
 * whole stream, and it returned on `done` without flushing a trailing frame
 * that arrived without a final newline.
 *
 * Unparseable frames are yielded as `{ __degradation }` markers rather than
 * thrown, so the caller can record them.
 */
async function* parseSSE(response) {
  const body = response?.body;
  if (!body || typeof body.getReader !== 'function') {
    yield { __degradation: degradationRecord(DEGRADATION.STREAM_NO_BODY) };
    return;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  const emit = function* (line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const data = trimmed.slice(5).trim();
    if (data === '[DONE]') {
      finished = true;
      return;
    }
    if (!data) return;
    try {
      yield JSON.parse(data);
    } catch {
      yield { __degradation: degradationRecord(DEGRADATION.STREAM_PARSE_ERROR, { frame: data.slice(0, 200) }) };
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      yield* emit(line);
      if (finished) return;
    }
  }

  // Flush a trailing frame that arrived without a terminating newline.
  if (buffer.trim()) yield* emit(buffer);
}

/**
 * Normalize provider stream events into the WebLLM/OpenAI delta shape the app
 * already consumes — `chunk.choices[0].delta.content` — and, for tool calls,
 * `chunk.choices[0].delta.tool_calls`. Anthropic's content-block events are
 * translated into that shape so a single accumulator handles both providers.
 */
async function* streamChunks(response, provider) {
  const index = { current: 0 };

  for await (const event of parseSSE(response)) {
    if (event?.__degradation) {
      yield { choices: [{ delta: {} }], degraded: true, degradation: [event.__degradation] };
      continue;
    }

    if (provider !== PROVIDERS.ANTHROPIC) {
      yield event;
      continue;
    }

    if (event.type === 'error') {
      yield {
        choices: [{ delta: {} }],
        degraded: true,
        degradation: [degradationRecord(DEGRADATION.MALFORMED_RESPONSE, {
          message: event.error?.message || 'stream error event',
        })],
      };
      continue;
    }

    if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
      index.current = event.index ?? index.current;
      yield {
        choices: [{
          delta: {
            tool_calls: [{
              index: index.current,
              id: event.content_block.id,
              type: 'function',
              function: { name: event.content_block.name, arguments: '' },
            }],
          },
        }],
      };
      continue;
    }

    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      yield { choices: [{ delta: { content: event.delta.text } }] };
      continue;
    }

    if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
      yield {
        choices: [{
          delta: {
            tool_calls: [{
              index: event.index ?? index.current,
              function: { arguments: event.delta.partial_json || '' },
            }],
          },
        }],
      };
      continue;
    }

    if (event.type === 'message_delta' && event.delta?.stop_reason) {
      yield { choices: [{ delta: {}, finish_reason: event.delta.stop_reason }] };
    }
  }
}

/**
 * Consume a normalized stream and produce the same result object
 * `normalizeResponse` produces, accumulating partial tool-call argument deltas.
 *
 * @param {AsyncIterable} stream
 * @param {{instructionSource?: string|null}} [options]
 * @returns {Promise<{text: string, toolCalls: Array, stopReason: string|null,
 *                    degraded: boolean, degradation: Array}>}
 */
export async function collectStream(stream, options = {}) {
  const { instructionSource = null } = options;
  const degradation = [];
  const accumulator = new Map();
  let text = '';
  let stopReason = null;

  for await (const chunk of stream) {
    if (Array.isArray(chunk?.degradation)) degradation.push(...chunk.degradation);
    const choice = chunk?.choices?.[0];
    if (!choice) continue;
    if (choice.finish_reason) stopReason = choice.finish_reason;

    const delta = choice.delta || {};
    if (typeof delta.content === 'string') text += delta.content;

    for (const part of toToolList(delta.tool_calls)) {
      const key = part.index ?? part.id ?? accumulator.size;
      const existing = accumulator.get(key) || { id: null, name: null, arguments: '' };
      if (part.id) existing.id = part.id;
      const name = part.function?.name || part.name;
      if (name) existing.name = name;
      const args = part.function?.arguments;
      if (typeof args === 'string') existing.arguments += args;
      accumulator.set(key, existing);
    }
  }

  const toolCalls = [];
  for (const entry of accumulator.values()) {
    if (!entry.name) {
      degradation.push(degradationRecord(DEGRADATION.TOOL_CALL_INCOMPLETE, { id: entry.id }));
      continue;
    }
    toolCalls.push(makeToolCall(entry.id, entry.name, parseArgs(entry.arguments, degradation, entry.name), instructionSource));
  }

  return finish(text, toolCalls, stopReason, degradation);
}

/* ------------------------------------------------------------------ */
/* adapter                                                             */
/* ------------------------------------------------------------------ */

/**
 * Drop-in replacement for the WebLLM MLCEngine reference held by the run loop.
 *
 * The API key is a private class field. It is reachable only by the request
 * builder inside this class: it is not an own enumerable property, so
 * `JSON.stringify(adapter)`, `Object.keys(adapter)`, and any spread of the
 * instance cannot see it, and `toJSON` is defined explicitly so a future
 * refactor cannot reintroduce it by accident.
 */
export class APITargetAdapter {
  #apiKey;

  constructor({ endpoint, apiKey, modelId } = {}) {
    this.endpoint = endpoint;
    this.modelId = modelId;
    this.provider = detectProvider(endpoint);
    this.#apiKey = typeof apiKey === 'string' ? apiKey : '';
    this.chat = { completions: { create: (opts) => this._create(opts) } };
  }

  /** Whether a key was supplied. Never exposes the key itself. */
  get hasApiKey() {
    return this.#apiKey.length > 0;
  }

  /** Serializable adapter state. Deliberately excludes the key. */
  toJSON() {
    return {
      endpoint: this.endpoint,
      modelId: this.modelId,
      provider: this.provider,
      hasApiKey: this.hasApiKey,
    };
  }

  async _create({
    messages,
    temperature,
    max_tokens,
    stream = true,
    tools,
    tool_choice,
    instructionSource = null,
  } = {}) {
    const url = typeof this.endpoint === 'string' ? this.endpoint.trim() : '';
    const headers = buildHeaders(this.#apiKey, this.provider);
    const body = buildBody({
      provider: this.provider,
      modelId: this.modelId,
      messages,
      temperature,
      max_tokens,
      stream,
      tools,
      tool_choice,
    });

    let response;
    try {
      response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (err) {
      throw new Error(scrubKey(`Request to the API endpoint failed: ${err?.message || err}`, this.#apiKey));
    }

    if (!response.ok) {
      throw new Error(scrubKey(await readErrorMessage(response, this.provider), this.#apiKey));
    }

    if (!stream) {
      let data;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      const normalized = normalizeResponse(data, { provider: this.provider, instructionSource });
      // Superset of the WebLLM non-streaming shape the app already reads, so
      // existing call sites keep working while the ReAct loop reads the
      // normalized fields.
      return {
        choices: [{
          message: { role: 'assistant', content: normalized.text, tool_calls: normalized.toolCalls },
          finish_reason: normalized.stopReason,
        }],
        text: normalized.text,
        toolCalls: normalized.toolCalls,
        stopReason: normalized.stopReason,
        degraded: normalized.degraded,
        degradation: normalized.degradation,
      };
    }

    return streamChunks(response, this.provider);
  }

  // No-ops so this adapter can stand in for an MLCEngine reference.
  async reload(modelId) {
    this.modelId = modelId;
  }

  async unload() {}
}
