/**
 * Exercise — Minimal State Machine Runner
 * Run: node src/exercise-state-machine.js
 */

const log = console.log;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Machine shape:
 * {
 *   id: string,
 *   initial: string,
 *   context: object,
 *   states: {
 *     [stateName]: {
 *       on?: { [eventType]: Transition | Transition[] },
 *       entry?: Action | Action[],
 *       exit?: Action | Action[]
 *     }
 *   }
 * }
 *
 * Transition shape:
 * { target: string, cond?: Guard, actions?: Action | Action[] }
 *
 * Event shape:
 * { type: string, ...payload }
 *
 * Action(ctx, event) => partialCtx | void
 * Guard(ctx, event) => boolean
 */

function toArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function createMachine(machineDef) {
  invariant(machineDef?.initial, "machine.initial is required");
  invariant(machineDef?.states, "machine.states is required");
  invariant(machineDef.states[machineDef.initial], "initial state must exist");

  const machine = structuredClone(machineDef);

  function getStateNode(state) {
    const node = machine.states[state];
    invariant(node, `unknown state: ${state}`);
    return node;
  }

  function chooseTransition(transitions, ctx, event) {
    for (const t of transitions) {
      const ok = t.cond ? !!t.cond(ctx, event) : true;
      if (ok) return t;
    }
    return null;
  }

  function applyActions(ctx, actions, event) {
    let next = ctx;
    for (const act of actions) {
      const patch = act(next, event);
      if (patch && typeof patch === "object") next = { ...next, ...patch };
    }
    return next;
  }

  function transition(state, ctx, event) {
    const node = getStateNode(state);
    const map = node.on ?? {};
    const candidates = toArray(map[event.type]);

    if (candidates.length === 0) {
      return { state, ctx, changed: false };
    }

    const chosen = chooseTransition(candidates, ctx, event);
    if (!chosen) {
      return { state, ctx, changed: false };
    }

    invariant(
      machine.states[chosen.target],
      `target state does not exist: ${chosen.target}`,
    );

    const exitActions = toArray(node.exit);
    const entryActions = toArray(getStateNode(chosen.target).entry);
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

    // Run entry actions for initial state.
    currentCtx = applyActions(
      currentCtx,
      toArray(getStateNode(currentState).entry),
      { type: "@init" },
    );

    const listeners = new Set();

    function notify(event, prev) {
      for (const l of listeners) l({ event, prev, next: snapshot() });
    }

    function snapshot() {
      return { state: currentState, context: structuredClone(currentCtx) };
    }

    function send(event) {
      invariant(
        event && typeof event.type === "string",
        "event.type must be a string",
      );

      const prev = snapshot();
      const next = transition(currentState, currentCtx, event);

      currentState = next.state;
      currentCtx = next.ctx;

      if (next.changed) notify(event, prev);
      return snapshot();
    }

    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    return { send, subscribe, snapshot };
  }

  return { interpret };
}

// ------------------------
// Demo machine: request lifecycle
// ------------------------

const requestMachine = createMachine({
  id: "request",
  initial: "idle",
  context: { retries: 0, lastError: null },
  states: {
    idle: {
      on: {
        FETCH: {
          target: "loading",
          actions: (ctx) => ({ lastError: null, retries: ctx.retries }),
        },
      },
    },
    loading: {
      entry: (ctx) => ({ startedAt: Date.now(), lastError: null }),
      on: {
        RESOLVE: { target: "success", actions: (ctx, e) => ({ data: e.data }) },
        REJECT: [
          {
            target: "loading",
            cond: (ctx) => ctx.retries < 2,
            actions: (ctx, e) => ({
              retries: ctx.retries + 1,
              lastError: e.error,
            }),
          },
          {
            target: "error",
            actions: (ctx, e) => ({ lastError: e.error }),
          },
        ],
        CANCEL: { target: "idle", actions: () => ({ lastError: null }) },
      },
    },
    success: {
      on: {
        FETCH: { target: "loading", actions: () => ({}) },
      },
    },
    error: {
      on: {
        FETCH: {
          target: "loading",
          actions: (ctx) => ({ retries: 0, lastError: null }),
        },
      },
    },
  },
});

(function main() {
  log("Exercise: State Machine — start");

  const service = requestMachine.interpret();

  service.subscribe(({ event, prev, next }) => {
    log(`[transition] ${prev.state} -> ${next.state} on ${event.type}`);
    log("  ctx:", next.context);
  });

  log("initial:", service.snapshot());

  service.send({ type: "FETCH" });
  service.send({ type: "REJECT", error: "timeout" });
  service.send({ type: "REJECT", error: "timeout" });
  service.send({ type: "REJECT", error: "timeout" });
  service.send({ type: "FETCH" });
  service.send({ type: "RESOLVE", data: { ok: true } });
  service.send({ type: "FETCH" });
  service.send({ type: "CANCEL" });

  log("final:", service.snapshot());
  log("Exercise: State Machine — done");
})();

/**
 * Your tasks:
 * 1) Add "always transitions" (a.k.a. immediate transitions) to support auto-advance:
 *    - Example: when entering "success", if data.ok === false => go to "error".
 * 2) Add support for internal transitions:
 *    - Transition that runs actions without changing state.
 * 3) Add a devtool hook:
 *    - Keep a history array of {event, prev, next} capped at 20 entries.
 */
