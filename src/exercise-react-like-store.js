/**
 * Exercise — React-like Store (subscribe/select + tear-free snapshots)
 * Run: node src/exercise-react-like-store.js
 */

const log = console.log;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * This exercise models the core idea behind React's `useSyncExternalStore`:
 * - A store with subscribe()
 * - A getSnapshot() that is safe to read
 * - A selector layer that avoids unnecessary notifications
 *
 * Goal:
 * - Implement `createStore` so that:
 *   1) setState updates state immutably
 *   2) subscribe notifies listeners
 *   3) subscribeWithSelector notifies ONLY when selected value changes (Object.is)
 *   4) nested updates do not break notification ordering
 */

function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  function getSnapshot() {
    return state;
  }

  function setState(updater) {
    const prev = state;
    const next = typeof updater === "function" ? updater(prev) : updater;

    // Ignore no-op updates (same reference) to reduce noise.
    if (Object.is(prev, next)) return;

    state = next;

    // Notify in insertion order. Copy to avoid issues if a listener unsubscribes while iterating.
    const current = Array.from(listeners);
    for (const l of current) l();
  }

  function subscribe(listener) {
    invariant(typeof listener === "function", "listener must be a function");
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function subscribeWithSelector(selector, onChange, isEqual = Object.is) {
    invariant(typeof selector === "function", "selector must be a function");
    invariant(typeof onChange === "function", "onChange must be a function");

    let prevSelected = selector(state);

    return subscribe(() => {
      const nextSelected = selector(state);
      if (!isEqual(prevSelected, nextSelected)) {
        const prev = prevSelected;
        prevSelected = nextSelected;
        onChange(nextSelected, prev);
      }
    });
  }

  return { getSnapshot, setState, subscribe, subscribeWithSelector };
}

// ------------------------
// Demo
// ------------------------

(function main() {
  log("Exercise: React-like Store — start");

  const store = createStore({ count: 0, user: { name: "Ada" } });

  const unsubAll = store.subscribe(() => {
    const s = store.getSnapshot();
    log(`[all] state changed -> count=${s.count}, user=${s.user.name}`);
  });

  const unsubCount = store.subscribeWithSelector(
    (s) => s.count,
    (next, prev) => log(`[count] ${prev} -> ${next}`),
  );

  const unsubUserName = store.subscribeWithSelector(
    (s) => s.user.name,
    (next, prev) => log(`[user.name] ${prev} -> ${next}`),
  );

  // Update count (should notify [all] and [count], not [user.name]).
  store.setState((s) => ({ ...s, count: s.count + 1 }));

  // Update user name (should notify [all] and [user.name], not [count]).
  store.setState((s) => ({ ...s, user: { ...s.user, name: "Grace" } }));

  // No-op update (same reference): should notify nobody.
  const snap = store.getSnapshot();
  store.setState(snap);

  // Nested updates: listener triggers another update synchronously.
  const unsubNested = store.subscribe(() => {
    const s = store.getSnapshot();
    if (s.count === 2) {
      // This must not break notification safety.
      store.setState((x) => ({ ...x, user: { ...x.user, name: "Katherine" } }));
    }
  });

  store.setState((s) => ({ ...s, count: 2 }));

  // Cleanup
  unsubNested();
  unsubUserName();
  unsubCount();
  unsubAll();

  log("Exercise: React-like Store — done");
})();

/**
 * Your tasks:
 * 1) Add `batch(fn)`:
 *    - During batch, multiple setState calls should notify listeners only once at the end.
 * 2) Add `subscribeWithSelector` support for custom equality:
 *    - Provide shallowEqual for objects and use it for user selector.
 * 3) Add `setState` support for partial patches:
 *    - store.setState({ count: 123 }) merges into existing state.
 */
