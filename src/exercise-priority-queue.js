/**
 * Exercise — Priority Task Queue (concurrency + fairness)
 * Run: node src/exercise-priority-queue.js
 */

const log = console.log;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const Priority = Object.freeze({
  high: 0,
  normal: 1,
  low: 2,
});

function createTaskQueue({ concurrency = 2, agingMs = 200 } = {}) {
  let running = 0;
  let idSeq = 1;

  // Each entry: { id, priority, enqueuedAt, run, resolve, reject, canceled }
  const q = [];

  function pickNextIndex() {
    if (q.length === 0) return -1;

    const now = Date.now();

    // Aging: tasks waiting too long get boosted (prevents starvation).
    // Effective priority is lowered (towards high=0).
    let bestIdx = 0;
    let bestScore = score(q[0], now);

    for (let i = 1; i < q.length; i++) {
      const s = score(q[i], now);
      if (s < bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }
    return bestIdx;

    function score(item, now) {
      const waited = now - item.enqueuedAt;
      const boost = Math.floor(waited / agingMs); // every agingMs, priority improves by 1
      return Math.max(0, item.priority - boost);
    }
  }

  function pump() {
    while (running < concurrency) {
      const idx = pickNextIndex();
      if (idx === -1) return;

      const item = q.splice(idx, 1)[0];
      if (item.canceled) continue;

      running += 1;

      Promise.resolve()
        .then(() => item.run())
        .then(item.resolve, item.reject)
        .finally(() => {
          running -= 1;
          pump();
        });
    }
  }

  function enqueue(run, { priority = Priority.normal } = {}) {
    const id = idSeq++;
    let cancel;

    const p = new Promise((resolve, reject) => {
      const item = {
        id,
        priority,
        enqueuedAt: Date.now(),
        run,
        resolve,
        reject,
        canceled: false,
      };

      cancel = () => {
        item.canceled = true;
        const err = new Error("Canceled");
        err.name = "CancelError";
        reject(err);
      };

      q.push(item);
      pump();
    });

    return { id, promise: p, cancel };
  }

  return { enqueue, Priority, stats: () => ({ queued: q.length, running }) };
}

// ---------------- Demo ----------------
(async function main() {
  log("Exercise: Priority Task Queue — start");

  const queue = createTaskQueue({ concurrency: 2, agingMs: 150 });

  function job(name, ms) {
    return async () => {
      log(`[job ${name}] start`);
      await sleep(ms);
      log(`[job ${name}] done`);
      return name;
    };
  }

  queue.enqueue(job("L1", 250), { priority: Priority.low });
  queue.enqueue(job("L2", 250), { priority: Priority.low });
  queue.enqueue(job("N1", 150), { priority: Priority.normal });

  // High priority arrives later; should preempt on next scheduling opportunity.
  setTimeout(() => {
    queue.enqueue(job("H1", 80), { priority: Priority.high });
  }, 40);

  // Show aging: a low job waiting long should eventually run even if highs keep coming.
  let burst = 0;
  const t = setInterval(() => {
    burst++;
    queue.enqueue(job(`HB${burst}`, 40), { priority: Priority.high });
    if (burst >= 5) clearInterval(t);
  }, 60);

  // Keep alive
  await sleep(1200);

  log("Exercise: Priority Task Queue — done");

  /**
   * Your tasks:
   * 1) Add "pause/resume" (pump should stop when paused).
   * 2) Add per-priority concurrency caps (e.g. high=2 normal=1 low=1).
   * 3) Add "enqueueBatch" that preserves insertion order for equal priority.
   */
})();
