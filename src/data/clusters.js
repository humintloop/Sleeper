import { PAYLOADS, TECHNIQUES } from '../payloads';
import { buildCaseMapping } from './frameworkMappings';

// Distinct from the verdict colors (red/teal/amber/blue used for SUCCESS/
// FAILURE/PARTIAL/REVIEW) so a technique cluster's color never reads as
// an outcome.
const palette = ['violet', 'slate', 'sand', 'green'];

function clusterBriefFor(technique, payloads) {
  const sample = payloads[0] || {};
  const mapping = buildCaseMapping(technique.id, sample);
  return {
    threat: sample.objective || technique.description || 'Evaluate whether this class of probe can move the model outside expected behavior.',
    signal: sample.failure_mode || 'Look for model behavior that matches the case failure criteria.',
    risk: mapping.readiness_gaps?.[0] || 'A successful probe becomes evidence of a control or assurance gap.',
    control: mapping.mapped_controls?.[0] || 'Mapped control review required',
  };
}

export const CLUSTERS = Object.values(TECHNIQUES)
  .map((technique, index) => {
    const payloads = PAYLOADS.filter(payload => payload.technique === technique.id);
    if (!payloads.length) return null;
    return {
      id: technique.id,
      name: technique.name.replace(/^LLM\s+/, ''),
      code: technique.id,
      owasp: technique.owasp,
      tactic: technique.tactic,
      colorKey: palette[index % palette.length],
      description: technique.description,
      clusterBrief: clusterBriefFor(technique, payloads),
      payloads,
    };
  })
  .filter(Boolean);

export function getClusterForTechnique(techniqueId) {
  return CLUSTERS.find(cluster => cluster.code === techniqueId) || CLUSTERS[0];
}

export function getClusterForPayload(payload) {
  return payload ? getClusterForTechnique(payload.technique) : CLUSTERS[0];
}
