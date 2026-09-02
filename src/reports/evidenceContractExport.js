export function prepareEvidenceContractExport({
  contract,
  state = 'current',
  confirmed = false,
  changes = [],
  currentConfigurationDigest = null,
} = {}) {
  if (state !== 'stale') return contract;
  if (!confirmed) {
    const error = new Error('This result is historical because the current execution configuration changed. Confirm a historical export to continue.');
    error.code = 'STALE_EXPORT_CONFIRMATION_REQUIRED';
    throw error;
  }
  return {
    export_context: {
      state: 'historical',
      intentional_stale_export: true,
      completed_configuration_digest: contract?.run_manifest?.configuration_digest ?? null,
      completed_manifest_digest: contract?.run_manifest?.manifest_digest ?? null,
      current_configuration_digest: currentConfigurationDigest,
      changed_fields: changes,
      note: 'Historical evidence exported intentionally. It describes the completed run identity, not the configuration currently selected in the UI.',
    },
    evidence_contract: contract,
  };
}
