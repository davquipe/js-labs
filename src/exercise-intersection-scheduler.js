/**
 * Exercise — Intersection-like Scheduler (batch + debounce)
 * Run: node src/exercise-intersection-scheduler.js
 */

const log = console.log;

/**
 * We simulate "entries" (elementId -> isVisible).
 * Changes are batched and delivered at most once per frame window.
 */

function createIntersectionScheduler({ debounceMs = 16 } = {}) {
  const state = new Map(); // id -> { visible, ratio }
  const pending = new Map(); // id -> latest entry
  const listeners = new Set();

  let timer = null;

  function emitBatch() {
    timer = null;
    if (pending.size === 0) return;

    const batch = Array.from(pending.values());
    pending.clear();

    for (const cb of listeners) cb(batch);
  }

  function scheduleFlush() {
    if (timer) return;
    timer = setTimeout(emitBatch, debounceMs);
  }

  function observe(id, cb) {
    listeners.add(cb);
    if (!state.has(id)) state.set(id, { id, visible: false, ratio: 0 });
    return () => listeners.delete(cb);
  }

  function setVisibility(id, { visible, ratio = visible ? 1 : 0 }) {
    const prev = state.get(id) ?? { id, visible: false, ratio: 0 };
    const next = { id, visible, ratio };

    state.set(id, next);

    // Only enqueue if something actually changed.
    if (prev.visible !== next.visible || prev.ratio !== next.ratio) {
      pending.set(id, next);
      scheduleFlush();
    }
  }

  return { observe, setVisibility };
}

// ---------------- Demo ----------------
(function main() {
  log("Exercise: Intersection Scheduler — start");

  const io = createIntersectionScheduler({ debounceMs: 30 });

  const unsub = io.observe("A", (entries) => {
    log(
      "[batch]",
      entries
        .map((e) => `${e.id}:${e.visible ? "in" : "out"}@${e.ratio}`)
        .join(" "),
    );
  });

  // Rapid changes: should be batched.
  io.setVisibility("A", { visible: true, ratio: 0.3 });
  io.setVisibility("A", { visible: true, ratio: 0.8 });
  io.setVisibility("A", { visible: false, ratio: 0 });

  setTimeout(() => {
    io.setVisibility("A", { visible: true, ratio: 1 });
  }, 40);

  setTimeout(() => {
    unsub();
    log("Exercise: Intersection Scheduler — done");
  }, 120);

  /**
   * Your tasks:
   * 1) Add threshold support: callback only when ratio crosses thresholds.
   * 2) Add per-id observers: different callbacks per observed element.
   * 3) Add "flushNow()" to force immediate delivery (useful for tests).
   */
})();
