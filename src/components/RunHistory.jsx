// Locally retained agent runs, grouped the way they were actually produced.
//
// A comparison run writes three records — Baseline, Partial, Reference — in
// one pass. Listed flat, that is three near-identical rows repeating the same
// case title and the same timestamp, and twenty retained records collapse
// into six or seven visually indistinguishable blocks. The reader has to
// reconstruct by eye the one thing the list should be telling them: that
// these three belong together, and that their verdicts differ.
//
// So the row is the comparison, not the record. Each group shows its members'
// verdicts side by side; the individual records are still there, one level
// down, with their full Evidence Contract.
import { useState } from 'react';
import { ChevronRight, History } from 'lucide-react';
import EvidenceContractPanel from './EvidenceContractPanel';
import { getVerdictColor, getVerdictLabel } from './VerdictBanner';

/**
 * Group a newest-first run list into comparison batches.
 *
 * Records carry a `batchId` when they were written by one comparison pass.
 * Records without one — a single-profile run, or anything persisted before
 * batch ids existed — form their own single-member group, so an older history
 * still renders correctly rather than silently merging unrelated runs.
 */
export function groupRunHistory(history) {
  const groups = [];
  const byBatch = new Map();
  for (const entry of history || []) {
    const batchId = entry?.batchId;
    if (batchId && byBatch.has(batchId)) {
      byBatch.get(batchId).entries.push(entry);
      continue;
    }
    const group = { id: batchId || entry?.id, batchId: batchId ?? null, entries: [entry] };
    if (batchId) byBatch.set(batchId, group);
    groups.push(group);
  }
  return groups;
}

function shortProfile(label) {
  return String(label || '').replace(/\s*Profile$/i, '');
}

// The verdict and the degraded flag are one object, and they live inside the
// group's own header. A reader must not be able to see CONTROL_HELD without
// also seeing that the run producing it was degraded — so neither may sit
// behind a disclosure the other does not.
function VerdictChip({ C, entry }) {
  const color = getVerdictColor(entry.verdict, C);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
      <span style={{ color: C.text3, fontSize: C.size.micro }}>{shortProfile(entry.profileLabel)}</span>
      <span style={{
        color, border: `1px solid ${color}55`, background: `${color}12`, borderRadius: C.radius,
        padding: '1px 6px', fontSize: C.size.micro, fontWeight: 800, fontFamily: C.mono,
      }}>
        {getVerdictLabel(entry.verdict)}
      </span>
      {entry.degraded && (
        <span style={{
          color: C.red, border: `1px solid ${C.red}55`, background: C.redBg, borderRadius: C.radius,
          padding: '1px 5px', fontSize: C.size.micro, fontWeight: 800,
        }}>
          DEGRADED
        </span>
      )}
    </span>
  );
}

function RunRecord({ C, entry }) {
  const [open, setOpen] = useState(false);
  const color = getVerdictColor(entry.verdict, C);
  return (
    <div style={{ borderTop: `1px solid ${C.border}` }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '8px 0', display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap',
        }}
      >
        <ChevronRight size={12} color={C.text3} style={{ transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }} />
        <span style={{ color: C.text1, fontSize: C.size.small }}>{shortProfile(entry.profileLabel)}</span>
        <span style={{ color, fontSize: C.size.micro, fontWeight: 800, fontFamily: C.mono }}>{getVerdictLabel(entry.verdict)}</span>
        {entry.degraded && (
          <span style={{ color: C.red, fontSize: C.size.micro, fontWeight: 700 }}>DEGRADED</span>
        )}
      </button>
      {open && (
        <div style={{ padding: '0 0 12px 21px' }}>
          {entry.reasonText && (
            <div style={{ fontSize: C.size.small, color: C.text2, lineHeight: 1.5, marginBottom: 10 }}>{entry.reasonText}</div>
          )}
          <EvidenceContractPanel C={C} contract={entry.contract} />
        </div>
      )}
    </div>
  );
}

function RunGroup({ C, group }) {
  const [open, setOpen] = useState(false);
  const first = group.entries[0];
  // The worst verdict in the batch drives the group's edge — a comparison
  // where one profile failed is a comparison with a failure in it, whatever
  // the other two did.
  const severity = ['CONTROL_FAILED', 'PARTIAL_CONTROL_FAILURE', 'INCONCLUSIVE', 'CONTROL_HELD'];
  const worst = [...group.entries].sort(
    (a, b) => severity.indexOf(a.verdict) - severity.indexOf(b.verdict),
  )[0];
  const tone = getVerdictColor(worst?.verdict, C);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${tone}`, borderRadius: C.radius }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '10px 13px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}
      >
        <ChevronRight size={13} color={C.text3} style={{ transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }} />
        <span style={{ color: C.text1, fontSize: C.size.small, fontWeight: 600 }}>{first?.caseTitle}</span>
        <span style={{ marginLeft: 'auto', color: C.text3, fontSize: C.size.micro, fontFamily: C.mono }}>
          {first?.timestamp ? new Date(first.timestamp).toLocaleString() : ''}
        </span>
        <span style={{ flexBasis: '100%', display: 'flex', gap: 12, flexWrap: 'wrap', paddingLeft: 21, marginTop: 2 }}>
          {group.entries.map(entry => <VerdictChip key={entry.id} C={C} entry={entry} />)}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 13px 4px 34px' }}>
          {group.entries.map(entry => <RunRecord key={entry.id} C={C} entry={entry} />)}
        </div>
      )}
    </div>
  );
}

export default function RunHistory({ C, history, chainStatus, cardStyle }) {
  const groups = groupRunHistory(history);
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <History size={13} color={C.text3} />
        <div style={{ fontSize: C.size.micro, color: C.text3, letterSpacing: 1.2, fontWeight: 700, textTransform: 'uppercase' }}>
          Recent runs &middot; this browser
        </div>
      </div>
      {chainStatus && (
        <div role={chainStatus.valid ? undefined : 'alert'} style={{ fontSize: C.size.micro, color: chainStatus.valid ? C.text3 : C.red, lineHeight: 1.5, marginBottom: 10 }}>
          Browser hash chain: {chainStatus.status.replaceAll('_', ' ')} &middot; {chainStatus.checked} retained records checked
          {chainStatus.latest_sequence ? ` · latest sequence ${chainStatus.latest_sequence}` : ''}. {chainStatus.limitation}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {groups.map(group => <RunGroup key={group.id} C={C} group={group} />)}
      </div>
    </div>
  );
}
