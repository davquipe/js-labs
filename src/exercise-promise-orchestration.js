/**
 * Exercise — Promise Orchestration (Node.js)
 *
 * Run:
 *   node src/exercise-promise-orchestration.js
 *
 * What you will learn:
 * 1) Concurrency primitives:
 *    - Promise.all         (fail-fast, rejects on first rejection)
 *    - Promise.allSettled  (never rejects, returns status for each)
 *    - Promise.race        (settles on first settled promise)
 *    - Promise.any         (resolves on first fulfillment, rejects if all reject)
 *
 * 2) Production-grade pattern:
 *    - Concurrency + timeouts + cancellation (AbortController)
 *    - Preventing "zombie" work (work continuing after it is no longer needed)
 *
 * 3) A senior mistake to avoid:
 *    - Thinking "Promise.all cancels the rest" (it does NOT).
 *
 * Notes:
 * - No network calls. We simulate async work with timers.
 * - Everything is deterministic enough for repeatable learning.
 */

// -----------------------------
// Utilities (deterministic async work)
// -----------------------------

function log(msg) {
  console.log(msg);
}

function sleep(ms, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal.reason));
      return;
    }

    const id = setTimeout(() => resolve(), ms);

    // If aborted, clear timer and reject.
    const onAbort = () => {
      clearTimeout(id);
      reject(abortError(signal.reason));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function abortError(reason) {
  const err = new Error(reason ? String(reason) : "Aborted");
  err.name = "AbortError";
  return err;
}

/**
 * Simulates a task that:
 * - takes `ms` milliseconds
 * - can be aborted
 * - can fail if `shouldFail` is true
 *
 * Important:
 * - This function is "well-behaved": it listens to AbortSignal and stops promptly.
 * - Many real APIs are NOT well-behaved (or partially behave). That’s why you must
 *   design orchestration defensively.
 */
async function task(name, ms, { shouldFail = false, signal } = {}) {
  log(`[task ${name}] scheduled (ms=${ms}, shouldFail=${shouldFail})`);

  try {
    await sleep(ms, { signal });

    if (shouldFail) {
      const err = new Error(`[task ${name}] failed`);
      err.name = "TaskError";
      throw err;
    }

    const value = `[task ${name}] success`;
    log(value);
    return value;
  } catch (err) {
    // Normalize abort output for readability.
    if (err?.name === "AbortError") {
      log(`[task ${name}] aborted (${err.message})`);
    } else {
      log(`[task ${name}] error (${err.name}: ${err.message})`);
    }
    throw err;
  }
}

/**
 * Wraps a promise with a timeout.
 *
 * Key property:
 * - The timeout does NOT cancel the underlying work by itself.
 * - To prevent wasted work, you should abort via AbortController.
 */
function withTimeout(promise, ms, { onTimeout } = {}) {
  let timerId;

  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      onTimeout?.();
      const err = new Error(`Timed out after ${ms}ms`);
      err.name = "TimeoutError";
      reject(err);
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timerId);
  });
}

// -----------------------------
// Part A — Understand combinators
// -----------------------------

async function partA() {
  log("\n--- Part A: Promise combinators ---");

  // A fulfills first, B fulfills later, C rejects.
  const A = task("A", 30);
  const B = task("B", 60);
  const C = task("C", 45, { shouldFail: true });

  // Promise.all: fail-fast (rejects when the first promise rejects).
  // Important: it does NOT cancel the rest.
  try {
    await Promise.all([A, B, C]);
    log("[all] resolved (unexpected)");
  } catch (err) {
    log(`[all] rejected (${err.name}: ${err.message})`);
  }

  // Promise.allSettled: always resolves with statuses.
  const settled = await Promise.allSettled([A, B, C]);
  log("[allSettled] results:");
  for (const r of settled) {
    log(
      `  - ${r.status}${r.status === "rejected" ? ` (${r.reason.name})` : ""}`,
    );
  }

  // Promise.race: first settled wins (fulfillment OR rejection).
  try {
    const winner = await Promise.race([A, B, C]);
    log(`[race] settled with: ${winner}`);
  } catch (err) {
    log(`[race] rejected (${err.name}: ${err.message})`);
  }

  // Promise.any: first fulfillment wins, ignores rejections unless all reject.
  try {
    const firstOk = await Promise.any([C, B]); // C rejects, B fulfills.
    log(`[any] fulfilled with: ${firstOk}`);
  } catch (err) {
    // AggregateError if all reject.
    log(`[any] rejected (${err.name})`);
  }
}

// -----------------------------
// Part B — Orchestrate like an adult (AbortController + timeout)
// -----------------------------

/**
 * Executes tasks concurrently but:
 * - Aborts ALL remaining tasks if:
 *   - any task fails OR
 *   - global timeout triggers
 *
 * Why:
 * - In UIs, you often want "all-or-nothing" results.
 * - If one fails, you may want to stop the rest to save compute and avoid side effects.
 *
 * Design notes:
 * - "Fail-fast" here is REAL fail-fast because we also abort pending tasks.
 * - We use a shared AbortController signal for all tasks.
 */
async function runFailFastWithAbort() {
  log("\n--- Part B: Fail-fast with real cancellation ---");

  const controller = new AbortController();
  const { signal } = controller;

  const work = (async () => {
    // Each task must be wired to the same AbortSignal.
    const p1 = task("P1", 80, { signal });
    const p2 = task("P2", 120, { signal });
    const p3 = task("P3", 60, { shouldFail: true, signal });

    // IMPORTANT:
    // - Promise.all rejects on first rejection
    // - Without abort, other tasks would keep running
    // Here, we catch the first failure and abort the rest immediately.
    try {
      const results = await Promise.all([p1, p2, p3]);
      return results;
    } catch (err) {
      controller.abort(`Stopping remaining tasks due to: ${err.name}`);
      throw err;
    }
  })();

  // Add a global timeout that also aborts everything.
  const guarded = withTimeout(work, 150, {
    onTimeout: () => controller.abort("Global timeout reached"),
  });

  try {
    const results = await guarded;
    log(`[failFast] results: ${JSON.stringify(results)}`);
  } catch (err) {
    log(`[failFast] finished with error: ${err.name} (${err.message})`);
  }
}

// -----------------------------
// Part C — Implement a concurrency limiter (classic senior utility)
// -----------------------------

/**
 * Maps items with a concurrency limit.
 *
 * Typical use cases:
 * - Batch requests (avoid flooding backend)
 * - CPU-heavy transforms (avoid blocking event loop)
 * - File operations
 *
 * Behavior:
 * - Runs up to `limit` mapper calls concurrently.
 * - Preserves result order corresponding to input order.
 * - Rejects if any mapper rejects (and does NOT automatically cancel others).
 *
 * Extension idea:
 * - Add AbortController support to cancel pending work on failure.
 */
async function mapWithConcurrency(items, limit, mapper) {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("limit must be a positive integer");
  }

  const results = new Array(items.length);
  let nextIndex = 0;

  // Worker function: picks the next index and processes it until no work remains.
  async function worker(workerId) {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;

      if (current >= items.length) return;

      log(`[limiter] worker ${workerId} processing index ${current}`);
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    (_, i) => worker(i + 1),
  );

  await Promise.all(workers);
  return results;
}

async function partC() {
  log("\n--- Part C: Concurrency limiter ---");

  const inputs = [40, 10, 30, 20, 50];

  const results = await mapWithConcurrency(inputs, 2, async (ms, i) => {
    await sleep(ms);
    const out = `job#${i}(${ms}ms)`;
    log(`[mapper] done ${out}`);
    return out;
  });

  log(
    `[limiter] final results (input order preserved): ${JSON.stringify(results)}`,
  );
}

// -----------------------------
// Main
// -----------------------------

(async function main() {
  log("Exercise: Promise Orchestration — start");

  await partA();
  await runFailFastWithAbort();
  await partC();

  log("\nExercise: Promise Orchestration — done");
})().catch((err) => {
  // This should not happen often because we catch expected errors in sections,
  // but it's here as a safety net.
  log(`\n[unhandled] ${err.name}: ${err.message}`);
  process.exitCode = 1;
});
