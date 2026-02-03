/**
 * Exercise — Virtualized List (range calculation)
 * Run: node src/exercise-virtual-list.js
 */

const log = console.log;

/**
 * Given:
 * - itemHeights: array of heights (variable)
 * - scrollTop: px
 * - viewportHeight: px
 * - overscan: extra items before/after
 *
 * Output:
 * - { startIndex, endIndex, offsetTop } where:
 *   - startIndex..endIndex are inclusive indices to render
 *   - offsetTop is px to translate the rendered window
 */

function prefixSums(arr) {
  const ps = new Array(arr.length + 1);
  ps[0] = 0;
  for (let i = 0; i < arr.length; i++) ps[i + 1] = ps[i] + arr[i];
  return ps;
}

function lowerBoundPrefix(prefix, value) {
  // Smallest i such that prefix[i] >= value
  let lo = 0;
  let hi = prefix.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (prefix[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function getRange({ itemHeights, scrollTop, viewportHeight, overscan = 2 }) {
  const prefix = prefixSums(itemHeights);
  const totalHeight = prefix[prefix.length - 1];

  const top = Math.max(0, Math.min(scrollTop, totalHeight));
  const bottom = Math.min(totalHeight, top + viewportHeight);

  // start: first item whose bottom >= top
  const start = Math.max(0, lowerBoundPrefix(prefix, top) - 1);

  // end: last item whose top <= bottom
  const end = Math.min(
    itemHeights.length - 1,
    lowerBoundPrefix(prefix, bottom) - 1,
  );

  const startIndex = Math.max(0, start - overscan);
  const endIndex = Math.min(itemHeights.length - 1, end + overscan);

  const offsetTop = prefix[startIndex];

  return { startIndex, endIndex, offsetTop, totalHeight };
}

// ---------------- Demo ----------------
(function main() {
  log("Exercise: Virtualized List — start");

  const itemHeights = Array.from({ length: 40 }, (_, i) =>
    i % 5 === 0 ? 48 : 24,
  );
  const viewportHeight = 120;

  for (const scrollTop of [0, 30, 90, 180, 420]) {
    const r = getRange({ itemHeights, scrollTop, viewportHeight, overscan: 2 });
    log(`scrollTop=${scrollTop} ->`, r);
  }

  log("Exercise: Virtualized List — done");

  /**
   * Your tasks:
   * 1) Add "scroll anchoring" for prepend:
   *    - when items are inserted at the top, compute new scrollTop to keep same item visible.
   * 2) Add an API to update a single item height and keep prefix sums updated efficiently.
   * 3) Add fixed-height fast path (O(1) range calc).
   */
})();
