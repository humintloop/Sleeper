import { describe, expect, it } from 'vitest';
import { attachExternalWitness } from './evidenceWitness';

const contract = {
  contract_version: '1', case_id: 'CASE-1', run_manifest: { manifest_digest: 'manifest' },
  integrity: { digest: 'contract-digest', signed: false, replay_resistant: false },
};

describe('external evidence witness boundary', () => {
  it('does nothing when no external witness is configured', async () => {
    expect(await attachExternalWitness(contract)).toBe(contract);
  });

  it('attaches a verified, sequenced receipt', async () => {
    const witness = {
      attest: async request => ({
        contract_digest: request.contract_digest,
        signature: 'signature', key_id: 'witness-key-1', append_only: true,
        sequence: 7, nonce: '0123456789abcdef', timestamp: '2026-08-17T00:00:00Z',
      }),
      verify: async () => true,
    };
    const result = await attachExternalWitness(contract, witness);
    expect(result.integrity.signed).toBe(true);
    expect(result.integrity.replay_resistant).toBe(true);
    expect(result.integrity.external_witness.verified).toBe(true);
  });

  it('does not trust an unverified or mismatched receipt', async () => {
    const witness = {
      attest: async () => ({ contract_digest: 'other' }),
      verify: async () => true,
    };
    const result = await attachExternalWitness(contract, witness);
    expect(result.integrity.signed).toBe(false);
    expect(result.integrity.replay_resistant).toBe(false);
    expect(result.integrity.external_witness.verified).toBe(false);
  });
});
