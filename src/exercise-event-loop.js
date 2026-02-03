/**
 * Exercise — Event Loop (Node.js)
 *
 * Run:
 *   node src/exercise-event-loop.js
 *
 * What you will learn (by reading + running):
 * - Synchronous code runs first (call stack).
 * - Node drains `process.nextTick` BEFORE other microtasks.
 * - Microtasks (Promise.then, queueMicrotask, async/await continuations) drain next.
 * - Then the event loop continues with macrotasks (setTimeout) and check phase (setImmediate).
 * - After EACH macrotask callback, Node drains nextTick first, then microtasks again.
 *
 * Notes:
 * - This file avoids I/O to keep the ordering deterministic.
 * - Do not add fs/network callbacks yet; they introduce extra phases (poll) and may change ordering.
 */

function log(msg) {
  console.log(msg);
}

log("0) sync: start");

/**
 * SECTION A — Scheduling from synchronous code
 */

// Node-specific queue with higher priority than standard microtasks.
process.nextTick(() => log("1) nextTick: A"));

// Standard microtask: Promise.then
Promise.resolve().then(() => log("2) microtask: Promise.then B"));

// Standard microtask: queueMicrotask
queueMicrotask(() => log("3) microtask: queueMicrotask C"));

/**
 * SECTION B — async/await nuance
 *
 * The continuation after `await` is a microtask.
 * Even `await null` yields (it behaves like awaiting a resolved Promise).
 */
async function asyncSection() {
  log("4) sync: asyncSection start");

  process.nextTick(() => log("5) nextTick: inside asyncSection before await"));

  await null;

  // This runs as a microtask continuation.
  log("6) microtask: asyncSection after await");
}

asyncSection();

/**
 * SECTION C — Macrotasks and nested scheduling
 *
 * setTimeout runs in the "timers" phase (macrotask).
 * setImmediate runs in the "check" phase (also macrotask, but different phase).
 */
setTimeout(() => {
  log("7) timer: setTimeout D (start)");

  // After this timer callback completes, Node will drain nextTick then microtasks.
  process.nextTick(() => log("8) nextTick: inside timer D"));

  Promise.resolve().then(() => {
    log("9) microtask: Promise.then inside timer D");

    /**
     * Microtask scheduling another microtask:
     * The new microtask is appended and still runs in the SAME microtask drain cycle.
     */
    queueMicrotask(() =>
      log("10) microtask: nested queueMicrotask (created by microtask)"),
    );
  });

  setImmediate(() => log("13) immediate: setImmediate inside timer D"));

  setTimeout(
    () => log("14) timer: nested setTimeout (created inside timer D)"),
    0,
  );

  log("11) timer: setTimeout D (end)");
}, 0);

setImmediate(() => {
  log("12) immediate: E");

  // After this immediate callback completes, Node drains nextTick then microtasks again.
  process.nextTick(() => log("12.1) nextTick: inside immediate E"));
  Promise.resolve().then(() => log("12.2) microtask: inside immediate E"));
});

log("0.1) sync: end");

/**
 * EXPECTED ORDER (read this AFTER you attempt your own prediction):
 *
 * Sync (call stack):
 *   0) sync: start
 *   4) sync: asyncSection start
 *   0.1) sync: end
 *
 * Drain nextTick queue:
 *   1) nextTick: A
 *   5) nextTick: inside asyncSection before await
 *
 * Drain microtask queue:
 *   2) microtask: Promise.then B
 *   3) microtask: queueMicrotask C
 *   6) microtask: asyncSection after await
 *
 * Timers phase (setTimeout):
 *   7) timer: setTimeout D (start)
 *   11) timer: setTimeout D (end)
 *   (drain nextTick, then microtasks)
 *   8) nextTick: inside timer D
 *   9) microtask: Promise.then inside timer D
 *   10) microtask: nested queueMicrotask (created by microtask)
 *
 * Check phase (setImmediate):
 *   12) immediate: E
 *   (drain nextTick, then microtasks)
 *   12.1) nextTick: inside immediate E
 *   12.2) microtask: inside immediate E
 *   13) immediate: setImmediate inside timer D
 *
 * Next timers tick:
 *   14) timer: nested setTimeout (created inside timer D)
 *
 * Reminder:
 * - `setTimeout(0)` vs `setImmediate` ordering can differ in I/O-heavy contexts.
 * - This exercise is designed to be stable without I/O.
 */
