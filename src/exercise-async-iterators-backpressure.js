/**
 * Exercise — Async Iterators + Backpressure + Abort
 * Run: node src/exercise-async-iterators-backpressure.js
 */

const log = console.log;

function abortError(reason) {
  const err = new Error(reason ? String(reason) : "Aborted");
  err.name = "AbortError";
  return err;
}

function sleep(ms, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError(signal.reason));

    const onAbort = () => {
      clearTimeout(id);
      cleanup();
      reject(abortError(signal.reason));
    };

    const cleanup = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
    };

    const id = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}

// Producer: no buffering; yields only when consumer requests next (backpressure).
async function* tickStream({ intervalMs, signal }) {
  let i = 0;
  while (true) {
    if (signal?.aborted) return;
    await sleep(intervalMs, { signal });
    yield { id: i++, at: Date.now() };
  }
}

/**
 * Consumer with:
 * - concurrency limit
 * - explicit iterator close
 * - safe draining of in-flight work
 */
async function consumeWithConcurrency(
  iterable,
  { concurrency, signal },
  handler,
) {
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error("concurrency must be a positive integer");
  }

  const iterator = iterable[Symbol.asyncIterator]();
  const inFlight = new Set();

  const startJob = (item) => {
    const p = Promise.resolve().then(() => handler(item));
    p.finally(() => inFlight.delete(p));
    inFlight.add(p);
    return p;
  };

  try {
    while (true) {
      if (signal?.aborted) throw abortError(signal.reason);

      const { value, done } = await iterator.next(); // pulls one item only when needed
      if (done) break;

      startJob(value);

      if (inFlight.size >= concurrency) {
        await Promise.race(inFlight); // throws if the earliest completion rejects
      }
    }
  } catch (err) {
    if (err?.name !== "AbortError") throw err;
  } finally {
    // Stop the producer immediately (cancels any pending sleep inside the generator).
    if (typeof iterator.return === "function") {
      try {
        await iterator.return();
      } catch {
        // Ignore close errors; we're shutting down.
      }
    }

    // Observe all results to prevent unhandled rejections (AbortError included).
    await Promise.allSettled(inFlight);
  }
}

async function processItem(item, { signal } = {}) {
  const cost = item.id % 3 === 0 ? 80 : 30;
  log(`[handler] start id=${item.id} cost=${cost}ms`);
  await sleep(cost, { signal });
  log(`[handler] done  id=${item.id}`);
}

(async function main() {
  log("Exercise: Async Iterators + Backpressure + Abort — start");

  const controller = new AbortController();
  const { signal } = controller;

  // Keep the timer id so we can clear it when we're done.
  const abortTimer = setTimeout(() => {
    controller.abort("Stop after demo window");
  }, 600);

  try {
    const stream = tickStream({ intervalMs: 40, signal });

    await consumeWithConcurrency(stream, { concurrency: 3, signal }, (item) =>
      processItem(item, { signal }),
    );
  } finally {
    // Prevent abort from firing after we've already finished.
    clearTimeout(abortTimer);
  }

  log("Exercise: Async Iterators + Backpressure + Abort — done");
})();
