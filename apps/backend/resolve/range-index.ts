/**
 * Derived indexes over `state.hiddeDecorationsRanges` (the source of truth).
 *
 * `addOrUpdatePrettyRange` used to scan every active range per call (O(M²)
 * over a reparse). These structures make that scan O(k), where k is the
 * number of ranges whose line span overlaps the new range's:
 *  - `lineIndex`  — Map<start.line, Range[]> for overlap candidate lookup
 *  - `rangeKeyToCacheKey` — Map<rangeKey, cacheKey> so the owning rule's
 *    priority can be read without rebuilding a map over all cache entries
 *
 * Ranges are immutable value objects, so identity (===) works for removal.
 */
import type { Range } from '../host';
import type { DocumentStore } from '../document/type';

/** String key identifying a range by its exact start/end positions. */
export const rangeKey = (r: Range): string =>
  `${r.start.line}:${r.start.character}-${r.end.line}:${r.end.character}`;

/** Builds the line index from a set of ranges (bulk rebuild). */
export const buildLineIndex = (set: Set<Range>): Map<number, Range[]> => {
  const index = new Map<number, Range[]>();
  for (const r of set) {
    indexInsert(index, r);
  }
  return index;
};

/** Inserts a single range into the line index (incremental maintenance). */
export const indexInsert = (index: Map<number, Range[]>, r: Range): void => {
  let bucket = index.get(r.start.line);
  if (!bucket) {
    bucket = [];
    index.set(r.start.line, bucket);
  }
  bucket.push(r);
};

/** Removes a single range from the line index (incremental maintenance). */
export const indexRemove = (index: Map<number, Range[]>, r: Range): void => {
  const bucket = index.get(r.start.line);
  if (!bucket) return;
  const i = bucket.indexOf(r);
  if (i === -1) return;
  bucket.splice(i, 1);
  if (bucket.length === 0) index.delete(r.start.line);
};

/**
 * Ranges in the index whose line span overlaps the given range's line span.
 * A range starting on line L can intersect `r` only if L is in
 * [r.start.line, r.end.line]. Multi-line ranges are rare, so the bucket scan
 * is capped; beyond the cap we fall back to the full set (still correct).
 *
 * Note: the overlap/priority outcome in `addOrUpdatePrettyRange` is
 * order-independent — a `break` only fires when the new range is rejected,
 * in which case the accumulated removals are discarded — so bucket order
 * does not affect the final set of active ranges.
 */
/** Full-set fallback when the range's line span exceeds the bucket cap. */
const allRanges = (set: Set<Range>): Range[] => [...set];

/** Appends one index bucket's ranges to the candidate list. */
const appendBucket = (out: Range[], bucket: Range[] | undefined): void => {
  if (bucket) out.push(...bucket);
};

/** Collects the candidate ranges from the index buckets the range spans. */
const bucketCandidates = (index: Map<number, Range[]>, r: Range): Range[] => {
  const out: Range[] = [];
  for (let line = r.start.line; line <= r.end.line; line++) appendBucket(out, index.get(line));

  return out;
};

export const overlapCandidates = (
  index: Map<number, Range[]>,
  set: Set<Range>,
  r: Range,
  maxBuckets = 64,
): Range[] => {
  const span = r.end.line - r.start.line;
  if (span >= maxBuckets) return allRanges(set);

  return bucketCandidates(index, r);
};

/**
 * Rebuilds `rangeKeyToCacheKey` from the cache: for every cache entry, each
 * of its ranges that is also active (in `hiddeDecorationsRanges`) maps its
 * range key to the entry's cache key.
 */
export const rebuildRangeKeyMap = (
  state: Pick<DocumentStore, 'decorationCache' | 'hiddeDecorationsRanges'>,
): Map<string, string> => {
  const map = new Map<string, string>();
  for (const [key, entry] of state.decorationCache.entries()) {
    for (const existingRange of entry.ranges) {
      if (state.hiddeDecorationsRanges.has(existingRange)) {
        map.set(rangeKey(existingRange), key);
      }
    }
  }
  return map;
};

/** Maintains the range->key map while shifting a set by a delta (per range). */
export const shiftKeyMapForSet = (
  map: Map<string, string>,
  set: Set<Range>,
  shift: (r: Range) => Range,
): void => {
  for (const r of set) {
    const k = rangeKey(r);
    const key = map.get(k);
    if (key !== undefined) {
      map.delete(k);
      map.set(rangeKey(shift(r)), key);
    }
  }
};

/** Removes the given ranges' keys from the range->key map. */
export const keyMapRemove = (map: Map<string, string>, ranges: Iterable<Range>): void => {
  for (const r of ranges) map.delete(rangeKey(r));
};
