// Stale-export gating for the human-readable report (Markdown/HTML/JSON),
// mirroring evidenceContractExport.js's contract: a stale result requires
// explicit confirmation, and a confirmed stale export is labeled historical
// rather than silently relabeled as describing the current configuration.
// Pure and synchronous — downloading is a thin UI concern in ReportPanel.jsx.
import { escapeHtml } from './reportGenerator';

export function prepareReportExport({
  content,
  format,
  state = 'current',
  confirmed = false,
  changes = [],
  completedConfigurationDigest = null,
  completedManifestDigest = null,
  currentConfigurationDigest = null,
} = {}) {
  if (state !== 'stale') return content;
  if (!confirmed) {
    const error = new Error('This result is historical because the current execution configuration changed. Confirm a historical export to continue.');
    error.code = 'STALE_EXPORT_CONFIRMATION_REQUIRED';
    throw error;
  }

  const context = {
    state: 'historical',
    intentional_stale_export: true,
    completed_configuration_digest: completedConfigurationDigest,
    completed_manifest_digest: completedManifestDigest,
    current_configuration_digest: currentConfigurationDigest,
    changed_fields: changes,
    note: 'Historical evidence exported intentionally. It describes the completed run identity, not the configuration currently selected in the UI.',
  };

  if (format === 'json') return { export_context: context, report: content };

  const changedList = changes.map(change => change.path).join(', ') || 'unspecified';
  if (format === 'markdown') {
    return `> **HISTORICAL EXPORT.** Completed configuration digest \`${completedConfigurationDigest ?? 'unrecorded'}\`; `
      + `current configuration digest is \`${currentConfigurationDigest ?? 'unrecorded'}\`. Changed fields: ${changedList}. `
      + `This describes the completed run identity, not the configuration currently selected in the UI.\n\n${content}`;
  }
  if (format === 'html') {
    return `<div style="border:2px solid #B99242;background:rgba(185,146,66,.12);padding:12px 16px;margin-bottom:18px;">`
      + `<strong>HISTORICAL EXPORT.</strong> Completed configuration digest ${escapeHtml(completedConfigurationDigest ?? 'unrecorded')}; `
      + `current configuration digest is ${escapeHtml(currentConfigurationDigest ?? 'unrecorded')}. Changed fields: ${escapeHtml(changedList)}. `
      + `This describes the completed run identity, not the configuration currently selected in the UI.</div>\n${content}`;
  }
  return content;
}
