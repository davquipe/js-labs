/**
 * Exercise — Retry with Exponential Backoff + Jitter + Abort
 * Run: node src/exercise-retry-backoff-jitter.js
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

/**
 * Uniform random jitter between [min, max] inclusive.
 */
function randInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/**
 * Backoff strategy:
 * - attempt 0 => base
 * - attempt 1 => base * factor
 * - attempt 2 => base * factor^2
 * - ... capped at maxDelay
 *
 * Jitter:
 * - spreads retries to avoid "thundering herd"
 */
function computeDelayMs(attempt, { baseMs, factor, maxDelayMs, jitterPct }) {
  const exp = baseMs * Math.pow(factor, attempt);
  const capped = Math.min(exp, maxDelayMs);

  const jitter = Math.round(capped * jitterPct);
  const min = Math.max(0, capped - jitter);
  const max = capped + jitter;

  return randInt(min, max);
}

/**
 * Retry wrapper.
 *
 * - Retries only if `shouldRetry(error)` is true.
 * - Honors AbortSignal.
 * - Exposes attempt count and next delay through hooks.
 */
async function retry(fn, options) {
  const {
    retries,
    baseMs = 100,
    factor = 2,
    maxDelayMs = 2000,
    jitterPct = 0.2,
    signal,
    shouldRetry = () => true,
    onAttempt,
    onRetry,
  } = options;

  let attempt = 0;

  while (true) {
    if (signal?.aborted) throw abortError(signal.reason);

    try {
      onAttempt?.(attempt);
      return await fn(attempt);
    } catch (err) {
      if (signal?.aborted) throw abortError(signal.reason);

      const canRetry = attempt < retries && shouldRetry(err);

      if (!canRetry) throw err;

      const delayMs = computeDelayMs(attempt, {
        baseMs,
        factor,
        maxDelayMs,
        jitterPct,
      });
      onRetry?.(attempt, err, delayMs);

      await sleep(delayMs, { signal });
      attempt += 1;
    }
  }
}

// -----------------------
// Demo "unstable" operation
// -----------------------

/**
 * Simulates a flaky operation:
 * - Fails with a "TransientError" for the first N attempts
 * - Then succeeds
 * You can treat TransientError as retryable.
 */
function makeFlakyOperation({ failCount }) {
  let calls = 0;

  return async function op(attempt) {
    await sleep(30); // small work time

    if (calls < failCount) {
      calls += 1;
      const err = new Error(`temporary failure (call ${calls})`);
      err.name = "TransientError";
      throw err;
    }

    return `OK (after ${calls} failures, attempt=${attempt})`;
  };
}

(async function main() {
  log("Exercise: Retry + Backoff + Jitter + Abort — start");

  const controller = new AbortController();
  const { signal } = controller;

  // Abort to test clean shutdown (optional). Comment to let it succeed.
  // setTimeout(() => controller.abort("Abort demo"), 700);

  const op = makeFlakyOperation({ failCount: 3 });

  try {
    const result = await retry(op, {
      retries: 5,
      baseMs: 80,
      factor: 2,
      maxDelayMs: 1000,
      jitterPct: 0.25,
      signal,
      shouldRetry: (err) => err?.name === "TransientError",
      onAttempt: (attempt) => log(`[attempt ${attempt}] start`),
      onRetry: (attempt, err, delay) =>
        log(`[attempt ${attempt}] retryable ${err.name}: waiting ${delay}ms`),
    });

    log("Result:", result);
  } catch (err) {
    if (err?.name === "AbortError") {
      log(`[main] aborted: ${err.message}`);
    } else {
      log(`[main] error: ${err.name} ${err.message}`);
      process.exitCode = 1;
    }
  }

  log("Exercise: Retry + Backoff + Jitter + Abort — done");
})();

/**
 * Your tasks:
 * 1) Implement a "max total time" budget (e.g. 1500ms) that stops retries.
 * 2) Add "Retry-After" support: if err.retryAfterMs exists, prefer it over backoff.
 * 3) Add a small idempotency guard:
 *    - `fn` receives an idempotencyKey
 *    - ensure "success" is returned only once even if fn is accidentally called twice
 */
