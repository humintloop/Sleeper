// Wraps an already-loaded WebLLM MLCEngine so it can stand in for the live
// APITargetAdapter as a runAgentCase target. Local models do not reliably
// support OpenAI-style tool-calling or a synthetic `tool` message role, so
// this target never sends `tools` to the engine and never round-trips
// OpenAI-shaped tool_calls/tool-role messages through it — everything is
// flattened to plain system/user/assistant text turns, with the tool catalog
// and JSON-emit schema folded into the system prompt (adapter.js's
// buildLocalToolPrompt) and the reply parsed back out with
// parseLocalToolCalls. Every response from this target is `degraded: true` by
// construction — recorded, never hidden, per CLAUDE.md's evidence discipline.
import { buildLocalToolPrompt, parseLocalToolCalls } from '../api/adapter.js';

export class WebLLMLocalTarget {
  #engine;

  constructor({ engine }) {
    if (!engine) throw new Error('WebLLMLocalTarget requires an already-loaded MLCEngine.');
    this.#engine = engine;
  }

  /**
   * Rewrite the OpenAI/Anthropic-shaped message list runAgentCase builds into
   * plain text turns a small local model's chat template can actually follow.
   */
  #flattenMessages(messages, tools) {
    const toolPrompt = tools?.length > 0 ? `\n\n${buildLocalToolPrompt(tools)}` : '';
    let systemAppended = false;

    return (messages || []).map(message => {
      if (message.role === 'system' && !systemAppended) {
        systemAppended = true;
        return { role: 'system', content: `${message.content || ''}${toolPrompt}` };
      }

      if (message.role === 'tool') {
        return {
          role: 'user',
          content: `[TOOL RESULT — ${message.name || 'unknown'}]\n${typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}`,
        };
      }

      if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
        // formatAssistantToolCallMessage's GENERIC shape keeps the model's
        // original raw text (including its ```json tool_calls block) in
        // `content`; the synthetic tool_calls array is a reconstruction this
        // target never asked for, so it is dropped rather than replayed.
        return { role: 'assistant', content: message.content || '' };
      }

      // Anthropic-shaped array content (tool_use / tool_result blocks) should
      // never reach this target — provider is always GENERIC for local runs —
      // but flatten defensively rather than sending the engine something it
      // cannot render.
      if (Array.isArray(message.content)) {
        const text = message.content.map(block => block.text || block.content || '').join('\n');
        return { role: message.role, content: text };
      }

      return message;
    });
  }

  async _create({ messages, tools, instructionSource = null } = {}) {
    const flattened = this.#flattenMessages(messages, tools);
    const response = await this.#engine.chat.completions.create({
      messages: flattened,
      stream: false,
    });

    const text = response?.choices?.[0]?.message?.content ?? '';
    return parseLocalToolCalls(text, { instructionSource });
  }

  // No-ops so this target can stand in wherever an adapter's reload/unload
  // lifecycle is referenced; the engine's own lifecycle is owned by the
  // caller that loaded it, not by this wrapper.
  async reload() {}
  async unload() {}
}
