/**
 * Exercise — Tiny Query Core (cache + staleTime + dedupe + subscribe)
 * Run: node src/exercise-tiny-query-core.js
 */

const log = console.log;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function createQueryClient() {
  // key -> { data, error, status, updatedAt, promise, subscribers:Set }
  const cache = new Map();

  function getEntry(key) {
    if (!cache.has(key)) {
      cache.set(key, {
        data: undefined,
        error: null,
        status: "idle", // idle | loading | success | error
        updatedAt: 0,
        promise: null,
        subscribers: new Set(),
      });
    }
    return cache.get(key);
  }

  function notify(key) {
    const e = getEntry(key);
    for (const cb of e.subscribers) cb(snapshot(key));
  }

  function snapshot(key) {
    const e = getEntry(key);
    return {
      key,
      data: e.data,
      error: e.error,
      status: e.status,
      updatedAt: e.updatedAt,
    };
  }

  function subscribe(key, cb) {
    const e = getEntry(key);
    e.subscribers.add(cb);
    cb(snapshot(key));
    return () => e.subscribers.delete(cb);
  }

  async function fetchQuery(key, fetcher, { staleTimeMs = 0 } = {}) {
    const e = getEntry(key);
    const now = Date.now();
    const fresh = e.status === "success" && now - e.updatedAt <= staleTimeMs;

    if (fresh) return e.data;

    // Dedup: if a fetch is already in-flight, await the same promise.
    if (e.promise) return e.promise;

    e.status = "loading";
    e.error = null;
    notify(key);

    e.promise = (async () => {
      try {
        const data = await fetcher();
        e.data = data;
        e.status = "success";
        e.updatedAt = Date.now();
        return data;
      } catch (err) {
        e.error = err;
        e.status = "error";
        throw err;
      } finally {
        e.promise = null;
        notify(key);
      }
    })();

    return e.promise;
  }

  function invalidate(key) {
    const e = getEntry(key);
    e.updatedAt = 0;
    notify(key);
  }

  return { fetchQuery, subscribe, snapshot, invalidate };
}

// ---------------- Demo ----------------
(async function main() {
  log("Exercise: Tiny Query Core — start");

  const qc = createQueryClient();

  let calls = 0;
  const fetcher = async () => {
    calls++;
    await sleep(120);
    return { value: `data#${calls}` };
  };

  const unsub = qc.subscribe("metrics", (s) => {
    log(
      `[sub] status=${s.status} updatedAt=${s.updatedAt} data=${s.data?.value ?? "-"}`,
    );
  });

  await qc.fetchQuery("metrics", fetcher, { staleTimeMs: 500 }); // fetch
  await qc.fetchQuery("metrics", fetcher, { staleTimeMs: 500 }); // cached

  // Dedup demo: two concurrent requests share one fetch.
  await Promise.all([
    qc.fetchQuery("metrics", fetcher, { staleTimeMs: 0 }),
    qc.fetchQuery("metrics", fetcher, { staleTimeMs: 0 }),
  ]);

  qc.invalidate("metrics");
  await qc.fetchQuery("metrics", fetcher, { staleTimeMs: 999 });

  unsub();
  log("Exercise: Tiny Query Core — done");

  /**
   * Your tasks:
   * 1) Add cacheTimeMs eviction: remove entry if no subscribers and idle for N ms.
   * 2) Add refetchOnFocus simulation: a function qc.onFocus() that refetches stale queries.
   * 3) Add retry(2) for transient errors only.
   */
})();
