/**
 * Searching.
 *
 * Linear search checks every item in turn: O(n). It works on any array and is
 * what the "Search places" box uses, because it matches text anywhere in a record.
 *
 * Binary search halves a sorted array on every step: O(log n). The site uses it
 * on distance-sorted places to find where "within a 5 minute walk" stops.
 *
 * Every function also counts its comparisons so the page can show the work done.
 */

/** Indexes of every item for which `matches(item)` is true. */
export function linearSearch(items, matches) {
  const indexes = [];
  let comparisons = 0;
  for (let i = 0; i < items.length; i += 1) {
    comparisons += 1;
    if (matches(items[i])) indexes[indexes.length] = i;
  }
  return { indexes, comparisons };
}

/**
 * Classic binary search on a sorted array.
 * `compare(item)` returns 0 for a match, a negative number if the target lies to
 * the left of `item`, and a positive number if it lies to the right.
 */
export function binarySearch(sortedItems, compare) {
  let low = 0;
  let high = sortedItems.length - 1;
  const probes = []; // the positions looked at, in order
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    probes[probes.length] = mid;
    const result = compare(sortedItems[mid]);
    if (result === 0) return { index: mid, comparisons: probes.length, probes };
    if (result < 0) high = mid - 1;
    else low = mid + 1;
  }
  return { index: -1, comparisons: probes.length, probes };
}

/**
 * Upper bound: how many items at the front of a sorted array have a key that is
 * less than or equal to `limit`. Used for "everything within N metres".
 */
export function upperBound(sortedItems, limit, keyOf) {
  let low = 0;
  let high = sortedItems.length;
  const probes = []; // the positions looked at, in order
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    probes[probes.length] = mid;
    if (keyOf(sortedItems[mid]) <= limit) low = mid + 1;
    else high = mid;
  }
  return { index: low, comparisons: probes.length, probes };
}
