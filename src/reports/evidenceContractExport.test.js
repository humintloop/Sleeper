import { describe, expect, it } from 'vitest';
import { prepareEvidenceContractExport } from './evidenceContractExport';

describe('Evidence Contract export state', () => {
  const contract = {
    case_id: 'NR-AGT-001',
    run_manifest: { configuration_digest: 'completed-digest', manifest_digest: 'manifest-digest' },
  };

  it('returns the current contract without relabeling it', () => {
    expect(prepareEvidenceContractExport({ contract, state: 'current' })).toBe(contract);
  });

  it('requires explicit confirmation before exporting a stale result', () => {
    expect(() => prepareEvidenceContractExport({
      contract,
      state: 'stale',
      changes: [{ path: 'trial_count', before: '3', after: '4' }],
    })).toThrowError(expect.objectContaining({ code: 'STALE_EXPORT_CONFIRMATION_REQUIRED' }));
  });

  it('labels a confirmed stale export historical and preserves completed identity', () => {
    const exported = prepareEvidenceContractExport({
      contract,
      state: 'stale',
      confirmed: true,
      changes: [{ path: 'trial_count', before: '3', after: '4' }],
      currentConfigurationDigest: 'current-digest',
    });
    expect(exported.export_context).toMatchObject({
      state: 'historical',
      completed_configuration_digest: 'completed-digest',
      completed_manifest_digest: 'manifest-digest',
      current_configuration_digest: 'current-digest',
    });
    expect(exported.export_context.changed_fields[0].path).toBe('trial_count');
    expect(exported.evidence_contract).toBe(contract);
  });
});
