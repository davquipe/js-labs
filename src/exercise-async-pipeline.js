/**
 * Exercise — Async Pipeline (async iterators, backpressure)
 * Run: node src/exercise-async-pipeline.js
 */

const log = console.log;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function* source(count) {
  for (let i = 0; i < count; i++) {
    await sleep(20);
    yield i;
  }
}

function mapAsync(mapper) {
  return async function* (iter) {
    for await (const x of iter) {
      yield await mapper(x);
    }
  };
}

function filterAsync(pred) {
  return async function* (iter) {
    for await (const x of iter) {
      if (await pred(x)) yield x;
    }
  };
}

function take(n) {
  return async function* (iter) {
    let i = 0;
    for await (const x of iter) {
      yield x;
      i++;
      if (i >= n) return;
    }
  };
}

function pipe(iterable, ...ops) {
  return ops.reduce((it, op) => op(it), iterable);
}

async function collect(iterable) {
  const out = [];
  for await (const x of iterable) out.push(x);
  return out;
}

// ---------------- Demo ----------------
(async function main() {
  log("Exercise: Async Pipeline — start");

  const flow = pipe(
    source(50),
    mapAsync(async (x) => {
      await sleep(10);
      return x * 2;
    }),
    filterAsync(async (x) => x % 4 === 0),
    take(8),
  );

  const result = await collect(flow);
  log("result:", result);

  log("Exercise: Async Pipeline — done");

  /**
   * Your tasks:
   * 1) Add mergeMap(concurrency, mapper):
   *    - process items concurrently
   *    - preserve input order OR not (choose policy and document)
   * 2) Add catchError(handler) operator (like Rx):
   *    - if upstream throws, replace with a fallback iterable
   * 3) Add buffer(count) operator (then compare memory vs no-buffer).
   */
})();
