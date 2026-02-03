/**
 * Exercise — Cooperative Scheduler (priorities + yielding)
 * Run: node src/exercise-scheduler-yielding.js
 */

const log = console.log;

function nowMs() {
  return performance.now();
}

function sleep0() {
  return new Promise((r) => setTimeout(r, 0));
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Goal:
 * - Build a scheduler that runs tasks without blocking the event loop.
 * - Tasks can yield cooperatively (time slicing).
 * - Higher priority tasks should preempt lower priority tasks on the next tick.
 *
 * Task API:
 * scheduleTask(priority, work) => returns taskId
 *
 * work(deadline) => boolean
 * - Returns true if more work remains (reschedule)
 * - Returns false when done
 *
 * deadline.timeRemaining() => ms remaining in this slice
 */

const Priority = Object.freeze({
  immediate: 0,
  userBlocking: 1,
  normal: 2,
  low: 3,
});

function createScheduler({ sliceMs = 8 } = {}) {
  let taskIdSeq = 1;
  const queues = new Map([
    [Priority.immediate, []],
    [Priority.userBlocking, []],
    [Priority.normal, []],
    [Priority.low, []],
  ]);

  let isFlushing = false;

  function pushTask(priority, task) {
    queues.get(priority).push(task);
  }

  function popNextTask() {
    // Always take the highest priority queue with work.
    for (const p of [
      Priority.immediate,
      Priority.userBlocking,
      Priority.normal,
      Priority.low,
    ]) {
      const q = queues.get(p);
      if (q.length) return q.shift();
    }
    return null;
  }

  function hasWork() {
    for (const q of queues.values()) if (q.length) return true;
    return false;
  }

  function makeDeadline(start) {
    return {
      timeRemaining() {
        const elapsed = nowMs() - start;
        return Math.max(0, sliceMs - elapsed);
      },
    };
  }

  async function flush() {
    if (isFlushing) return;
    isFlushing = true;

    try {
      while (hasWork()) {
        const start = nowMs();
        const deadline = makeDeadline(start);

        // Run tasks until we run out of slice.
        while (deadline.timeRemaining() > 0) {
          const task = popNextTask();
          if (!task) break;

          const more = task.work(deadline);

          if (more) {
            // If task yields, requeue at same priority.
            pushTask(task.priority, task);
          }
        }

        // Yield back to event loop so timers/I/O can run.
        await sleep0();
      }
    } finally {
      isFlushing = false;
    }
  }

  function scheduleTask(priority, work) {
    invariant(typeof work === "function", "work must be a function");

    const task = { id: taskIdSeq++, priority, work };
    pushTask(priority, task);
    flush();
    return task.id;
  }

  return { scheduleTask, Priority };
}

// ------------------------
// Demo work: CPU-ish loops that yield
// ------------------------

function makeChunkedWork(name, totalSteps, stepCostMs) {
  let done = 0;

  return (deadline) => {
    const start = nowMs();
    while (done < totalSteps) {
      // Simulate CPU cost per step.
      const t0 = nowMs();
      while (nowMs() - t0 < stepCostMs) {}

      done++;

      if (deadline.timeRemaining() <= 0) {
        log(
          `[${name}] yield at step ${done}/${totalSteps} (ran ${(nowMs() - start).toFixed(1)}ms)`,
        );
        return true;
      }
    }

    log(`[${name}] done (${totalSteps} steps)`);
    return false;
  };
}

(async function main() {
  log("Exercise: Scheduler Yielding — start");

  const { scheduleTask, Priority } = createScheduler({ sliceMs: 8 });

  // Low priority long task.
  scheduleTask(Priority.low, makeChunkedWork("LOW", 40, 0.6));

  // Normal task.
  scheduleTask(Priority.normal, makeChunkedWork("NORMAL", 20, 0.7));

  // After a bit, schedule a high priority task that should preempt on the next tick.
  setTimeout(() => {
    scheduleTask(Priority.userBlocking, makeChunkedWork("USER", 8, 1.0));
  }, 10);

  // Immediate task (highest) scheduled later.
  setTimeout(() => {
    scheduleTask(Priority.immediate, makeChunkedWork("IMMEDIATE", 3, 1.5));
  }, 20);

  // Keep process alive briefly so scheduled timers can enqueue tasks.
  await new Promise((r) => setTimeout(r, 250));

  log("Exercise: Scheduler Yielding — done");
})();

/**
 * Your tasks:
 * 1) Add cancellation:
 *    - scheduleTask returns { id, cancel() }
 *    - canceled tasks should not run or requeue
 * 2) Add aging:
 *    - if a task waits too long, bump its priority (avoid starvation)
 * 3) Add a microtask-based flush option:
 *    - use queueMicrotask instead of setTimeout(0) and observe differences
 */
