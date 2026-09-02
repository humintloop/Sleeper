import { describe, expect, it } from 'vitest';
import { prepareReportExport } from './reportExport';

describe('report export state', () => {
  const base = {
    completedConfigurationDigest: 'completed-digest',
    completedManifestDigest: 'manifest-digest',
    currentConfigurationDigest: 'current-digest',
    changes: [{ path: 'trial_count', before: '3', after: '4' }],
  };

  it('returns markdown/html/json content unchanged when current', () => {
    expect(prepareReportExport({ content: '# Report', format: 'markdown', state: 'current' })).toBe('# Report');
    expect(prepareReportExport({ content: '<p>Report</p>', format: 'html', state: 'current' })).toBe('<p>Report</p>');
    const json = { runs: [] };
    expect(prepareReportExport({ content: json, format: 'json', state: 'current' })).toBe(json);
  });

  it('requires explicit confirmation before exporting a stale report, in any format', () => {
    for (const format of ['markdown', 'html', 'json']) {
      expect(() => prepareReportExport({ content: 'x', format, state: 'stale', ...base }))
        .toThrowError(expect.objectContaining({ code: 'STALE_EXPORT_CONFIRMATION_REQUIRED' }));
    }
  });

  it('prepends a historical banner to a confirmed stale Markdown export, naming the changed fields', () => {
    const exported = prepareReportExport({ content: '# Report body', format: 'markdown', state: 'stale', confirmed: true, ...base });
    expect(exported.startsWith('> **HISTORICAL EXPORT.**')).toBe(true);
    expect(exported).toContain('completed-digest');
    expect(exported).toContain('current-digest');
    expect(exported).toContain('trial_count');
    expect(exported).toContain('# Report body');
  });

  it('prepends an escaped historical banner to a confirmed stale HTML export', () => {
    const exported = prepareReportExport({
      content: '<p>Report body</p>', format: 'html', state: 'stale', confirmed: true,
      ...base, completedConfigurationDigest: '<script>alert(1)</script>',
    });
    expect(exported).toContain('HISTORICAL EXPORT');
    expect(exported).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(exported).not.toContain('<script>alert(1)</script>');
    expect(exported).toContain('<p>Report body</p>');
  });

  it('wraps a confirmed stale JSON export with export_context, preserving the original report object', () => {
    const report = { runs: [{ id: 'run-1' }] };
    const exported = prepareReportExport({ content: report, format: 'json', state: 'stale', confirmed: true, ...base });
    expect(exported.export_context).toMatchObject({
      state: 'historical',
      completed_configuration_digest: 'completed-digest',
      completed_manifest_digest: 'manifest-digest',
      current_configuration_digest: 'current-digest',
    });
    expect(exported.export_context.changed_fields[0].path).toBe('trial_count');
    expect(exported.report).toBe(report);
  });
});
