/**
 * Exercise — VDOM List Diff with Keys (moves + inserts + deletes)
 * Run: node src/exercise-vdom-diff-keys.js
 */

const log = console.log;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * We will diff two arrays of keyed "virtual nodes".
 * Output is a list of operations describing how to transform `prev` into `next`.
 *
 * Node shape:
 * { key: string, value: any }
 *
 * Ops:
 * - { type: "insert", key, at }
 * - { type: "remove", key, at }
 * - { type: "move", key, from, to }
 * - { type: "update", key, at }   (same key, different value)
 *
 * Simplification:
 * - We do not model DOM patches; we only emit structural operations.
 * - This is about the algorithmic core used by UI frameworks.
 */

function indexByKey(list) {
  const map = new Map();
  for (let i = 0; i < list.length; i++) map.set(list[i].key, i);
  return map;
}

/**
 * Strategy:
 * 1) Remove keys not present in `next`.
 * 2) Insert keys not present in `prev`.
 * 3) For shared keys, compute move operations using LIS (Longest Increasing Subsequence)
 *    over the previous indices in next-order:
 *    - Keys already in increasing order do not need to move.
 *    - Others must be moved.
 *
 * This mirrors the approach used by modern renderers (conceptually).
 */

function lisIndices(arr) {
  // Returns indices (positions in arr) that form a Longest Increasing Subsequence.
  // O(n log n)
  const n = arr.length;
  const prev = new Array(n).fill(-1);
  const tails = []; // stores indices of best tail for length k+1

  for (let i = 0; i < n; i++) {
    const x = arr[i];
    if (x < 0) continue; // ignore missing items

    let lo = 0;
    let hi = tails.length;

    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[tails[mid]] < x) lo = mid + 1;
      else hi = mid;
    }

    if (lo > 0) prev[i] = tails[lo - 1];
    if (lo === tails.length) tails.push(i);
    else tails[lo] = i;
  }

  // Reconstruct LIS positions
  const out = [];
  let k = tails.length ? tails[tails.length - 1] : -1;
  while (k !== -1) {
    out.push(k);
    k = prev[k];
  }
  out.reverse();
  return out;
}

function diffKeyedList(prev, next) {
  const ops = [];

  const prevIndex = indexByKey(prev);
  const nextIndex = indexByKey(next);

  // 1) removals (from end to start to keep indices stable)
  for (let i = prev.length - 1; i >= 0; i--) {
    const key = prev[i].key;
    if (!nextIndex.has(key)) ops.push({ type: "remove", key, at: i });
  }

  // 2) inserts
  for (let i = 0; i < next.length; i++) {
    const key = next[i].key;
    if (!prevIndex.has(key)) ops.push({ type: "insert", key, at: i });
  }

  // 3) updates + moves for shared keys
  const sharedKeysInNextOrder = [];
  const prevPositions = [];

  for (let i = 0; i < next.length; i++) {
    const key = next[i].key;
    if (prevIndex.has(key)) {
      sharedKeysInNextOrder.push(key);
      prevPositions.push(prevIndex.get(key));
      if (!Object.is(prev[prevIndex.get(key)].value, next[i].value)) {
        ops.push({ type: "update", key, at: i });
      }
    }
  }

  // If prevPositions is already increasing, no moves needed.
  // Otherwise, keep LIS items in place; move the rest.
  const lisPos = new Set(lisIndices(prevPositions));

  // We'll compute moves by iterating from end to start (like many renderers do),
  // so that "to" indices refer to the final desired positions.
  for (let i = sharedKeysInNextOrder.length - 1; i >= 0; i--) {
    if (lisPos.has(i)) continue;

    const key = sharedKeysInNextOrder[i];
    const from = prevIndex.get(key);
    const to = nextIndex.get(key);

    ops.push({ type: "move", key, from, to });
  }

  return ops;
}

// ------------------------
// Demo cases
// ------------------------

function runCase(name, prev, next) {
  log(`\n--- ${name} ---`);
  log("prev:", prev.map((n) => n.key).join(" "));
  log("next:", next.map((n) => n.key).join(" "));
  const ops = diffKeyedList(prev, next);
  for (const op of ops) log(op);
}

const prev1 = [
  { key: "a", value: 1 },
  { key: "b", value: 2 },
  { key: "c", value: 3 },
  { key: "d", value: 4 },
];

const next1 = [
  { key: "b", value: 2 },
  { key: "a", value: 1 },
  { key: "d", value: 40 }, // update
  { key: "c", value: 3 },
];

const prev2 = [
  { key: "a", value: "A" },
  { key: "b", value: "B" },
  { key: "c", value: "C" },
];

const next2 = [
  { key: "b", value: "B" },
  { key: "x", value: "X" }, // insert
  { key: "c", value: "C" },
  // remove "a"
];

runCase("Case 1: moves + update", prev1, next1);
runCase("Case 2: insert + remove", prev2, next2);

/**
 * Your tasks:
 * 1) Implement applyOps(prevKeys, ops) that simulates the transformation and returns nextKeys.
 * 2) Add a validation step: assert applyOps(prev, ops) equals next (keys order).
 * 3) Edge case: duplicate keys — detect and throw an error.
 * 4) Explain (in a short comment) why LIS reduces the number of moves.
 */
