/**
 * Exercise — State Machine with Effects (invoke + cancel)
 * Run: node src/exercise-finite-state-effects.js
 */

const log = console.log;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

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

function toArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

/**
 * Machine adds "invoke" on state:
 * {
 *   invoke?: (ctx, event, { signal, send }) => Promise<void>
 * }
 *
 * Rules:
 * - Entering a state starts its invoke (if present).
 * - Leaving a state aborts its invoke via AbortController.
 * - invoke should call `send(...)` to report RESOLVE/REJECT.
 */

function createMachine(def) {
  invariant(def?.initial, "machine.initial is required");
  invariant(def?.states, "machine.states is required");
  invariant(def.states[def.initial], "initial state must exist");

  const machine = structuredClone(def);

  function getNode(state) {
    const node = machine.states[state];
    invariant(node, `unknown state: ${state}`);
    return node;
  }

  function applyActions(ctx, actions, event) {
    let next = ctx;
    for (const act of actions) {
      const patch = act(next, event);
      if (patch && typeof patch === "object") next = { ...next, ...patch };
    }
    return next;
  }

  function chooseTransition(transitions, ctx, event) {
    for (const t of transitions) {
      const ok = t.cond ? !!t.cond(ctx, event) : true;
      if (ok) return t;
    }
    return null;
  }

  function transition(state, ctx, event) {
    const node = getNode(state);
    const candidates = toArray((node.on ?? {})[event.type]);

    if (candidates.length === 0) return { state, ctx, changed: false };

    const chosen = chooseTransition(candidates, ctx, event);
    if (!chosen) return { state, ctx, changed: false };

    invariant(
      machine.states[chosen.target],
      `target state does not exist: ${chosen.target}`,
    );

    const exitActions = toArray(node.exit);
    const entryActions = toArray(getNode(chosen.target).entry);
    const transActions = toArray(chosen.actions);

    let nextCtx = ctx;
    nextCtx = applyActions(nextCtx, exitActions, event);
    nextCtx = applyActions(nextCtx, transActions, event);
    nextCtx = applyActions(nextCtx, entryActions, event);

    return { state: chosen.target, ctx: nextCtx, changed: true };
  }

  function interpret() {
    let currentState = machine.initial;
    let currentCtx = { ...(machine.context ?? {}) };

    const listeners = new Set();

    let invokeController = null;
    let invokeTask = null;

    function snapshot() {
      return { state: currentState, context: structuredClone(currentCtx) };
    }

    function notify(event, prev) {
      for (const l of listeners) l({ event, prev, next: snapshot() });
    }

    function stopInvoke() {
      if (invokeController) {
        invokeController.abort("State left");
        invokeController = null;
      }
      invokeTask = null;
    }

    function startInvoke(state, triggerEvent) {
      const node = getNode(state);
      if (!node.invoke) return;

      stopInvoke();
      invokeController = new AbortController();
      const { signal } = invokeController;

      invokeTask = (async () => {
        try {
          await node.invoke(currentCtx, triggerEvent, { signal, send });
        } catch (err) {
          if (err?.name === "AbortError") return;
          send({ type: "@invoke.error", error: err });
        }
      })();
    }

    function enterState(state, causeEvent) {
      currentCtx = applyActions(
        currentCtx,
        toArray(getNode(state).entry),
        causeEvent,
      );
      startInvoke(state, causeEvent);
    }

    function send(event) {
      invariant(
        event && typeof event.type === "string",
        "event.type must be a string",
      );

      const prev = snapshot();
      const next = transition(currentState, currentCtx, event);

      if (!next.changed) return snapshot();

      // Leaving state: cancel invoke for the old state.
      stopInvoke();

      currentState = next.state;
      currentCtx = next.ctx;

      // Enter new state: run entry + start invoke.
      enterState(currentState, event);

      notify(event, prev);
      return snapshot();
    }

    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    // Init entry + invoke
    enterState(currentState, { type: "@init" });

    return { send, subscribe, snapshot };
  }

  return { interpret };
}

// ------------------------
// Demo machine: debounced search (invoke + cancel)
// ------------------------

async function fakeSearchApi(query, { signal }) {
  // Simulate variable latency + cancellation.
  const ms = 120 + (query.length % 3) * 60;
  await sleep(ms, { signal });

  if (query.toLowerCase() === "fail") {
    const err = new Error("Server error");
    err.name = "ServerError";
    throw err;
  }

  return [`${query}-1`, `${query}-2`, `${query}-3`];
}

const searchMachine = createMachine({
  id: "search",
  initial: "idle",
  context: { query: "", results: [], error: null },
  states: {
    idle: {
      on: {
        INPUT: {
          target: "debouncing",
          actions: (ctx, e) => ({ query: e.query, error: null }),
        },
      },
    },
    debouncing: {
      invoke: async (ctx, _e, { signal, send }) => {
        // Debounce window.
        await sleep(150, { signal });
        send({ type: "DEBOUNCED" });
      },
      on: {
        INPUT: {
          target: "debouncing",
          actions: (ctx, e) => ({ query: e.query }),
        },
        DEBOUNCED: { target: "loading" },
        CANCEL: {
          target: "idle",
          actions: () => ({ query: "", results: [], error: null }),
        },
      },
    },
    loading: {
      invoke: async (ctx, _e, { signal, send }) => {
        const results = await fakeSearchApi(ctx.query, { signal });
        send({ type: "RESOLVE", results });
      },
      on: {
        INPUT: {
          target: "debouncing",
          actions: (ctx, e) => ({ query: e.query }),
        },
        RESOLVE: {
          target: "success",
          actions: (ctx, e) => ({ results: e.results, error: null }),
        },
        "@invoke.error": {
          target: "error",
          actions: (ctx, e) => ({ error: e.error.message }),
        },
        CANCEL: {
          target: "idle",
          actions: () => ({ query: "", results: [], error: null }),
        },
      },
    },
    success: {
      on: {
        INPUT: {
          target: "debouncing",
          actions: (ctx, e) => ({ query: e.query }),
        },
        CANCEL: {
          target: "idle",
          actions: () => ({ query: "", results: [], error: null }),
        },
      },
    },
    error: {
      on: {
        INPUT: {
          target: "debouncing",
          actions: (ctx, e) => ({ query: e.query, error: null }),
        },
        CANCEL: {
          target: "idle",
          actions: () => ({ query: "", results: [], error: null }),
        },
      },
    },
  },
});

(async function main() {
  log("Exercise: State Machine Effects — start");

  const service = searchMachine.interpret();

  service.subscribe(({ event, prev, next }) => {
    log(`[transition] ${prev.state} -> ${next.state} on ${event.type}`);
    log("  ctx:", next.context);
  });

  log("initial:", service.snapshot());

  // Simulate rapid typing: each INPUT cancels the previous debounce/invoke.
  service.send({ type: "INPUT", query: "r" });
  await sleep(60);
  service.send({ type: "INPUT", query: "re" });
  await sleep(60);
  service.send({ type: "INPUT", query: "rea" });
  await sleep(220); // allows debounce to fire -> loading starts
  await sleep(80); // likely still loading

  // New input while loading cancels the in-flight search and restarts debounce.
  service.send({ type: "INPUT", query: "react" });

  await sleep(300); // allow flow to settle into success (usually)

  // Force an error case.
  service.send({ type: "INPUT", query: "fail" });
  await sleep(300);

  service.send({ type: "CANCEL" });

  log("final:", service.snapshot());
  log("Exercise: State Machine Effects — done");
})();
