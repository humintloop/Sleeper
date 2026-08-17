// Shared victim-model catalog. Single source of truth for the single-turn
// probe flow (App.jsx) and the agent case runner (AgentCaseRunner.jsx), which
// both need to load the same WebLLM models locally.
export const VICTIM_MODELS = [
  { id: 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC',  name: 'TinyLlama 1.1B',  size: '~0.7 GB', vram: '1 GB', quickStart: true },
  { id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',     name: 'Llama 3.2 3B',    size: '~2.0 GB', vram: '3 GB'  },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',     name: 'Phi 3.5 Mini',    size: '~2.2 GB', vram: '3 GB'  },
  { id: 'gemma-2-2b-it-q4f16_1-MLC',             name: 'Gemma 2 2B',      size: '~1.4 GB', vram: '2 GB'  },
  { id: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',     name: 'Llama 3.1 8B',    size: '~4.9 GB', vram: '6 GB'  },
  { id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',  name: 'Mistral 7B',      size: '~4.1 GB', vram: '5 GB'  },
  { id: 'gemma-2-9b-it-q4f32_1-MLC',             name: 'Gemma 2 9B',      size: '~5.6 GB', vram: '7 GB'  },
  { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',       name: 'Qwen 2.5 7B',     size: '~4.4 GB', vram: '5 GB'  },
];
