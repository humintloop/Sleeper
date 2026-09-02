import { describe, expect, it } from 'vitest';
import { groupRunHistory } from './RunHistory';

const record = (id, batchId, extra = {}) => ({
  id,
  batchId,
  caseTitle: 'External Email Injection to Internal Data Exfiltration',
  profileLabel: 'Baseline Profile',
  verdict: 'CONTROL_FAILED',
  timestamp: '2026-09-02T11:34:03.000Z',
  ...extra,
});

describe('groupRunHistory', () => {
  it('collapses the three records of one comparison pass into a single group', () => {
    const groups = groupRunHistory([
      record('c', 'cmp-1', { profileId: 'reference' }),
      record('b', 'cmp-1', { profileId: 'partial' }),
      record('a', 'cmp-1', { profileId: 'baseline' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].batchId).toBe('cmp-1');
    expect(groups[0].entries.map(entry => entry.id)).toEqual(['c', 'b', 'a']);
  });

  it('keeps separate comparison passes separate', () => {
    const groups = groupRunHistory([
      record('d', 'cmp-2'),
      record('c', 'cmp-1'),
      record('b', 'cmp-1'),
    ]);
    expect(groups.map(group => group.batchId)).toEqual(['cmp-2', 'cmp-1']);
    expect(groups[1].entries).toHaveLength(2);
  });

  it('gives every record without a batch id its own group, so pre-batch history still reads correctly', () => {
    const groups = groupRunHistory([
      record('b', undefined),
      record('a', undefined),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map(group => group.id)).toEqual(['b', 'a']);
    expect(groups.every(group => group.batchId === null)).toBe(true);
  });

  it('does not merge a batched run with an unbatched one that happens to sit beside it', () => {
    const groups = groupRunHistory([
      record('c', 'cmp-1'),
      record('b', undefined),
      record('a', 'cmp-1'),
    ]);
    // The unbatched record stands alone; the two cmp-1 records still find each
    // other even though a foreign record was written between them.
    expect(groups).toHaveLength(2);
    expect(groups[0].entries.map(entry => entry.id)).toEqual(['c', 'a']);
    expect(groups[1].entries.map(entry => entry.id)).toEqual(['b']);
  });

  it('returns nothing for an empty or missing history', () => {
    expect(groupRunHistory([])).toEqual([]);
    expect(groupRunHistory(undefined)).toEqual([]);
  });
});
