import { describe, expect, it } from 'vitest';
import { WebLLMLocalTarget } from './webllmLocalTarget';

const fakeEngine = (replyText) => {
  const calls = [];
  return {
    calls,
    chat: {
      completions: {
        create: async (params) => {
          calls.push(params);
          return { choices: [{ message: { role: 'assistant', content: replyText } }] };
        },
      },
    },
  };
};

const TOOLS = [{ name: 'send_email', description: 'Send an email.', parameters: { type: 'object', properties: {} } }];

describe('construction', () => {
  it('requires an engine', () => {
    expect(() => new WebLLMLocalTarget({})).toThrow(/requires an already-loaded/);
  });
});

describe('tool-call parsing', () => {
  it('parses a well-formed tool_calls JSON block from the reply text', async () => {
    const engine = fakeEngine('Sure.\n```json\n{"tool_calls": [{"tool": "send_email", "args": {"to": "a@b.test"}}]}\n```');
    const target = new WebLLMLocalTarget({ engine });

    const result = await target._create({
      messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'do it' }],
      tools: TOOLS,
      instructionSource: 'user',
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].tool).toBe('send_email');
    expect(result.toolCalls[0].instructionSource).toBe('user');
    expect(result.degraded).toBe(true);
  });

  it('returns no tool calls, still marked degraded, when the reply has no JSON block', async () => {
    const engine = fakeEngine('I will not do that.');
    const target = new WebLLMLocalTarget({ engine });

    const result = await target._create({
      messages: [{ role: 'system', content: 'sys' }],
      tools: TOOLS,
    });

    expect(result.toolCalls).toEqual([]);
    expect(result.degraded).toBe(true);
    expect(result.text).toBe('I will not do that.');
  });
});

describe('message flattening', () => {
  it('appends the tool catalog prompt to the first system message only', async () => {
    const engine = fakeEngine('{"tool_calls": []}');
    const target = new WebLLMLocalTarget({ engine });

    await target._create({
      messages: [{ role: 'system', content: 'You are an agent.' }, { role: 'user', content: 'go' }],
      tools: TOOLS,
    });

    const sent = engine.calls[0].messages;
    expect(sent[0].role).toBe('system');
    expect(sent[0].content).toContain('You are an agent.');
    expect(sent[0].content).toContain('send_email');
    expect(sent[0].content).toContain('json');
  });

  it('does not append a tool prompt when no tools are advertised', async () => {
    const engine = fakeEngine('ok');
    const target = new WebLLMLocalTarget({ engine });

    await target._create({ messages: [{ role: 'system', content: 'plain' }], tools: [] });

    expect(engine.calls[0].messages[0].content).toBe('plain');
  });

  it('converts an OpenAI-shaped tool-result message into a plain user turn', async () => {
    const engine = fakeEngine('{"tool_calls": []}');
    const target = new WebLLMLocalTarget({ engine });

    await target._create({
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'tool', tool_call_id: 'c1', name: 'send_email', content: 'Denied: high risk.' },
      ],
      tools: [],
    });

    const toolTurn = engine.calls[0].messages[1];
    expect(toolTurn.role).toBe('user');
    expect(toolTurn.content).toContain('send_email');
    expect(toolTurn.content).toContain('Denied: high risk.');
  });

  it('drops the synthetic tool_calls array from an assistant turn but keeps its original text', async () => {
    // formatAssistantToolCallMessage's GENERIC shape keeps the model's raw
    // text (including its own ```json block) in `content` — that must be
    // replayed verbatim; the reconstructed tool_calls array must not be sent,
    // since a local model's template does not know what to do with it.
    const engine = fakeEngine('{"tool_calls": []}');
    const target = new WebLLMLocalTarget({ engine });

    await target._create({
      messages: [
        { role: 'system', content: 'sys' },
        {
          role: 'assistant',
          content: 'Calling send_email.\n```json\n{"tool_calls":[{"tool":"send_email","args":{}}]}\n```',
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'send_email', arguments: '{}' } }],
        },
      ],
      tools: [],
    });

    const assistantTurn = engine.calls[0].messages[1];
    expect(assistantTurn.tool_calls).toBeUndefined();
    expect(assistantTurn.content).toContain('Calling send_email');
  });

  it('flattens Anthropic-shaped array content defensively', async () => {
    const engine = fakeEngine('{"tool_calls": []}');
    const target = new WebLLMLocalTarget({ engine });

    await target._create({
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'Denied.' }] },
      ],
      tools: [],
    });

    const turn = engine.calls[0].messages[1];
    expect(typeof turn.content).toBe('string');
    expect(turn.content).toContain('Denied.');
  });
});

describe('lifecycle no-ops', () => {
  it('accepts reload/unload calls without touching the engine', async () => {
    const engine = fakeEngine('ok');
    const target = new WebLLMLocalTarget({ engine });
    await expect(target.reload()).resolves.toBeUndefined();
    await expect(target.unload()).resolves.toBeUndefined();
  });
});

describe('calling the engine', () => {
  it('always calls with stream: false, regardless of runAgentCase passing stream', async () => {
    const engine = fakeEngine('{"tool_calls": []}');
    const target = new WebLLMLocalTarget({ engine });

    await target._create({ messages: [{ role: 'system', content: 'sys' }], tools: [], stream: true });

    expect(engine.calls[0].stream).toBe(false);
  });
});
