/**
 * Exercise — Memory + Closures + Leaks (Node.js)
 * Run: node --expose-gc src/exercise-memory-closures.js
 *
 * Goal:
 * - Understand why closures keep data alive.
 * - Detect leaks caused by unintended references.
 * - Learn when WeakMap/WeakRef help (and when they don't).
 *
 * Note:
 * - This is a learning lab, not a benchmark.
 * - Memory numbers vary across machines, but the trends should be consistent.
 */

const log = console.log;

function mem(label) {
  const { heapUsed, heapTotal, rss } = process.memoryUsage();
  const mb = (n) => `${Math.round((n / 1024 / 1024) * 10) / 10}MB`;
  log(
    `${label} | heapUsed=${mb(heapUsed)} heapTotal=${mb(heapTotal)} rss=${mb(rss)}`,
  );
}

function forceGC() {
  if (typeof global.gc !== "function") {
    throw new Error(
      "GC not exposed. Run: node --expose-gc src/exercise-memory-closures.js",
    );
  }
  global.gc();
}

function makeBigString(sizeMB) {
  // Create a large string to occupy memory.
  // Strings may be internally optimized, but repeated content still costs heap.
  const chunk = "x".repeat(1024 * 1024);
  let s = "";
  for (let i = 0; i < sizeMB; i++) s += chunk;
  return s;
}

/**
 * Part A — Closure retains memory
 *
 * A closure holds references to variables in its lexical environment.
 * If that environment includes a large object, it stays alive as long as the closure is reachable.
 */
function partA_closureRetains() {
  log("\n--- Part A: closure retains memory ---");
  forceGC();
  mem("A0 (baseline)");

  let fn;

  {
    const big = makeBigString(30); // ~30MB
    fn = () => big.length; // closure captures `big`
  }

  forceGC();
  mem("A1 (after scope ends, closure still holds big)");

  // Use fn so the optimizer doesn't trivially discard it.
  log("A2 (fn result):", fn());

  // Drop the last reference to the closure -> big becomes collectible.
  fn = null;

  forceGC();
  mem("A3 (after dropping closure reference)");
}

/**
 * Part B — Accidental leak via global cache
 *
 * Common real-world pattern:
 * - You cache per-request/per-user objects in a Map
 * - You forget to delete them
 * Result: memory grows unbounded.
 */
function partB_globalMapLeak() {
  log("\n--- Part B: Map cache leak ---");
  forceGC();
  mem("B0 (baseline)");

  const cache = new Map();

  for (let i = 0; i < 200; i++) {
    const key = { id: i };
    const big = makeBigString(1); // ~1MB each
    cache.set(key, big);
  }

  forceGC();
  mem("B1 (after filling Map with ~200MB references)");

  // Even if keys go out of scope, Map keeps them strongly referenced.
  // Clearing the Map releases all references.
  cache.clear();

  forceGC();
  mem("B2 (after clearing Map)");
}

/**
 * Part C — WeakMap avoids key retention
 *
 * WeakMap keys are weakly held:
 * - If there are no other references to the key object, it can be GC'd,
 *   and the WeakMap entry disappears.
 *
 * Important:
 * - WeakMap is NOT about freeing the value if something else references it.
 * - It simply prevents the map from keeping keys alive.
 */
function partC_weakMap() {
  log("\n--- Part C: WeakMap behavior ---");
  forceGC();
  mem("C0 (baseline)");

  const wm = new WeakMap();
  let key = { id: 1 };

  wm.set(key, makeBigString(20)); // ~20MB

  forceGC();
  mem("C1 (after setting WeakMap entry)");

  // Drop the key reference. Now the entry is eligible for GC.
  key = null;

  forceGC();
  mem("C2 (after dropping key reference)");
  log(
    "C3:",
    "WeakMap entries are not enumerable, so you cannot 'count' them directly.",
  );
}

/**
 * Part D — Classic leak: event listeners never removed
 *
 * If you add listeners to a long-lived emitter and never remove them,
 * listener closures keep captured data alive.
 */
function partD_listenerLeak() {
  log("\n--- Part D: Event listener leak pattern ---");
  forceGC();
  mem("D0 (baseline)");

  const { EventEmitter } = require("node:events");
  const emitter = new EventEmitter();

  function addLeakyListener(i) {
    const big = makeBigString(2); // ~2MB
    const handler = () => big.length; // captures big
    emitter.on("tick", handler);

    // Return cleanup to show the correct pattern.
    return () => emitter.off("tick", handler);
  }

  const cleanups = [];
  for (let i = 0; i < 50; i++) cleanups.push(addLeakyListener(i));

  forceGC();
  mem("D1 (after adding 50 listeners capturing ~100MB)");

  // Correct fix: remove listeners to release closures and captured memory.
  for (const c of cleanups) c();

  forceGC();
  mem("D2 (after removing listeners)");
}

/**
 * Part E — WeakRef (advanced) and why it is tricky
 *
 * WeakRef can point to an object without preventing GC, but:
 * - It is non-deterministic when GC happens.
 * - It is easy to misuse.
 * - Prefer explicit lifecycle management first.
 */
function partE_weakRef() {
  log("\n--- Part E: WeakRef basics (careful) ---");
  forceGC();
  mem("E0 (baseline)");

  let obj = { payload: makeBigString(10) };
  const ref = new WeakRef(obj);

  forceGC();
  mem("E1 (after creating WeakRef)");

  obj = null; // only weakly referenced now

  forceGC();
  mem("E2 (after dropping strong reference)");

  // Might be undefined if GC collected it; might still exist if not collected yet.
  const deref = ref.deref();
  log("E3 deref:", deref ? "alive (for now)" : "collected");
}

/**
 * Main
 */
(function main() {
  log("Exercise: Memory + Closures + Leaks — start");

  partA_closureRetains();
  partB_globalMapLeak();
  partC_weakMap();
  partD_listenerLeak();
  partE_weakRef();

  log("\nExercise: Memory + Closures + Leaks — done");

  log("\nYour tasks:");
  log("1) Explain why Part A keeps memory after the block ends.");
  log("2) Explain why Map leaks but WeakMap helps (what exactly is weak?).");
  log("3) Identify the real-world equivalent of Part D in frontend apps.");
  log("4) Write a short rule-of-thumb: when NOT to use WeakRef.");
})();
