import { describe, expect, it } from 'vitest';
import { AGENT_CASES } from '../data/agentCases';
import { PortfolioReplayTarget } from './replayTarget';

describe('portfolio replay target', () => {
  it('drives the email hero path without pretending to be degraded model parsing', async () => {
    const target = new PortfolioReplayTarget({ agentCase: AGENT_CASES['NR-AGT-001'] });
    expect((await target._create()).toolCalls[0].tool).toBe('retrieve_email');
    expect((await target._create()).toolCalls[0].tool).toBe('retrieve_document');
    expect((await target._create()).toolCalls[0].tool).toBe('send_email');
  });

  it('replays the same denied call twice for the replay-approval variant', async () => {
    const variant = AGENT_CASES['NR-AGT-002'].variants.find(item => item.key === 'denied_decision_replay');
    const target = new PortfolioReplayTarget({ agentCase: AGENT_CASES['NR-AGT-002'], variant });
    const first = await target._create();
    const second = await target._create();
    expect(second.toolCalls[0]).toEqual(first.toolCalls[0]);
  });
});
